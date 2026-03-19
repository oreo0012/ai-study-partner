<script setup lang="ts">
import { computed } from 'vue'
import type { Task, TaskType } from '@/config/types'

const props = defineProps<{
  tasks: Task[]
}>()

const emit = defineEmits<{
  (e: 'task-click', task: Task): void
}>()

const taskTypeColors: Record<TaskType, { bg: string; border: string; icon: string }> = {
  '学习': { bg: 'bg-blue-100', border: 'border-blue-300', icon: 'i-carbon-education' },
  '练习': { bg: 'bg-green-100', border: 'border-green-300', icon: 'i-carbon-pen' },
  '阅读': { bg: 'bg-orange-100', border: 'border-orange-300', icon: 'i-carbon-book' },
  '其他': { bg: 'bg-purple-100', border: 'border-purple-300', icon: 'i-carbon-star' }
}

const taskTypeEmoji: Record<TaskType, string> = {
  '学习': '📚',
  '练习': '✏️',
  '阅读': '📖',
  '其他': '⭐'
}

const sortedTasks = computed(() => {
  return [...props.tasks].sort((a, b) => {
    if (a.status === '已完成' && b.status !== '已完成') return 1
    if (a.status !== '已完成' && b.status === '已完成') return -1
    return 0
  })
})

const pendingTasks = computed(() => {
  return sortedTasks.value.filter(t => t.status !== '已完成')
})

const completedTasks = computed(() => {
  return sortedTasks.value.filter(t => t.status === '已完成')
})

function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分钟`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
}

function formatCompletedTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  
  if (isToday) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function handleTaskClick(task: Task) {
  emit('task-click', task)
}
</script>

<template>
  <div class="todo-list">
    <div v-if="tasks.length === 0" class="empty-state">
      <div class="empty-icon">🌟</div>
      <div class="empty-title">今天还没有任务哦</div>
      <div class="empty-desc">快去让爸爸妈妈给你布置任务吧！</div>
    </div>

    <template v-else>
      <div v-if="pendingTasks.length > 0" class="task-section">
        <div class="section-header">
          <span class="section-icon">🎯</span>
          <span class="section-title">待完成</span>
          <span class="section-count">{{ pendingTasks.length }}</span>
        </div>
        
        <div class="task-cards">
          <div
            v-for="task in pendingTasks"
            :key="task.id"
            class="task-card"
            :class="[taskTypeColors[task.type].bg, taskTypeColors[task.type].border]"
            @click="handleTaskClick(task)"
          >
            <div class="card-header">
              <span class="task-emoji">{{ taskTypeEmoji[task.type] }}</span>
              <span class="task-type">{{ task.type }}</span>
              <div class="status-icon pending">○</div>
            </div>
            
            <div class="task-name">{{ task.name }}</div>
            
            <div class="task-meta">
              <div class="meta-item">
                <span class="i-carbon-time meta-icon"></span>
                <span>{{ formatTime(task.estimatedTime) }}</span>
              </div>
            </div>
            
            <div v-if="task.description" class="task-desc">
              {{ task.description }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="completedTasks.length > 0" class="task-section">
        <div class="section-header">
          <span class="section-icon">✨</span>
          <span class="section-title">已完成</span>
          <span class="section-count">{{ completedTasks.length }}</span>
        </div>
        
        <div class="task-cards">
          <div
            v-for="task in completedTasks"
            :key="task.id"
            class="task-card completed"
            :class="[taskTypeColors[task.type].bg, taskTypeColors[task.type].border]"
            @click="handleTaskClick(task)"
          >
            <div class="card-header">
              <span class="task-emoji">{{ taskTypeEmoji[task.type] }}</span>
              <span class="task-type">{{ task.type }}</span>
              <div class="status-icon completed">✓</div>
            </div>
            
            <div class="task-name">{{ task.name }}</div>
            
            <div class="task-meta">
              <div class="meta-item">
                <span class="i-carbon-time meta-icon"></span>
                <span>{{ formatTime(task.estimatedTime) }}</span>
              </div>
              <div v-if="task.completedAt" class="meta-item completed-time">
                <span class="i-carbon-checkmark-filled meta-icon"></span>
                <span>{{ formatCompletedTime(task.completedAt) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.todo-list {
  padding: 1rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.empty-title {
  font-size: 1.5rem;
  font-weight: bold;
  color: #374151;
  margin-bottom: 0.5rem;
}

.empty-desc {
  font-size: 1rem;
  color: #6b7280;
}

.task-section {
  margin-bottom: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0 0.5rem;
}

.section-icon {
  font-size: 1.25rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
}

.section-count {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 0.875rem;
  font-weight: bold;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  min-width: 1.5rem;
  text-align: center;
}

.task-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.task-card {
  border-radius: 1rem;
  border: 2px solid;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.task-card:active {
  transform: translateY(0);
}

.task-card.completed {
  opacity: 0.7;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.task-emoji {
  font-size: 1.5rem;
}

.task-type {
  font-size: 0.875rem;
  font-weight: 500;
  color: #4b5563;
  flex: 1;
}

.status-icon {
  font-size: 1.5rem;
  font-weight: bold;
}

.status-icon.pending {
  color: #9ca3af;
}

.status-icon.completed {
  color: #10b981;
  animation: checkmark 0.3s ease-in-out;
}

@keyframes checkmark {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.task-name {
  font-size: 1.25rem;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.meta-icon {
  font-size: 1rem;
}

.completed-time {
  color: #10b981;
}

.task-desc {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.5;
  padding-top: 0.5rem;
  border-top: 1px dashed #d1d5db;
}

@media (min-width: 640px) {
  .task-cards {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .task-cards {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
