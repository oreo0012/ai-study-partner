export interface ChatProvider {
  chat: (model: string) => {
    baseURL: string
    apiKey: string
    headers?: Record<string, string>
  }
}

export interface SpeechProvider {
  speech: (model: string, voice?: string) => {
    baseURL: string
    apiKey: string
    model: string
    voice?: string
  }
}

export interface TranscriptionProvider {
  transcription: (model: string) => {
    baseURL: string
    apiKey: string
    model: string
  }
}
