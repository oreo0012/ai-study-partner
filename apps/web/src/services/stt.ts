import type { TranscriptionProvider } from './providers/factory'
import { VADDetector, type VADState, type VADConfig } from './vad'

export interface STTOptions {
  language?: string
  signal?: AbortSignal
}

export interface STTCallbacks {
  onVADStateChange?: (state: VADState) => void
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
  onTranscription?: (text: string) => void
}

export class STTService {
  private provider: TranscriptionProvider
  private mediaStream: MediaStream | null = null
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private vadDetector: VADDetector | null = null
  private callbacks: STTCallbacks = {}
  private isRecording = false
  private autoStopEnabled = true
  private lastSpeechTime = 0

  constructor(provider: TranscriptionProvider) {
    this.provider = provider
  }

  setCallbacks(callbacks: STTCallbacks): void {
    this.callbacks = callbacks
  }

  async requestMicrophoneAccess(): Promise<MediaStream> {
    if (this.mediaStream) {
      return this.mediaStream
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000
      }
    })

    return this.mediaStream
  }

  async initializeVAD(config?: VADConfig): Promise<void> {
    if (!this.mediaStream) {
      await this.requestMicrophoneAccess()
    }

    this.vadDetector = new VADDetector({
      energyThreshold: 0.015,
      silenceDuration: 20,
      speechDuration: 5,
      ...config
    })

    await this.vadDetector.initialize(this.mediaStream!)
    
    this.vadDetector.onStateChange((state) => {
      this.callbacks.onVADStateChange?.(state)
      
      if (state.isSpeaking && !state.isSpeechDetected) {
        this.callbacks.onSpeechStart?.()
      }
      
      if (!state.isSpeaking && state.silenceFrames >= 20) {
        this.callbacks.onSpeechEnd?.()
        
        if (this.autoStopEnabled && this.isRecording && Date.now() - this.lastSpeechTime > 1500) {
          this.stopAndTranscribe()
        }
      }
      
      if (state.isSpeaking) {
        this.lastSpeechTime = Date.now()
      }
    })
  }

  startRecording(): void {
    if (!this.mediaStream) {
      throw new Error('Microphone not initialized. Call requestMicrophoneAccess first.')
    }

    this.audioChunks = []
    this.isRecording = true
    this.lastSpeechTime = Date.now()
    
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
    this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType })

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data)
      }
    }

    this.mediaRecorder.start(100)
    
    if (this.vadDetector) {
      this.vadDetector.start()
    }
  }

  async stopRecording(): Promise<Blob> {
    this.isRecording = false
    
    if (this.vadDetector) {
      this.vadDetector.stop()
    }
    
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(new Blob())
        return
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm'
        const audioBlob = new Blob(this.audioChunks, { type: mimeType })
        this.audioChunks = []
        resolve(audioBlob)
      }

      this.mediaRecorder.stop()
    })
  }

  private async stopAndTranscribe(): Promise<void> {
    if (!this.isRecording) return
    
    const audioBlob = await this.stopRecording()
    
    if (audioBlob.size > 1000) {
      try {
        const text = await this.transcribe(audioBlob)
        if (text.trim()) {
          this.callbacks.onTranscription?.(text)
        }
      } catch (error) {
        console.error('Transcription error:', error)
      }
    }
  }

  setAutoStop(enabled: boolean): void {
    this.autoStopEnabled = enabled
  }

  async transcribe(audioBlob: Blob, options: STTOptions = {}): Promise<string> {
    const config = this.provider.transcription('')
    
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.webm')
    formData.append('model', config.model)
    if (options.language) {
      formData.append('language', options.language)
    }

    const response = await fetch(`${config.baseURL}audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: formData,
      signal: options.signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`STT API Error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    return result.text || ''
  }

  releaseMicrophone(): void {
    if (this.vadDetector) {
      this.vadDetector.dispose()
      this.vadDetector = null
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }
    this.mediaRecorder = null
  }

  dispose(): void {
    this.releaseMicrophone()
  }
}
