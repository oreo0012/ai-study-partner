import type { LLMConfig, TTSConfig, STTConfig } from '@/config/types'
import { VolcengineTTSProvider, type VolcengineTTSConfig } from './volcengine'

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
    appId?: string
    resourceId?: string
  }
  synthesize?: (text: string, signal?: AbortSignal) => Promise<ArrayBuffer>
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
  if (config.provider === 'volcengine') {
    const volcengineConfig: VolcengineTTSConfig = {
      appId: config.appId || '',
      accessKey: config.apiKey,
      resourceId: config.resourceId || 'seed-tts-2.0',
      speaker: config.voice,
      model: config.model as 'seed-tts-2.0-expressive' | 'seed-tts-2.0-standard' | undefined
    }
    const provider = new VolcengineTTSProvider(volcengineConfig, config.baseUrl)
    return {
      speech: (model: string, voice?: string) => provider.speech(model, voice),
      synthesize: (text: string, signal?: AbortSignal) => provider.synthesize(text, signal)
    }
  }

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

export { VolcengineTTSProvider }
export type { VolcengineTTSConfig }
