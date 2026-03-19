import type { Message } from '@/services/types'
import type { EmotionType } from '@/services/emotion'
import type { LipSyncResult } from '@/services/lipsync'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useConfigStore } from './config'
import { 
  createChatProvider, 
  streamChat, 
  EmotionParser, 
  parseEmotionFromStream, 
  stripEmotionTags,
  TTSService,
  createSpeechProvider
} from '@/services'

export interface EmotionCallback {
  (emotion: EmotionType, intensity: number): void
}

export interface TTSCallback {
  (result: LipSyncResult): void
}

export const useChatStore = defineStore('chat', () => {
  const configStore = useConfigStore()
  
  const messages = ref<Message[]>([])
  const streamingMessage = ref<string>('')
  const isGenerating = ref(false)
  const error = ref<string | null>(null)
  const abortController = ref<AbortController | null>(null)
  const emotionParser = new EmotionParser()
  const currentEmotion = ref<EmotionType>('neutral')
  const emotionCallback = ref<EmotionCallback | null>(null)
  
  const ttsEnabled = ref(true)
  const isSpeaking = ref(false)
  const ttsService = ref<TTSService | null>(null)
  const ttsCallback = ref<TTSCallback | null>(null)

  const hasMessages = computed(() => messages.value.length > 0)

  function setEmotionCallback(callback: EmotionCallback | null) {
    emotionCallback.value = callback
  }

  function triggerEmotionChange(emotion: EmotionType, intensity: number) {
    currentEmotion.value = emotion
    if (emotionCallback.value) {
      emotionCallback.value(emotion, intensity)
    }
  }

  function setTTSCallback(callback: TTSCallback | null) {
    ttsCallback.value = callback
  }

  function toggleTTS() {
    ttsEnabled.value = !ttsEnabled.value
    if (!ttsEnabled.value && ttsService.value) {
      ttsService.value.stop()
    }
  }

  function initTTSService() {
    const ttsConfig = configStore.ttsConfig
    if (!ttsConfig) return

    try {
      const provider = createSpeechProvider(ttsConfig)
      ttsService.value = new TTSService(provider)
    } catch (err) {
      console.error('Failed to initialize TTS service:', err)
    }
  }

  async function speakText(text: string): Promise<void> {
    if (!ttsEnabled.value || !ttsService.value) return
    
    try {
      isSpeaking.value = true
      await ttsService.value.speak(text, {}, {
        onLipSync: (result) => {
          if (ttsCallback.value) {
            ttsCallback.value(result)
          }
        },
        onPlayEnd: () => {
          isSpeaking.value = false
        }
      })
    } catch (err) {
      console.error('TTS error:', err)
      isSpeaking.value = false
    }
  }

  function stopSpeaking() {
    if (ttsService.value) {
      ttsService.value.stop()
      isSpeaking.value = false
    }
  }

  function addUserMessage(content: string) {
    const message: Message = {
      id: nanoid(),
      role: 'user',
      content,
      createdAt: Date.now()
    }
    messages.value.push(message)
    return message
  }

  function addAssistantMessage(content: string) {
    const message: Message = {
      id: nanoid(),
      role: 'assistant',
      content,
      createdAt: Date.now()
    }
    messages.value.push(message)
    return message
  }

  async function sendMessage(userMessage: string): Promise<void> {
    if (isGenerating.value) return
    
    const llmConfig = configStore.llmConfig
    const soulContent = configStore.soulContent
    
    if (!llmConfig) {
      error.value = '配置未加载，请检查config.json'
      return
    }

    if (!ttsService.value) {
      initTTSService()
    }

    addUserMessage(userMessage)
    
    isGenerating.value = true
    error.value = null
    streamingMessage.value = ''
    abortController.value = new AbortController()

    let fullResponseText = ''

    try {
      const provider = createChatProvider(llmConfig)
      
      const chatMessages: Array<{ role: string; content: string }> = messages.value.map(m => ({
        role: m.role,
        content: m.content
      }))

      await streamChat({
        model: llmConfig.model,
        provider,
        systemPrompt: soulContent,
        messages: chatMessages,
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens
      }, {
        signal: abortController.value.signal,
        onToken: (token) => {
          streamingMessage.value += token
          fullResponseText += token
          
          const emotionConfig = parseEmotionFromStream(token, emotionParser)
          if (emotionConfig) {
            triggerEmotionChange(emotionConfig.type, emotionConfig.intensity)
          }
        },
        onComplete: async (fullText) => {
          const cleanedText = stripEmotionTags(fullText)
          addAssistantMessage(cleanedText)
          streamingMessage.value = ''
          
          if (ttsEnabled.value && cleanedText.trim()) {
            await speakText(cleanedText)
          }
        },
        onError: (err) => {
          error.value = err.message
        }
      })

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        if (streamingMessage.value) {
          addAssistantMessage(streamingMessage.value)
        }
      } else {
        error.value = err instanceof Error ? err.message : '发送消息失败'
      }
    } finally {
      isGenerating.value = false
      abortController.value = null
    }
  }

  function clearMessages() {
    messages.value = []
    streamingMessage.value = ''
    error.value = null
    emotionParser.reset()
    currentEmotion.value = 'neutral'
    stopSpeaking()
  }

  function stopGeneration() {
    if (abortController.value) {
      abortController.value.abort()
    }
    isGenerating.value = false
    stopSpeaking()
  }

  return {
    messages,
    streamingMessage,
    isGenerating,
    error,
    hasMessages,
    currentEmotion,
    ttsEnabled,
    isSpeaking,
    addUserMessage,
    addAssistantMessage,
    sendMessage,
    clearMessages,
    stopGeneration,
    stopSpeaking,
    setEmotionCallback,
    triggerEmotionChange,
    setTTSCallback,
    toggleTTS,
    initTTSService,
    speakText
  }
})
