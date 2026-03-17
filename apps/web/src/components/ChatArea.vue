<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import ChatMessage from './ChatMessage.vue'
import ChatInput from './ChatInput.vue'

const chatStore = useChatStore()
const messagesContainer = ref<HTMLElement | null>(null)

watch(
  () => chatStore.messages.length,
  () => {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  }
)

watch(
  () => chatStore.streamingMessage,
  () => {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  }
)

function handleSend(message: string) {
  chatStore.sendMessage(message)
}

function handleVoice() {
  console.log('Voice input triggered')
}
</script>

<template>
  <div class="chat-area flex flex-col h-full">
    <div
      ref="messagesContainer"
      class="messages-container flex-1 overflow-y-auto p-4"
    >
      <div
        v-if="!chatStore.hasMessages"
        class="empty-state flex flex-col items-center justify-center h-full text-gray-400"
      >
        <div class="i-carbon-chat-bot text-6xl mb-4" />
        <p class="text-lg">开始和AI学伴聊天吧！</p>
      </div>
      
      <ChatMessage
        v-for="message in chatStore.messages"
        :key="message.id"
        :message="message"
      />
      
      <div
        v-if="chatStore.streamingMessage"
        class="chat-message assistant flex gap-3 p-4 rounded-xl mb-3 bg-gray-100 mr-8"
      >
        <div class="avatar w-10 h-10 rounded-full flex-shrink-0 bg-purple-500 flex items-center justify-center">
          <span class="text-white text-lg">🤖</span>
        </div>
        <div class="content flex-1">
          <div class="text text-gray-800">
            {{ chatStore.streamingMessage }}
            <span class="cursor animate-pulse">|</span>
          </div>
        </div>
      </div>
      
      <div
        v-if="chatStore.error"
        class="error-message p-4 rounded-xl bg-red-100 text-red-600 mb-3"
      >
        {{ chatStore.error }}
      </div>
    </div>
    
    <div class="input-area p-4">
      <ChatInput
        :disabled="chatStore.isGenerating"
        @send="handleSend"
        @voice="handleVoice"
      />
    </div>
  </div>
</template>
