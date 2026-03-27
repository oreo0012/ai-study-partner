<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Task } from '@/config/types'

interface Props {
  tasks: Task[]
  completedCount: number
  totalCount: number
}

interface Emits {
  (e: 'task-complete', taskId: string): void
  (e: 'start-practice', taskId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isExpanded = ref(false)

const hasTasks = computed(() => props.totalCount > 0)

const progressPercent = computed(() =>
  props.totalCount > 0
    ? Math.round((props.completedCount / props.totalCount) * 100)
    : 0
)

const sortedTasks = computed(() => {
  return [...props.tasks].sort((a, b) => {
    if (a.status === '已完成' && b.status !== '已完成') return 1
    if (a.status !== '已完成' && b.status === '已完成') return -1
    return 0
  })
})

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

function handleCheckboxClick(task: Task) {
  if (task.status !== '已完成') {
    emit('task-complete', task.id)
  }
}

function handleStartPractice(task: Task) {
  emit('start-practice', task.id)
}

function getTaskTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    '学习': '📚',
    '练习': '✏️',
    '阅读': '📖',
    '其他': '⭐'
  }
  return icons[type] || '📋'
}
</script>

<template>
  <div
    v-if="hasTasks"
    class="task-panel mx-4 mb-2 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 shadow-sm transition-all duration-300 ease-in-out overflow-hidden"
    :class="isExpanded ? 'shadow-md' : 'shadow-sm'"
  >
    <!-- 收缩状态 -->
    <div
      v-if="!isExpanded"
      class="collapsed-header flex items-center justify-between px-4 py-3 cursor-pointer"
      @click="toggleExpand"
    >
      <div class="flex items-center gap-2">
        <span class="text-lg">📋</span>
        <span class="text-sm text-gray-700">
          今日学习任务已完成
          <span class="font-semibold text-amber-700">{{ completedCount }}/{{ totalCount }}</span>
        </span>
      </div>
      <button
        class="expand-btn flex items-center gap-1 rounded-lg bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 transition-colors duration-200 hover:bg-amber-200"
        @click.stop="toggleExpand"
      >
        <span>展开</span>
        <span class="text-xs">▼</span>
      </button>
    </div>

    <!-- 展开状态 -->
    <div v-else class="expanded-content">
      <!-- 标题栏 -->
      <div class="header flex items-center justify-between border-b border-amber-200 px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="text-lg">📋</span>
          <span class="font-medium text-gray-800">今日任务</span>
        </div>
        <button
          class="collapse-btn flex items-center gap-1 rounded-lg bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 transition-colors duration-200 hover:bg-amber-200"
          @click="toggleExpand"
        >
          <span>收起</span>
          <span class="text-xs">▲</span>
        </button>
      </div>

      <!-- 任务列表 -->
      <div class="task-list p-3 space-y-2">
        <div
          v-for="(task, index) in sortedTasks"
          :key="task.id"
          class="task-item flex items-center justify-between rounded-lg border px-3 py-2 transition-all duration-200"
          :class="[
            task.status === '已完成'
              ? 'border-green-200 bg-green-50/60'
              : 'border-gray-200 bg-white/60 hover:border-amber-300 hover:shadow-sm'
          ]"
        >
          <div class="flex items-center gap-3">
            <!-- 复选框 -->
            <button
              class="checkbox flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-all duration-200"
              :class="[
                task.status === '已完成'
                  ? 'border-green-500 bg-green-500 cursor-default'
                  : 'border-gray-300 cursor-pointer hover:border-amber-400 hover:bg-amber-50'
              ]"
              :disabled="task.status === '已完成'"
              @click="handleCheckboxClick(task)"
            >
              <svg
                v-if="task.status === '已完成'"
                class="h-3 w-3 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </button>

            <!-- 任务信息 -->
            <div class="flex flex-col">
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-500">{{ index + 1 }}.</span>
                <span class="text-sm" :class="task.status === '已完成' ? 'text-gray-500 line-through' : 'text-gray-800'">
                  {{ getTaskTypeIcon(task.type) }} {{ task.name }}
                </span>
              </div>
              <span v-if="task.status === '已完成'" class="mt-1 text-xs text-green-600">
                ✓ 已完成
              </span>
            </div>
          </div>

          <!-- 右侧操作区 -->
          <div class="flex items-center gap-2">
            <!-- 开始按钮（仅练习类型且未完成时显示） -->
            <button
              v-if="task.type === '练习' && task.status !== '已完成'"
              class="start-btn rounded-full bg-gradient-to-r from-orange-400 to-amber-500 px-4 py-1 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:from-orange-500 hover:to-amber-600 hover:shadow-md active:scale-95"
              @click="handleStartPractice(task)"
            >
              开始
            </button>
            <!-- 预计时间 -->
            <span class="text-xs text-gray-500">{{ task.estimatedTime }}分钟</span>
          </div>
        </div>
      </div>

      <!-- 进度条 -->
      <div class="progress-section border-t border-amber-200 px-4 py-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600">
            进度：{{ completedCount }}/{{ totalCount }} 完成 ({{ progressPercent }}%)
          </span>
        </div>
        <div class="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            class="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-panel {
  flex-shrink: 0;
}

.task-item {
  min-height: 44px;
}

.checkbox:disabled {
  cursor: default;
}

.checkbox:active:not(:disabled) {
  transform: scale(0.95);
}
</style>
