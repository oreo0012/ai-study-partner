<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Task, TaskStatus } from '@/config/types'

const props = defineProps<{
  tasks: Task[]
  isLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'edit', task: Task): void
  (e: 'delete', taskId: string): void
  (e: 'refresh'): void
}>()

const statusFilter = ref<TaskStatus | '全部'>('全部')
const dateFilter = ref<string>('全部')

const availableDates = computed(() => {
  const dates = new Set<string>()
  props.tasks.forEach(task => {
    dates.add(task.date)
  })
  return Array.from(dates).sort()
})

const filteredTasks = computed(() => {
  let result = [...props.tasks]
  
  if (statusFilter.value !== '全部') {
    result = result.filter(task => task.status === statusFilter.value)
  }
  
  if (dateFilter.value !== '全部') {
    result = result.filter(task => task.date === dateFilter.value)
  }
  
  return result.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date)
    if (dateCompare !== 0) return dateCompare
    return a.createdAt.localeCompare(b.createdAt)
  })
})

const showDeleteConfirm = ref(false)
const taskToDelete = ref<Task | null>(null)

function handleEdit(task: Task) {
  emit('edit', task)
}

function confirmDelete(task: Task) {
  taskToDelete.value = task
  showDeleteConfirm.value = true
}

function cancelDelete() {
  taskToDelete.value = null
  showDeleteConfirm.value = false
}

function executeDelete() {
  if (taskToDelete.value) {
    emit('delete', taskToDelete.value.id)
    taskToDelete.value = null
    showDeleteConfirm.value = false
  }
}

function getStatusClass(status: TaskStatus) {
  switch (status) {
    case '待完成':
      return 'bg-amber-100 text-amber-700'
    case '进行中':
      return 'bg-blue-100 text-blue-700'
    case '已完成':
      return 'bg-green-100 text-green-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case '学习':
      return '📚'
    case '练习':
      return '✏️'
    case '阅读':
      return '📖'
    default:
      return '📝'
  }
}

function formatDate(dateStr: string) {
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  
  if (dateStr === today) return '今天'
  if (dateStr === tomorrow) return '明天'
  
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}
</script>

<template>
  <div class="task-list-container">
    <div class="filter-section mb-4 flex flex-wrap gap-3">
      <div class="filter-item flex items-center gap-2">
        <label class="text-sm text-gray-600 whitespace-nowrap">状态筛选:</label>
        <select
          v-model="statusFilter"
          class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-500 focus:outline-none bg-white"
        >
          <option value="全部">全部状态</option>
          <option value="待完成">待完成</option>
          <option value="进行中">进行中</option>
          <option value="已完成">已完成</option>
        </select>
      </div>
      
      <div class="filter-item flex items-center gap-2">
        <label class="text-sm text-gray-600 whitespace-nowrap">日期筛选:</label>
        <select
          v-model="dateFilter"
          class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-500 focus:outline-none bg-white"
        >
          <option value="全部">全部日期</option>
          <option v-for="date in availableDates" :key="date" :value="date">
            {{ formatDate(date) }} ({{ date }})
          </option>
        </select>
      </div>
      
      <button
        class="refresh-btn ml-auto px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors flex items-center gap-1"
        @click="emit('refresh')"
      >
        <div class="i-carbon-renew" :class="{ 'animate-spin': isLoading }" />
        <span>刷新</span>
      </button>
    </div>
    
    <div v-if="isLoading" class="loading-state text-center py-12">
      <div class="i-carbon-circle-dash animate-spin text-4xl text-indigo-500 mx-auto" />
      <p class="text-gray-500 mt-3">加载中...</p>
    </div>
    
    <div v-else-if="tasks.length === 0" class="empty-state text-center py-12">
      <div class="empty-icon text-6xl mb-4">📭</div>
      <p class="text-gray-500 text-lg">暂无任务</p>
      <p class="text-gray-400 text-sm mt-1">点击下方按钮添加新任务</p>
    </div>
    
    <div v-else-if="filteredTasks.length === 0" class="empty-state text-center py-12">
      <div class="empty-icon text-6xl mb-4">🔍</div>
      <p class="text-gray-500 text-lg">没有符合条件的任务</p>
      <p class="text-gray-400 text-sm mt-1">请尝试调整筛选条件</p>
    </div>
    
    <div v-else class="task-cards grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
      <div
        v-for="task in filteredTasks"
        :key="task.id"
        class="task-card bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all hover:border-indigo-200"
      >
        <div class="task-header flex items-start justify-between mb-3">
          <div class="task-info flex-1 min-w-0">
            <h3 class="font-semibold text-gray-800 truncate">{{ task.name }}</h3>
            <p v-if="task.description" class="text-sm text-gray-500 mt-1 line-clamp-2">
              {{ task.description }}
            </p>
          </div>
          <span
            class="status-tag px-2 py-1 text-xs rounded-full ml-2 flex-shrink-0"
            :class="getStatusClass(task.status)"
          >
            {{ task.status }}
          </span>
        </div>
        
        <div class="task-meta flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-3">
          <span class="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
            <span>{{ getTypeIcon(task.type) }}</span>
            <span>{{ task.type }}</span>
          </span>
          <span class="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
            <span>⏱️</span>
            <span>{{ task.estimatedTime }}分钟</span>
          </span>
          <span class="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
            <span>📅</span>
            <span>{{ formatDate(task.date) }}</span>
          </span>
        </div>
        
        <div class="task-actions flex gap-2 pt-2 border-t border-gray-100">
          <button
            class="edit-btn flex-1 py-2 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors flex items-center justify-center gap-1"
            @click="handleEdit(task)"
          >
            <div class="i-carbon-edit" />
            <span>编辑</span>
          </button>
          <button
            class="delete-btn flex-1 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors flex items-center justify-center gap-1"
            @click="confirmDelete(task)"
          >
            <div class="i-carbon-trash-can" />
            <span>删除</span>
          </button>
        </div>
      </div>
    </div>
    
    <Teleport to="body">
      <Transition name="confirm">
        <div
          v-if="showDeleteConfirm"
          class="confirm-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          @click.self="cancelDelete"
        >
          <div class="confirm-dialog bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div class="confirm-header p-6 text-center border-b border-gray-100">
              <div class="icon-wrapper w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <span class="text-3xl">⚠️</span>
              </div>
              <h3 class="text-lg font-bold text-gray-800">确认删除</h3>
              <p class="text-gray-500 mt-2 text-sm">
                确定要删除任务「{{ taskToDelete?.name }}」吗？
              </p>
              <p class="text-gray-400 text-xs mt-1">此操作无法撤销</p>
            </div>
            
            <div class="confirm-footer flex">
              <button
                class="cancel-btn flex-1 py-3 text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100"
                @click="cancelDelete"
              >
                取消
              </button>
              <button
                class="delete-btn flex-1 py-3 text-red-600 hover:bg-red-50 transition-colors font-medium"
                @click="executeDelete"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.task-cards {
  max-height: 500px;
  overflow-y: auto;
}

.task-cards::-webkit-scrollbar {
  width: 6px;
}

.task-cards::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.task-cards::-webkit-scrollbar-thumb {
  background: #c7c7c7;
  border-radius: 3px;
}

.task-cards::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.2s ease;
}

.confirm-enter-active .confirm-dialog,
.confirm-leave-active .confirm-dialog {
  transition: transform 0.2s ease;
}

.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}

.confirm-enter-from .confirm-dialog,
.confirm-leave-to .confirm-dialog {
  transform: scale(0.95);
}

select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  padding-right: 28px;
}
</style>
