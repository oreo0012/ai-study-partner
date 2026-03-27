<script setup lang="ts">
import type { Message } from '@/services/types'
import { computed } from 'vue'

interface Props {
  message: Message
  showContext?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showContext: false
})

const formattedTime = computed(() => {
  return new Date(props.message.createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
})

const isFromHistory = computed(() => {
  const now = Date.now()
  const messageTime = props.message.createdAt
  const diffMinutes = (now - messageTime) / (1000 * 60)
  return diffMinutes > 5
})
</script>

<template>
  <div
    class="chat-message flex gap-3 p-4 rounded-xl mb-3"
    :class="[message.role, message.role === 'user' ? 'bg-indigo-100 ml-8' : 'bg-gray-100 mr-8']"
  >
    <div
      class="avatar w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center"
      :class="message.role === 'user' ? 'bg-indigo-500' : 'bg-purple-500'"
    >
      <span v-if="message.role === 'user'" class="text-white text-lg">我</span>
      <span v-else class="text-white text-lg">👧</span>
    </div>
    
    <div class="content flex-1 min-w-0">
      <div class="text text-gray-800 break-words">
        {{ message.content }}
      </div>
      <div class="meta flex items-center gap-2 mt-1">
        <span class="time text-xs text-gray-400">
          {{ formattedTime }}
        </span>
        <span
          v-if="isFromHistory"
          class="history-badge text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded"
        >
          历史消息
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-message {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.history-badge {
  font-size: 10px;
}
</style>
