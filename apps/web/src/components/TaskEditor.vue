<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Task, TaskType, TaskStatus } from '@/config/types'

interface TaskEditData {
  name: string
  description: string
  type: TaskType
  estimatedTime: number
  date: string
  status: TaskStatus
}

const props = defineProps<{
  visible: boolean
  task: Task | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', taskId: string, data: TaskEditData): void
}>()

const taskTypes: TaskType[] = ['学习', '练习', '阅读', '其他']
const taskStatuses: TaskStatus[] = ['未完成', '已完成']

const availableDates = computed(() => {
  const dates = []
  for (let i = -7; i < 14; i++) {
    const date = new Date()
    date.setDate(date.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]
    let label = ''
    if (i === 0) label = '今天'
    else if (i === 1) label = '明天'
    else if (i === -1) label = '昨天'
    else label = `${date.getMonth() + 1}月${date.getDate()}日`
    
    dates.push({
      value: dateStr,
      label: label
    })
  }
  return dates
})

const formData = ref<TaskEditData>({
  name: '',
  description: '',
  type: '学习',
  estimatedTime: 30,
  date: new Date().toISOString().split('T')[0],
  status: '未完成'
})

const errors = ref<Record<string, string>>({})
const isSubmitting = ref(false)
const submitMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

watch(() => props.visible, (newVal) => {
  if (newVal && props.task) {
    populateForm()
  }
})

watch(() => props.task, (newTask) => {
  if (newTask && props.visible) {
    populateForm()
  }
})

function populateForm() {
  if (props.task) {
    formData.value = {
      name: props.task.name,
      description: props.task.description || '',
      type: props.task.type,
      estimatedTime: props.task.estimatedTime,
      date: props.task.date,
      status: props.task.status
    }
    errors.value = {}
    submitMessage.value = null
  }
}

function validateForm(): boolean {
  errors.value = {}
  
  if (!formData.value.name.trim()) {
    errors.value.name = '请输入任务名称'
  } else if (formData.value.name.length > 50) {
    errors.value.name = '任务名称不能超过50个字符'
  }
  
  if (formData.value.description.length > 200) {
    errors.value.description = '任务描述不能超过200个字符'
  }
  
  if (!formData.value.estimatedTime || formData.value.estimatedTime <= 0) {
    errors.value.estimatedTime = '请输入有效的预计时间'
  } else if (formData.value.estimatedTime > 480) {
    errors.value.estimatedTime = '预计时间不能超过480分钟（8小时）'
  }
  
  if (!formData.value.date) {
    errors.value.date = '请选择任务日期'
  }
  
  return Object.keys(errors.value).length === 0
}

async function handleSubmit() {
  if (!validateForm()) {
    return
  }
  
  if (!props.task) {
    submitMessage.value = { type: 'error', text: '任务不存在' }
    return
  }
  
  isSubmitting.value = true
  submitMessage.value = null
  
  try {
    emit('save', props.task.id, { ...formData.value })
    submitMessage.value = { type: 'success', text: '任务更新成功！' }
    
    setTimeout(() => {
      emit('close')
    }, 800)
  } catch (error) {
    submitMessage.value = { type: 'error', text: '任务更新失败，请重试' }
  } finally {
    isSubmitting.value = false
  }
}

function handleClose() {
  emit('close')
}

function handleOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    handleClose()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="visible && task"
        class="dialog-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
        @click="handleOverlayClick"
      >
        <div class="dialog-container bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div class="dialog-header flex items-center justify-between p-6 border-b border-gray-100">
            <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span class="text-2xl">✏️</span>
              编辑任务
            </h2>
            <button
              class="close-btn w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              @click="handleClose"
            >
              <div class="i-carbon-close text-xl text-gray-500" />
            </button>
          </div>
          
          <form class="dialog-body p-6 space-y-5" @submit.prevent="handleSubmit">
            <div class="form-group">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                任务名称 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="formData.name"
                type="text"
                placeholder="请输入任务名称"
                maxlength="50"
                class="w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
                :class="errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'"
              >
              <div class="flex justify-between mt-1">
                <span v-if="errors.name" class="text-red-500 text-xs">{{ errors.name }}</span>
                <span class="text-gray-400 text-xs ml-auto">{{ formData.name.length }}/50</span>
              </div>
            </div>
            
            <div class="form-group">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                任务描述
              </label>
              <textarea
                v-model="formData.description"
                placeholder="请输入任务描述（可选）"
                maxlength="200"
                rows="3"
                class="w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors resize-none"
                :class="errors.description ? 'border-red-300 bg-red-50' : 'border-gray-200'"
              />
              <div class="flex justify-between mt-1">
                <span v-if="errors.description" class="text-red-500 text-xs">{{ errors.description }}</span>
                <span class="text-gray-400 text-xs ml-auto">{{ formData.description.length }}/200</span>
              </div>
            </div>
            
            <div class="form-group">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                任务类型
              </label>
              <div class="relative">
                <select
                  v-model="formData.type"
                  class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors appearance-none bg-white cursor-pointer"
                >
                  <option v-for="type in taskTypes" :key="type" :value="type">
                    {{ type }}
                  </option>
                </select>
                <div class="i-carbon-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            
            <div class="form-group">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                任务状态
              </label>
              <div class="relative">
                <select
                  v-model="formData.status"
                  class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors appearance-none bg-white cursor-pointer"
                >
                  <option v-for="status in taskStatuses" :key="status" :value="status">
                    {{ status }}
                  </option>
                </select>
                <div class="i-carbon-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            
            <div class="form-group">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                预计完成时间（分钟） <span class="text-red-500">*</span>
              </label>
              <input
                v-model.number="formData.estimatedTime"
                type="number"
                min="1"
                max="480"
                placeholder="请输入预计时间"
                class="w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
                :class="errors.estimatedTime ? 'border-red-300 bg-red-50' : 'border-gray-200'"
              >
              <span v-if="errors.estimatedTime" class="text-red-500 text-xs mt-1 block">
                {{ errors.estimatedTime }}
              </span>
            </div>
            
            <div class="form-group">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                任务日期
              </label>
              <div class="relative">
                <select
                  v-model="formData.date"
                  class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors appearance-none bg-white cursor-pointer"
                >
                  <option v-for="date in availableDates" :key="date.value" :value="date.value">
                    {{ date.label }} ({{ date.value }})
                  </option>
                </select>
                <div class="i-carbon-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <span v-if="errors.date" class="text-red-500 text-xs mt-1 block">
                {{ errors.date }}
              </span>
            </div>
            
            <div
              v-if="submitMessage"
              class="message-box p-3 rounded-xl flex items-center gap-2"
              :class="submitMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
            >
              <div
                :class="submitMessage.type === 'success' ? 'i-carbon-checkmark-filled' : 'i-carbon-close-filled'"
              />
              <span class="text-sm">{{ submitMessage.text }}</span>
            </div>
            
            <div class="dialog-footer flex gap-3 pt-4">
              <button
                type="button"
                class="cancel-btn flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-xl transition-colors"
                @click="handleClose"
              >
                取消
              </button>
              <button
                type="submit"
                class="submit-btn flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                :disabled="isSubmitting"
              >
                <div v-if="isSubmitting" class="i-carbon-circle-dash animate-spin" />
                <span>{{ isSubmitting ? '保存中...' : '保存修改' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-enter-active .dialog-container,
.dialog-leave-active .dialog-container {
  transition: transform 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .dialog-container,
.dialog-leave-to .dialog-container {
  transform: scale(0.95);
}

select::-ms-expand {
  display: none;
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
}
</style>
