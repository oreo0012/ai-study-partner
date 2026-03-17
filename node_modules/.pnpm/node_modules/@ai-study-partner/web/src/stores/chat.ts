import type { Message } from '@/services/types'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useConfigStore } from './config'
import { createChatProvider, streamChat } from '@/services'

export const useChatStore = defineStore('chat', () => {
  const configStore = useConfigStore()
  
  const messages = ref<Message[]>([])
  const streamingMessage = ref<string>('')
  const isGenerating = ref(false)
  const error = ref<string | null>(null)
  const abortController = ref<AbortController | null>(null)

  const hasMessages = computed(() => messages.value.length > 0)

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
    const characterConfig = configStore.characterConfig
    
    if (!llmConfig || !characterConfig) {
      error.value = '配置未加载，请检查config.json'
      return
    }

    addUserMessage(userMessage)
    
    isGenerating.value = true
    error.value = null
    streamingMessage.value = ''
    abortController.value = new AbortController()

    try {
      const provider = createChatProvider(llmConfig)
      
      const chatMessages = messages.value.map(m => ({
        role: m.role,
        content: m.content
      }))

      await streamChat({
        model: llmConfig.model,
        provider,
        systemPrompt: characterConfig.systemPrompt,
        messages: chatMessages,
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens
      }, {
        signal: abortController.value.signal,
        onToken: (token) => {
          streamingMessage.value += token
        },
        onComplete: (fullText) => {
          addAssistantMessage(fullText)
          streamingMessage.value = ''
        },
        onError: (err) => {
          error.value = err.message
        }
      })

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 用户取消，不显示错误
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
  }

  function stopGeneration() {
    if (abortController.value) {
      abortController.value.abort()
    }
    isGenerating.value = false
  }

  return {
    messages,
    streamingMessage,
    isGenerating,
    error,
    hasMessages,
    addUserMessage,
    addAssistantMessage,
    sendMessage,
    clearMessages,
    stopGeneration
  }
})
