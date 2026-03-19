import type { AppConfig } from '@/config/types'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loadConfig, clearConfigCache, type ConfigLoadResult } from '@/config/loader'

export const useConfigStore = defineStore('config', () => {
  const config = ref<AppConfig | null>(null)
  const soulContent = ref<string>('')
  const soulSource = ref<'file' | 'default' | 'fallback'>('default')
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  const llmConfig = computed(() => config.value?.llm)
  const ttsConfig = computed(() => config.value?.tts)
  const sttConfig = computed(() => config.value?.stt)
  const characterConfig = computed(() => config.value?.character)
  const live2dConfig = computed(() => config.value?.live2d)

  const isConfigured = computed(() => {
    if (!config.value) return false
    const llmReady = !!config.value.llm.apiKey || config.value.llm.provider === 'ollama'
    return llmReady
  })

  async function load() {
    if (loaded.value && config.value) {
      return config.value
    }

    loading.value = true
    error.value = null

    try {
      const result: ConfigLoadResult = await loadConfig()
      config.value = result.config
      soulContent.value = result.soulContent
      soulSource.value = result.soulSource
      loaded.value = true
      return config.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load config'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function reload() {
    clearConfigCache()
    loaded.value = false
    return load()
  }

  return {
    config,
    soulContent,
    soulSource,
    loading,
    error,
    loaded,
    llmConfig,
    ttsConfig,
    sttConfig,
    characterConfig,
    live2dConfig,
    isConfigured,
    load,
    reload
  }
})
