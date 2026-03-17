import type { SpeechProvider } from './providers/types'

export interface TTSOptions {
  text: string
  model?: string
  voice?: string
  speed?: number
  signal?: AbortSignal
}

export class TTSService {
  private provider: SpeechProvider
  private audioContext: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private isPlaying = false

  constructor(provider: SpeechProvider) {
    this.provider = provider
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }
    return this.audioContext
  }

  async synthesize(options: TTSOptions): Promise<ArrayBuffer> {
    const { text, model, voice, speed, signal } = options
    const config = this.provider.speech(model || '', voice)

    const response = await fetch(`${config.baseURL}audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        input: text,
        voice: config.voice,
        speed: speed ?? 1.0,
        response_format: 'mp3'
      }),
      signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`TTS API Error: ${response.status} - ${errorText}`)
    }

    return response.arrayBuffer()
  }

  async speak(text: string, options: Omit<TTSOptions, 'text'> = {}): Promise<void> {
    const audioContext = this.getAudioContext()
    
    this.stop()

    const audioBuffer = await this.synthesize({ text, ...options })
    const decodedBuffer = await audioContext.decodeAudioData(audioBuffer)

    return new Promise((resolve, reject) => {
      const source = audioContext.createBufferSource()
      source.buffer = decodedBuffer
      source.connect(audioContext.destination)
      
      source.onended = () => {
        this.isPlaying = false
        this.currentSource = null
        resolve()
      }

      source.onerror = (e) => {
        this.isPlaying = false
        this.currentSource = null
        reject(e)
      }

      this.currentSource = source
      this.isPlaying = true
      source.start()
    })
  }

  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch {
        // ignore already stopped errors
      }
      this.currentSource = null
    }
    this.isPlaying = false
  }

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  dispose(): void {
    this.stop()
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}
