import type { AppConfig } from './types'
import { validateConfig } from './validator'
import { loadSoul, type SoulLoadResult } from '@/services/soul'

const CONFIG_URL = '/config.json'
const DEFAULT_SOUL_PATH = '/soul.md'

let cachedConfig: AppConfig | null = null
let cachedSoulContent: string | null = null

export interface ConfigLoadResult {
  config: AppConfig
  soulContent: string
  soulSource: 'file' | 'default' | 'fallback'
}

export async function loadConfig(): Promise<ConfigLoadResult> {
  if (cachedConfig && cachedSoulContent) {
    return {
      config: cachedConfig,
      soulContent: cachedSoulContent,
      soulSource: 'file'
    }
  }

  try {
    const response = await fetch(CONFIG_URL)
    
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status} ${response.statusText}`)
    }

    const config = await response.json() as AppConfig
    
    const validation = validateConfig(config)
    if (!validation.valid) {
      console.warn('Config validation warnings:', validation.warnings)
      if (validation.errors.length > 0) {
        throw new Error(`Config validation errors: ${validation.errors.join(', ')}`)
      }
    }

    cachedConfig = config
    
    const soulPath = config.soul?.path ?? DEFAULT_SOUL_PATH
    const soulEnabled = config.soul?.enabled ?? true
    
    let soulResult: SoulLoadResult
    
    if (soulEnabled) {
      soulResult = await loadSoul({ path: soulPath })
    } else {
      soulResult = {
        content: config.character?.systemPrompt || '',
        source: 'fallback'
      }
    }
    
    cachedSoulContent = soulResult.content

    return {
      config,
      soulContent: soulResult.content,
      soulSource: soulResult.source
    }
  } catch (error) {
    console.error('Failed to load config:', error)
    throw error
  }
}

export function getConfig(): AppConfig | null {
  return cachedConfig
}

export function getSoulContent(): string | null {
  return cachedSoulContent
}

export function clearConfigCache(): void {
  cachedConfig = null
  cachedSoulContent = null
}
