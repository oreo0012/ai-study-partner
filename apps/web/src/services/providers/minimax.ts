import type { SpeechProvider } from './factory'

export interface MinimaxTTSConfig {
  apiKey: string
  groupId?: string
  voiceId: string
  model?: 'speech-2.8-hd' | 'speech-2.8-turbo' | 'speech-2.6-hd' | 'speech-2.6-turbo' | 'speech-02-hd' | 'speech-02-turbo' | 'speech-01-hd' | 'speech-01-turbo'
  speed?: number
}

export interface MinimaxTTSRequest {
  model: string
  text: string
  stream?: boolean
  voice_setting?: {
    voice_id: string
    speed?: number
  }
  audio_setting?: {
    format: string
    sample_rate?: number
  }
  output_format?: 'hex' | 'url'
}

export interface MinimaxTTSResponse {
  base_resp?: {
    status_code: number
    status_msg: string
  }
  data?: {
    audio?: string
  } | string
  trace_id?: string
  extra_info?: {
    audio_length?: number
    audio_format?: string
  }
}

export class MinimaxTTSProvider implements SpeechProvider {
  private config: MinimaxTTSConfig
  private baseUrl: string

  constructor(config: MinimaxTTSConfig, baseUrl: string = 'https://api.minimaxi.com/v1/t2a_v2') {
    this.config = config
    this.baseUrl = baseUrl
  }

  speech(_model: string, voice?: string) {
    return {
      baseURL: this.baseUrl,
      apiKey: this.config.apiKey,
      model: this.config.model || 'speech-02-turbo',
      voice: voice || this.config.voiceId,
      groupId: this.config.groupId
    }
  }

  async synthesize(text: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    const requestBody: MinimaxTTSRequest = {
      model: this.config.model || 'speech-02-turbo',
      text,
      stream: false,
      voice_setting: {
        voice_id: this.config.voiceId,
        speed: this.config.speed ?? 1.0
      },
      audio_setting: {
        format: 'mp3',
        sample_rate: 32000
      },
      output_format: 'hex'
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`MiniMax TTS API Error: ${response.status} - ${errorText}`)
    }

    return this.parseResponse(response)
  }

  private async parseResponse(response: Response): Promise<ArrayBuffer> {
    const json: MinimaxTTSResponse = await response.json()

    if (json.base_resp?.status_code && json.base_resp.status_code !== 0) {
      throw new Error(`MiniMax TTS Error: ${json.base_resp.status_code} - ${json.base_resp.status_msg}`)
    }

    if (!json.data) {
      throw new Error('No audio data received from MiniMax TTS')
    }

    let audioHex: string | null = null

    if (typeof json.data === 'string') {
      audioHex = json.data
    } else if (json.data.audio) {
      audioHex = json.data.audio
    }

    if (!audioHex) {
      throw new Error('No audio data in MiniMax TTS response')
    }

    return this.hexToArrayBuffer(audioHex)
  }

  private hexToArrayBuffer(hex: string): ArrayBuffer {
    const cleanHex = hex.replace(/\s/g, '')
    const bytes = new Uint8Array(cleanHex.length / 2)
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16)
    }
    return bytes.buffer
  }
}

export function createMinimaxTTSProvider(
  config: MinimaxTTSConfig,
  baseUrl?: string
): MinimaxTTSProvider {
  return new MinimaxTTSProvider(config, baseUrl)
}
