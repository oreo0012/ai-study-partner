import type { AppConfig, LLMConfig, TTSConfig, STTConfig, CharacterConfig, VisionConfig } from './types'

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

function validateLLMConfig(config: LLMConfig, result: ValidationResult): void {
  if (!config.provider) {
    result.errors.push('LLM provider is required')
  }
  if (!config.model) {
    result.errors.push('LLM model is required')
  }
  if (config.provider !== 'ollama' && !config.apiKey) {
    result.warnings.push('LLM apiKey is empty, API calls may fail')
  }
  if (!config.baseUrl) {
    result.warnings.push('LLM baseUrl is empty, using default')
  }
}

function validateTTSConfig(config: TTSConfig, result: ValidationResult): void {
  if (!config.provider) {
    result.errors.push('TTS provider is required')
  }
  if (!config.voice) {
    result.warnings.push('TTS voice is not specified, using default')
  }
  if (config.provider !== 'edge-tts' && !config.apiKey) {
    result.warnings.push('TTS apiKey is empty, API calls may fail')
  }
}

function validateSTTConfig(config: STTConfig, result: ValidationResult): void {
  if (!config.provider) {
    result.errors.push('STT provider is required')
  }
  if (config.provider !== 'browser' && !config.apiKey) {
    result.warnings.push('STT apiKey is empty, API calls may fail')
  }
}

function validateCharacterConfig(config: CharacterConfig, result: ValidationResult): void {
  if (!config.name) {
    result.warnings.push('Character name is empty')
  }
  if (!config.systemPrompt) {
    result.warnings.push('Character systemPrompt is empty, AI may not behave as expected')
  }
}

function validateVisionConfig(config: VisionConfig, result: ValidationResult): void {
  if (!config.provider) {
    result.warnings.push('Vision provider is not specified, image recognition will be disabled')
    return
  }
  if (!config.apiKey) {
    result.warnings.push('Vision apiKey is empty, image recognition may fail')
  }
  if (!config.model) {
    result.errors.push('Vision model is required when vision is enabled')
  }
  if (!config.baseUrl) {
    result.warnings.push('Vision baseUrl is empty, using default')
  }
  if (config.timeout && config.timeout < 5000) {
    result.warnings.push('Vision timeout is too small, minimum recommended is 5000ms')
  }
}

export function validateConfig(config: AppConfig): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  }

  if (!config) {
    result.errors.push('Config is null or undefined')
    result.valid = false
    return result
  }

  if (config.llm) {
    validateLLMConfig(config.llm, result)
  } else {
    result.errors.push('LLM config is missing')
  }

  if (config.tts) {
    validateTTSConfig(config.tts, result)
  } else {
    result.errors.push('TTS config is missing')
  }

  if (config.stt) {
    validateSTTConfig(config.stt, result)
  } else {
    result.errors.push('STT config is missing')
  }

  if (config.character) {
    validateCharacterConfig(config.character, result)
  } else {
    result.warnings.push('Character config is missing, using defaults')
  }

  if (config.vision) {
    validateVisionConfig(config.vision, result)
  }

  result.valid = result.errors.length === 0
  return result
}
