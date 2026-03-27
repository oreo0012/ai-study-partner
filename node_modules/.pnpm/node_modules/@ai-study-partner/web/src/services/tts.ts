import type { SpeechProvider } from './providers/factory'
import type { LipSyncResult } from './lipsync'

export interface TTSOptions {
  text: string
  model?: string
  voice?: string
  speed?: number
  signal?: AbortSignal
}

export interface TTSCallbacks {
  onLipSync?: (result: LipSyncResult) => void
  onPlayStart?: () => void
  onPlayEnd?: () => void
}

export class TTSService {
  private provider: SpeechProvider
  private audioContext: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private isPlaying = false
  private lipSyncAnimationId: number | null = null

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
    
    if (this.provider.synthesize) {
      return this.provider.synthesize(text, signal)
    }

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

  async speak(text: string, options: Omit<TTSOptions, 'text'> = {}, callbacks: TTSCallbacks = {}): Promise<void> {
    const audioContext = this.getAudioContext()
    
    this.stop()

    const audioBuffer = await this.synthesize({ text, ...options })
    const decodedBuffer = await audioContext.decodeAudioData(audioBuffer)

    return new Promise((resolve, reject) => {
      const source = audioContext.createBufferSource()
      source.buffer = decodedBuffer
      
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.5
      
      source.connect(analyser)
      analyser.connect(audioContext.destination)
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      
      const updateLipSync = () => {
        if (!this.isPlaying) {
          callbacks.onLipSync?.({ mouthOpenY: 0, isSpeaking: false, volume: 0 })
          return
        }
        
        analyser.getByteFrequencyData(dataArray)
        
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        
        const average = sum / dataArray.length
        const volume = average / 255
        
        let mouthOpenY = 0
        if (average > 20) {
          mouthOpenY = Math.min(0.8, Math.max(0.1, volume * 2))
        }
        
        callbacks.onLipSync?.({ mouthOpenY, isSpeaking: average > 20, volume })
        
        this.lipSyncAnimationId = requestAnimationFrame(updateLipSync)
      }
      
      source.onended = () => {
        this.isPlaying = false
        this.currentSource = null
        if (this.lipSyncAnimationId) {
          cancelAnimationFrame(this.lipSyncAnimationId)
          this.lipSyncAnimationId = null
        }
        callbacks.onLipSync?.({ mouthOpenY: 0, isSpeaking: false, volume: 0 })
        callbacks.onPlayEnd?.()
        resolve()
      }

      this.currentSource = source
      this.isPlaying = true
      callbacks.onPlayStart?.()
      
      try {
        source.start()
        updateLipSync()
      } catch (e) {
        this.isPlaying = false
        this.currentSource = null
        reject(e)
      }
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
    if (this.lipSyncAnimationId) {
      cancelAnimationFrame(this.lipSyncAnimationId)
      this.lipSyncAnimationId = null
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
