import type { ChatProvider } from '@xsai-ext/providers/utils'
import type { CommonContentPart, CompletionToolCall, Message, Tool } from '@xsai/shared-chat'

import { listModels } from '@xsai/model'
import { XSAIError } from '@xsai/shared'
import { streamText } from '@xsai/stream-text'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { debug, mcp } from '../tools'

export type StreamEvent
  = | { type: 'text-delta', text: string }
    | ({ type: 'finish' } & any)
    | ({ type: 'tool-call' } & CompletionToolCall)
    | { type: 'tool-result', toolCallId: string, result?: string | CommonContentPart[] }
    | { type: 'error', error: any }

export interface StreamOptions {
  headers?: Record<string, string>
  onStreamEvent?: (event: StreamEvent) => void | Promise<void>
  toolsCompatibility?: Map<string, boolean>
  supportsTools?: boolean
  waitForTools?: boolean // when true,won't resolve on finishReason=='tool_calls';
  tools?: Tool[] | (() => Promise<Tool[] | undefined>)
}

// TODO: proper format for other error messages.
function sanitizeMessages(messages: unknown[]): Message[] {
  return messages.map((m: any) => {
    if (m && m.role === 'error') {
      return {
        role: 'user',
        content: `User encountered error: ${String(m.content ?? '')}`,
      } as Message
    }
    return m as Message
  })
}

function collectHeaderEntries(raw?: HeadersInit | Record<string, string>): Array<[string, string]> {
  if (!raw)
    return []

  if (Array.isArray(raw)) {
    return raw.map(([key, value]) => [String(key), String(value)])
  }

  if (typeof Headers !== 'undefined' && raw instanceof Headers) {
    const entries: Array<[string, string]> = []
    raw.forEach((value, key) => {
      entries.push([key, value])
    })
    return entries
  }

  return Object.entries(raw).map(([key, value]) => [String(key), String(value)])
}

function hasNonISO88591CodePoint(value: string): boolean {
  for (const char of value) {
    if (char.codePointAt(0)! > 0xFF) {
      return true
    }
  }
  return false
}

export function normalizeRequestHeaders(...headerGroups: Array<HeadersInit | Record<string, string> | undefined>) {
  const invalidEntries: string[] = []
  const result: Record<string, string> = {}

  for (const headers of headerGroups) {
    for (const [key, value] of collectHeaderEntries(headers)) {
      if (value == null)
        continue
      const stringKey = String(key)
      const stringValue = typeof value === 'string' ? value : String(value)

      const invalidKey = /[\r\n]/.test(stringKey) || hasNonISO88591CodePoint(stringKey)
      const invalidValue = /[\r\n]/.test(stringValue) || hasNonISO88591CodePoint(stringValue)

      if (invalidKey || invalidValue) {
        invalidEntries.push(`${stringKey}${invalidKey ? ' (name)' : ''}${invalidValue ? ' (value)' : ''}`)
        continue
      }

      result[stringKey] = stringValue
    }
  }

  if (invalidEntries.length > 0) {
    throw new TypeError(`Invalid request headers: ${invalidEntries.join(', ')}. Header names/values must not contain Chinese/emoji/newlines.`)
  }

  return Object.keys(result).length > 0 ? result : undefined
}

function streamOptionsToolsCompatibilityOk(model: string, chatProvider: ChatProvider, _: Message[], options?: StreamOptions): boolean {
  return !!(options?.supportsTools || options?.toolsCompatibility?.get(`${chatProvider.chat(model).baseURL}-${model}`))
}

async function streamFrom(model: string, chatProvider: ChatProvider, messages: Message[], options?: StreamOptions) {
  const chatConfig = chatProvider.chat(model)
  const headers = normalizeRequestHeaders(chatConfig.headers, options?.headers)

  const sanitized = sanitizeMessages(messages as unknown[])
  const resolveTools = async () => {
    const tools = typeof options?.tools === 'function'
      ? await options.tools()
      : options?.tools
    return tools ?? []
  }

  const supportedTools = streamOptionsToolsCompatibilityOk(model, chatProvider, messages, options)
  const tools = supportedTools
    ? [
        ...await mcp(),
        ...await debug(),
        ...await resolveTools(),
      ]
    : undefined

  return new Promise<void>((resolve, reject) => {
    let settled = false
    const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null
    const baseURL = chatConfig.baseURL

    const overallTimeoutMs = 180_000
    const idleTimeoutMs = 60_000

    let overallTimeout: ReturnType<typeof setTimeout> | undefined
    let idleTimeout: ReturnType<typeof setTimeout> | undefined

    const clearTimers = () => {
      if (overallTimeout) {
        clearTimeout(overallTimeout)
        overallTimeout = undefined
      }
      if (idleTimeout) {
        clearTimeout(idleTimeout)
        idleTimeout = undefined
      }
    }

    const resolveOnce = () => {
      if (settled)
        return
      settled = true
      clearTimers()
      resolve()
    }
    const rejectOnce = (err: unknown) => {
      if (settled)
        return
      settled = true
      clearTimers()
      reject(err)
    }

    const refreshIdleTimeout = () => {
      if (!abortController)
        return
      if (idleTimeout)
        clearTimeout(idleTimeout)
      idleTimeout = setTimeout(() => {
        const err = new Error(`LLM request timed out (idle). baseURL=${baseURL} model=${model}`)
        abortController.abort(err)
        rejectOnce(err)
      }, idleTimeoutMs)
    }

    const onEvent = async (event: unknown) => {
      try {
        refreshIdleTimeout()
        await options?.onStreamEvent?.(event as StreamEvent)
        if (event && (event as StreamEvent).type === 'finish') {
          const finishReason = (event as any).finishReason
          if (finishReason !== 'tool_calls' || !options?.waitForTools)
            resolveOnce()
        }
        else if (event && (event as StreamEvent).type === 'error') {
          const error = (event as any).error ?? new Error('Stream error')
          rejectOnce(error)
        }
      }
      catch (err) {
        rejectOnce(err)
      }
    }

    try {
      if (abortController) {
        overallTimeout = setTimeout(() => {
          const err = new Error(`LLM request timed out. baseURL=${baseURL} model=${model}`)
          abortController.abort(err)
          rejectOnce(err)
        }, overallTimeoutMs)
        refreshIdleTimeout()
      }

      const runner = streamText({
        ...chatConfig,
        maxSteps: 10,
        messages: sanitized,
        headers,
        // TODO: we need Automatic tools discovery
        tools,
        onEvent,
        abortSignal: abortController?.signal,
      })
      runner.steps.then(() => resolveOnce()).catch(err => rejectOnce(err))
    }
    catch (err) {
      rejectOnce(err)
    }
  })
}

