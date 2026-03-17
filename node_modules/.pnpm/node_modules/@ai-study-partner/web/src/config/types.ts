export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'ollama' | 'openai-compatible' | 'minimax'
  apiKey: string
  baseUrl: string
  model: string
  temperature?: number
  maxTokens?: number
}

export interface TTSConfig {
  provider: 'openai' | 'elevenlabs' | 'edge-tts' | 'openai-compatible' | 'minimax'
  apiKey: string
  baseUrl: string
  model: string
  voice: string
  speed?: number
}

export interface STTConfig {
  provider: 'openai' | 'whisper' | 'openai-compatible' | 'browser'
  apiKey: string
  baseUrl: string
  model: string
  language?: string
}

export interface CharacterConfig {
  name: string
  systemPrompt: string
  personality?: string
  avatarUrl?: string
}

export interface Live2DConfig {
  modelPath: string
  scale: number
  positionX: number
  positionY: number
}

export interface AppConfig {
  llm: LLMConfig
  tts: TTSConfig
  stt: STTConfig
  character: CharacterConfig
  live2d?: Live2DConfig
}
