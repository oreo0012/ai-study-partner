<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore, useTaskStore, useMemoryStore } from '@/stores'
import ChatMessage from './ChatMessage.vue'
import ChatInput from './ChatInput.vue'
import TaskPanel from './TaskPanel.vue'

const router = useRouter()
const chatStore = useChatStore()
const taskStore = useTaskStore()
const memoryStore = useMemoryStore()
const messagesContainer = ref<HTMLElement | null>(null)

const todayTasks = computed(() => taskStore.todayTasks)
const completedCount = computed(() => taskStore.completedTasks.length)
const totalCount = computed(() => taskStore.todayTasks.length)
const hasTodayTasks = computed(() => totalCount.value > 0)
const isMemoryLoading = computed(() => memoryStore.isLoading || memoryStore.isArchiveInProgress)

onMounted(async () => {
  await taskStore.loadTodayTasks()
  
  scrollToBottom()
})

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch(
  () => chatStore.messages.length,
  () => {
    scrollToBottom()
  }
)

watch(
  () => chatStore.streamingMessage,
  () => {
    scrollToBottom()
  }
)

function handleSend(message: string) {
  chatStore.sendMessage(message)
}

function handleVoice() {
  console.log('Voice input triggered')
}

async function handleTaskComplete(taskId: string) {
  await taskStore.completeTask(taskId)
}

function handleStartPractice(taskId: string) {
  router.push('/')
  
  nextTick(() => {
    chatStore.sendMessage('开始自主练习')
  })
}
</script>

<template>
  <div class="chat-area flex flex-col h-full">
    <div
      ref="messagesContainer"
      class="messages-container flex-1 overflow-y-auto p-4"
    >
      <div
        v-if="isMemoryLoading"
        class="memory-loading flex items-center justify-center p-4 text-gray-500"
      >
        <div class="i-carbon-renew animate-spin text-xl mr-2" />
        <span>正在加载记忆...</span>
      </div>
      
      <div
        v-if="!chatStore.hasMessages && !isMemoryLoading"
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
          <span class="text-white text-lg">👧</span>
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
    
    <TaskPanel
      v-if="hasTodayTasks"
      :tasks="todayTasks"
      :completed-count="completedCount"
      :total-count="totalCount"
      @task-complete="handleTaskComplete"
      @start-practice="handleStartPractice"
    />
    
    <div class="input-area p-4">
      <ChatInput
        :disabled="chatStore.isGenerating || isMemoryLoading"
        @send="handleSend"
        @voice="handleVoice"
      />
    </div>
  </div>
</template>
