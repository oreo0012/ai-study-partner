<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  disabled?: boolean
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  placeholder: '说点什么...'
})

const emit = defineEmits<{
  (e: 'send', message: string): void
  (e: 'voice'): void
}>()

const inputValue = ref('')

function handleSend() {
  const message = inputValue.value.trim()
  if (message && !props.disabled) {
    emit('send', message)
    inputValue.value = ''
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="chat-input flex gap-2 p-4 bg-white rounded-xl shadow-lg">
    <button
      class="voice-btn w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
      @click="emit('voice')"
    >
      <div class="i-carbon-microphone text-xl text-gray-600" />
    </button>
    
    <input
      v-model="inputValue"
      type="text"
      :placeholder="placeholder"
      :disabled="disabled"
      class="text-input flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
      @keydown="handleKeydown"
    />
    
    <button
      class="send-btn w-12 h-12 rounded-full flex items-center justify-center transition-colors"
      :class="inputValue.trim() && !disabled ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-gray-300'"
      :disabled="!inputValue.trim() || disabled"
      @click="handleSend"
    >
      <div class="i-carbon-send text-xl" :class="inputValue.trim() && !disabled ? 'text-white' : 'text-gray-500'" />
    </button>
  </div>
</template>
