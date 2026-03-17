import type { TranscriptionProvider } from './providers/types'

export interface STTOptions {
  language?: string
  signal?: AbortSignal
}

export class STTService {
  private provider: TranscriptionProvider
  private mediaStream: MediaStream | null = null
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []

  constructor(provider: TranscriptionProvider) {
    this.provider = provider
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

  startRecording(): void {
    if (!this.mediaStream) {
      throw new Error('Microphone not initialized. Call requestMicrophoneAccess first.')
    }

    this.audioChunks = []
    
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
    this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType })

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data)
      }
    }

    this.mediaRecorder.start(100)
  }

  async stopRecording(): Promise<Blob> {
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
