<script setup lang="ts">
import type { Message } from '@/services/types'

interface Props {
  message: Message
}

defineProps<Props>()
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
      <span v-else class="text-white text-lg">🤖</span>
    </div>
    
    <div class="content flex-1 min-w-0">
      <div class="text text-gray-800 break-words">
        {{ message.content }}
      </div>
      <div class="time text-xs text-gray-400 mt-1">
        {{ new Date(message.createdAt).toLocaleTimeString() }}
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
</style>
