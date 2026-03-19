<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore, useMemoryStore } from '@/stores'
import TodoList from '@/components/TodoList.vue'
import ProgressVisualization from '@/components/ProgressVisualization.vue'
import type { Task } from '@/config/types'

const router = useRouter()
const taskStore = useTaskStore()
const memoryStore = useMemoryStore()

const isLoading = ref(true)

const todayTasks = computed(() => taskStore.todayTasks)
const completedCount = computed(() => taskStore.completedTasks.length)
const totalCount = computed(() => taskStore.todayTasks.length)
const studyTime = computed(() => memoryStore.totalStudyTime)
const consecutiveDays = computed(() => memoryStore.consecutiveDays)

onMounted(async () => {
  isLoading.value = true
  try {
    await Promise.all([
      taskStore.loadTodayTasks(),
      memoryStore.loadMemoryData()
    ])
  } catch (error) {
    console.error('Failed to load data:', error)
  } finally {
    isLoading.value = false
  }
})

function goBack() {
  router.push('/')
}

function handleTaskClick(task: Task) {
  console.log('Task clicked:', task)
  if (task.type === '练习') {
    router.push('/practice')
  }
}

async function refreshTasks() {
  isLoading.value = true
  try {
    await taskStore.loadTodayTasks()
  } catch (error) {
    console.error('Failed to refresh tasks:', error)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="child-task-page">
    <header class="page-header">
      <button class="back-button" @click="goBack">
        <span class="i-carbon-arrow-left"></span>
      </button>
      <h1 class="page-title">我的任务</h1>
      <button class="refresh-button" @click="refreshTasks" :disabled="isLoading">
        <span class="i-carbon-renew" :class="{ 'animate-spin': isLoading }"></span>
      </button>
    </header>

    <main class="page-content">
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <div class="loading-text">加载中...</div>
      </div>

      <template v-else>
        <ProgressVisualization
          :completed-tasks="completedCount"
          :total-tasks="totalCount"
          :study-time="studyTime"
          :consecutive-days="consecutiveDays"
        />

        <TodoList
          :tasks="todayTasks"
          @task-click="handleTaskClick"
        />
      </template>
    </main>
  </div>
</template>

<style scoped>
.child-task-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fcd34d 100%);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 10;
}

.back-button,
.refresh-button {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.back-button:hover,
.refresh-button:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
}

.back-button:active,
.refresh-button:active {
  transform: scale(0.95);
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.page-title {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
}

.page-content {
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
}

.loading-spinner {
  width: 3rem;
  height: 3rem;
  border: 4px solid #fde68a;
  border-top-color: #f59e0b;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 1rem;
  font-size: 1.125rem;
  color: #92400e;
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
