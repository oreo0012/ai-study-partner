import type { AppConfig } from './types'
import { validateConfig } from './validator'

const CONFIG_URL = '/config.json'

let cachedConfig: AppConfig | null = null

export async function loadConfig(): Promise<AppConfig> {
  if (cachedConfig) {
    return cachedConfig
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
    return config
  } catch (error) {
    console.error('Failed to load config:', error)
    throw error
  }
}

export function getConfig(): AppConfig | null {
  return cachedConfig
}

export function clearConfigCache(): void {
  cachedConfig = null
}
