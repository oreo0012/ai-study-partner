import type { Message } from '@/services/types'

export interface StreamOptions {
  onToken?: (token: string) => void
  onComplete?: (fullText: string) => void
  onError?: (error: Error) => void
  signal?: AbortSignal
}

export interface ChatOptions {
  model: string
  provider: { chat: (model: string) => { baseURL: string; apiKey: string; headers?: Record<string, string> } }
  systemPrompt?: string
  messages: Message[]
  temperature?: number
  maxTokens?: number
}

export async function streamChat(options: ChatOptions, streamOptions: StreamOptions = {}): Promise<string> {
  const { model, provider, systemPrompt, messages, temperature, maxTokens } = options
  const { onToken, onComplete, onError, signal } = streamOptions

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
        temperature: temperature ?? 0.7,
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
              onToken?.(content)
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    }

    onComplete?.(fullText)
    return fullText
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    onError?.(err)
    throw err
  }
}
