import type { SpeechProvider } from './factory'

export interface VolcengineTTSConfig {
  appId: string
  accessKey: string
  resourceId: string
  speaker: string
  model?: 'seed-tts-2.0-expressive' | 'seed-tts-2.0-standard'
}

export interface VolcengineTTSRequest {
  user: {
    uid: string
  }
  namespace: string
  req_params: {
    text: string
    model: string
    speaker: string
    audio_params: {
      format: string
      sample_rate: number
    }
  }
}

export interface VolcengineTTSResponse {
  code: number
  message: string
  data?: string | { audio: string; duration?: number }
}

export class VolcengineTTSProvider implements SpeechProvider {
  private config: VolcengineTTSConfig
  private baseUrl: string

  constructor(config: VolcengineTTSConfig, baseUrl: string = '/api/volcengine/unidirectional') {
    this.config = config
    this.baseUrl = baseUrl
  }

  speech(_model: string, voice?: string) {
    return {
      baseURL: this.baseUrl,
      apiKey: this.config.accessKey,
      model: this.config.model || 'seed-tts-2.0-expressive',
      voice: voice || this.config.speaker,
      appId: this.config.appId,
      resourceId: this.config.resourceId
    }
  }

  async synthesize(text: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    const requestBody: VolcengineTTSRequest = {
      user: {
        uid: 'user-' + Date.now()
      },
      namespace: 'BidirectionalTTS',
      req_params: {
        text,
        model: this.config.model || 'seed-tts-2.0-expressive',
        speaker: this.config.speaker,
        audio_params: {
          format: 'mp3',
          sample_rate: 24000
        }
      }
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-App-Id': this.config.appId,
        'X-Api-Access-Key': this.config.accessKey,
        'X-Api-Resource-Id': this.config.resourceId
      },
      body: JSON.stringify(requestBody),
      signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Volcengine TTS API Error: ${response.status} - ${errorText}`)
    }

    return this.parseStreamResponse(response)
  }

  private async parseStreamResponse(response: Response): Promise<ArrayBuffer> {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    const audioChunks: Uint8Array[] = []
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
    }

    // 火山引擎响应可能是多个JSON对象连接在一起
    // 尝试按JSON对象边界分割
    const jsonObjects = this.extractJsonObjects(buffer)
    
    for (const jsonStr of jsonObjects) {
      try {
        const json: VolcengineTTSResponse = JSON.parse(jsonStr)
        
        // 火山引擎成功码是 20000000 或 0
        if (json.code !== undefined && json.code !== 20000000 && json.code !== 0) {
          throw new Error(`Volcengine TTS Error: ${json.code} - ${json.message}`)
        }

        // 处理音频数据 - data可能是字符串或对象
        if (json.data) {
          let audioBase64: string | null = null
          
          if (typeof json.data === 'string') {
            // data 直接是 base64 字符串
            audioBase64 = json.data
          } else if (json.data.audio) {
            // data 是对象，包含 audio 字段
            audioBase64 = json.data.audio
          }
          
          if (audioBase64) {
            const audioData = this.base64ToArrayBuffer(audioBase64)
            audioChunks.push(new Uint8Array(audioData))
          }
        }
      } catch (parseError) {
        if (!(parseError instanceof SyntaxError)) {
          throw parseError
        }
      }
    }

    if (audioChunks.length === 0) {
      console.error('[Volcengine TTS] No audio data. Raw response length:', buffer.length)
      console.error('[Volcengine TTS] Raw response preview:', buffer.substring(0, 500))
      throw new Error('No audio data received from Volcengine TTS')
    }

    console.log('[Volcengine TTS] Successfully parsed audio chunks:', audioChunks.length)
    return this.concatArrayBuffers(audioChunks)
  }

  private extractJsonObjects(text: string): string[] {
    const objects: string[] = []
    let depth = 0
    let start = -1
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      
      if (char === '{') {
        if (depth === 0) {
          start = i
        }
        depth++
      } else if (char === '}') {
        depth--
        if (depth === 0 && start !== -1) {
          objects.push(text.substring(start, i + 1))
          start = -1
        }
      }
    }
    
    return objects
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  private concatArrayBuffers(chunks: Uint8Array[]): ArrayBuffer {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return result.buffer
  }
}

export function createVolcengineTTSProvider(
  config: VolcengineTTSConfig,
  baseUrl?: string
): VolcengineTTSProvider {
  return new VolcengineTTSProvider(config, baseUrl)
}