export async function attemptForToolsCompatibilityDiscovery(model: string, chatProvider: ChatProvider, _: Message[], options?: Omit<StreamOptions, 'supportsTools'>): Promise<boolean> {
  async function attempt(enable: boolean) {
    try {
      await streamFrom(model, chatProvider, [{ role: 'user', content: 'Hello, world!' }], { ...options, supportsTools: enable })
      return true
    }
    catch (err) {
      if (err instanceof Error && err.name === new XSAIError('').name) {
        // TODO: if you encountered many more errors like these, please, add them here.

        // Ollama
        /**
         * {"error":{"message":"registry.ollama.ai/<scope>/<model> does not support tools","type":"api_error","param":null,"code":null}}
         */
        if (String(err).includes('does not support tools')) {
          return false
        }
        // OpenRouter
        /**
         * {"error":{"message":"No endpoints found that support tool use. To learn more about provider routing, visit: https://openrouter.ai/docs/provider-routing","code":404}}
         */
        if (String(err).includes('No endpoints found that support tool use.')) {
          return false
        }
      }

      throw err
    }
  }

  function promiseAllWithInterval<T>(promises: (() => Promise<T>)[], interval: number): Promise<{ result?: T, error?: any }[]> {
    return new Promise((resolve) => {
      const results: { result?: T, error?: any }[] = []
      let completed = 0

      promises.forEach((promiseFn, index) => {
        setTimeout(() => {
          promiseFn()
            .then((result) => {
              results[index] = { result }
            })
            .catch((err) => {
              results[index] = { error: err }
            })
            .finally(() => {
              completed++
              if (completed === promises.length) {
                resolve(results)
              }
            })
        }, index * interval)
      })
    })
  }

  const attempts = [
    () => attempt(true),
    () => attempt(false),
  ]

  const attemptsResults = await promiseAllWithInterval<boolean | undefined>(attempts, 1000)
  if (attemptsResults.some(res => res.error)) {
    const err = new Error(`Error during tools compatibility discovery for model: ${model}. Errors: ${attemptsResults.map(res => res.error).filter(Boolean).join(', ')}`)
    err.cause = attemptsResults.map(res => res.error).filter(Boolean)
    throw err
  }

  return attemptsResults[0].result === true && attemptsResults[1].result === true
}

export const useLLM = defineStore('llm', () => {
  const toolsCompatibility = ref<Map<string, boolean>>(new Map())

  async function discoverToolsCompatibility(model: string, chatProvider: ChatProvider, _: Message[], options?: Omit<StreamOptions, 'supportsTools'>) {
    // Cached, no need to discover again
    if (toolsCompatibility.value.has(`${chatProvider.chat(model).baseURL}-${model}`)) {
      return
    }

    const res = await attemptForToolsCompatibilityDiscovery(model, chatProvider, _, { ...options, toolsCompatibility: toolsCompatibility.value })
    toolsCompatibility.value.set(`${chatProvider.chat(model).baseURL}-${model}`, res)
  }

  function stream(model: string, chatProvider: ChatProvider, messages: Message[], options?: StreamOptions) {
    return streamFrom(model, chatProvider, messages, { ...options, toolsCompatibility: toolsCompatibility.value })
  }

  async function models(apiUrl: string, apiKey: string) {
    if (apiUrl === '') {
      return []
    }

    try {
      return await listModels({
        baseURL: (apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`) as `${string}/`,
        apiKey,
      })
    }
    catch (err) {
      if (String(err).includes(`Failed to construct 'URL': Invalid URL`)) {
        return []
      }

      throw err
    }
  }

  return {
    models,
    stream,
    discoverToolsCompatibility,
  }
})
