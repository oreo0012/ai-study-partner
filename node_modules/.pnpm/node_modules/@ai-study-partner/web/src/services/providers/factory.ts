import type { LLMConfig, TTSConfig, STTConfig } from '@/config/types'

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

export function createChatProvider(config: LLMConfig): ChatProvider {
  return {
    chat: (_model: string) => ({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    })
  }
}

export function createSpeechProvider(config: TTSConfig): SpeechProvider {
  return {
    speech: (model: string, voice?: string) => ({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      model: model || config.model,
      voice: voice || config.voice,
    })
  }
}

export function createTranscriptionProvider(config: STTConfig): TranscriptionProvider {
  return {
    transcription: (model: string) => ({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      model: model || config.model,
    })
  }
}
