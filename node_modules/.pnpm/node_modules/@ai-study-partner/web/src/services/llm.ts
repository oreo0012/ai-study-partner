import type { Message } from '@/services/types'
import { ThinkFilter, filterThinkTags } from './think-filter'
import { FormatFilter, filterSpecialChars } from './format-filter'

export interface StreamOptions {
  onToken?: (token: string) => void
  onComplete?: (fullText: string) => void
  onError?: (error: Error) => void
  signal?: AbortSignal
  enableThinkFilter?: boolean
  enableFormatFilter?: boolean
}

export interface ChatOptions {
  model: string
  provider: { chat: (model: string) => { baseURL: string; apiKey: string; headers?: Record<string, string> } }
  systemPrompt?: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  maxTokens?: number
}

export async function streamChat(options: ChatOptions, streamOptions: StreamOptions = {}): Promise<string> {
  const { model, provider, systemPrompt, messages, temperature, maxTokens } = options
  const { onToken, onComplete, onError, signal, enableThinkFilter = true, enableFormatFilter = true } = streamOptions

  const chatConfig = provider.chat(model)

  const apiMessages: Array<{ role: string; content: string }> = []

  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt })
  }

  for (const msg of messages) {
    apiMessages.push({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    })
  }

  const thinkFilter = new ThinkFilter({ enableStreamFilter: true })
  const formatFilter = new FormatFilter({ enableStreamFilter: true })

  try {
    const response = await fetch(`${chatConfig.baseURL}chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${chatConfig.apiKey}`,
        ...chatConfig.headers
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        temperature: temperature ?? 0.0,
        max_tokens: maxTokens,
        stream: true
      }),
      signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error: ${response.status} - ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(line => line.trim() !== '')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              fullText += content

              let filteredContent = content

              if (enableThinkFilter) {
                filteredContent = thinkFilter.filterStream(filteredContent)
              }

              if (enableFormatFilter && filteredContent) {
                filteredContent = formatFilter.filterStream(filteredContent)
              }

              if (filteredContent) {
                onToken?.(filteredContent)
              }
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    }

    const finalFilteredText = enableThinkFilter
      ? thinkFilter.finalize(fullText)
      : filterThinkTags(fullText)

    const finalText = enableFormatFilter
      ? formatFilter.finalize(finalFilteredText)
      : filterSpecialChars(finalFilteredText)

    onComplete?.(finalText)
    return finalText
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    onError?.(err)
    throw err
  }
}
