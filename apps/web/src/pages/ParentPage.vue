<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores'
import TaskCreator from '@/components/TaskCreator.vue'
import TaskList from '@/components/TaskList.vue'
import TaskEditor from '@/components/TaskEditor.vue'
import ExerciseUploader from '@/components/ExerciseUploader.vue'
import { addExercises } from '@/services/data-service'
import type { Task, TaskType, TaskStatus } from '@/config/types'
import type { ParsedExercise } from '@/services/exercise-parser'

const router = useRouter()
const taskStore = useTaskStore()

const isAuthenticated = ref(false)
const showPasswordDialog = ref(true)
const passwordInput = ref('')
const passwordError = ref('')
const correctPassword = '123456'

const activeTab = ref<'tasks' | 'exercises'>('tasks')

const isMobile = ref(false)

const showTaskCreator = ref(false)
const showTaskEditor = ref(false)
const currentEditTask = ref<Task | null>(null)

const uploadSuccess = ref(false)
const uploadMessage = ref('')

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  
  const authStatus = localStorage.getItem('parent_authenticated')
  if (authStatus === 'true') {
    isAuthenticated.value = true
    showPasswordDialog.value = false
  }
  
  taskStore.loadAllTasks()
})

const verifyPassword = () => {
  if (passwordInput.value === correctPassword) {
    isAuthenticated.value = true
    showPasswordDialog.value = false
    passwordError.value = ''
    localStorage.setItem('parent_authenticated', 'true')
  } else {
    passwordError.value = '密码错误，请重试'
    passwordInput.value = ''
  }
}

const logout = () => {
  isAuthenticated.value = false
  localStorage.removeItem('parent_authenticated')
  router.push('/')
}

const goBack = () => {
  router.push('/')
}

const openTaskCreator = () => {
  showTaskCreator.value = true
}

const closeTaskCreator = () => {
  showTaskCreator.value = false
}

const handleTaskSubmit = async (formData: {
  name: string
  description: string
  type: TaskType
  estimatedTime: number
  date: string
}) => {
  const newTask = await taskStore.createTask({
    name: formData.name,
    description: formData.description || undefined,
    type: formData.type,
    estimatedTime: formData.estimatedTime,
    date: formData.date,
    status: '未完成'
  })
  
  if (newTask) {
    await taskStore.loadAllTasks()
  }
}

const handleTaskEdit = (task: Task) => {
  currentEditTask.value = task
  showTaskEditor.value = true
}

const handleTaskSave = async (taskId: string, formData: {
  name: string
  description: string
  type: TaskType
  estimatedTime: number
  date: string
  status: TaskStatus
}) => {
  const success = await taskStore.editTask(taskId, formData)
  if (success) {
    await taskStore.loadAllTasks()
  }
}

const handleTaskDelete = async (taskId: string) => {
  const task = taskStore.tasks.find(t => t.id === taskId)
  
  if (task && task.exerciseIds && task.exerciseIds.length > 0) {
    const { deleteExercises } = await import('@/services/data-service')
    const success = await deleteExercises(task.exerciseIds)
    if (!success) {
      console.error('Failed to delete associated exercises')
      return
    }
  }
  
  const success = await taskStore.removeTask(taskId)
  if (success) {
    await taskStore.loadAllTasks()
  }
}

const handleTaskRefresh = async () => {
  await taskStore.loadAllTasks()
}

const closeTaskEditor = () => {
  showTaskEditor.value = false
  currentEditTask.value = null
}

const pendingTasksCount = computed(() => taskStore.pendingTasks.length)
const completedTasksCount = computed(() => taskStore.completedTasks.length)

const handleExerciseUpload = async (result: { exercises: ParsedExercise[]; filename: string }) => {
  try {
    const exercisesToAdd = result.exercises.map(ex => ({
      type: ex.type,
      question: ex.question,
      options: ex.options,
      answer: ex.answer,
      chapter: ex.chapter,
      subject: ex.subject
    }))
    
    const savedExercises = await addExercises(exercisesToAdd)
    
    if (savedExercises.length > 0) {
      const today = new Date().toISOString().split('T')[0]
      const taskName = `完成习题: ${result.filename.replace(/\.[^/.]+$/, '')}`
      
      const exerciseIds = savedExercises.map(ex => ex.id)
      
      await taskStore.createTask({
        name: taskName,
        description: `共 ${savedExercises.length} 道题目，包括选择题、填空题和简答题`,
        type: '练习',
        estimatedTime: Math.ceil(savedExercises.length * 3),
        date: today,
        status: '未完成',
        exerciseIds
      })
      
      uploadSuccess.value = true
      uploadMessage.value = `成功上传 ${savedExercises.length} 道习题，已自动关联到今日待办事项`
      
      setTimeout(() => {
        uploadSuccess.value = false
        uploadMessage.value = ''
      }, 5000)
    } else {
      uploadSuccess.value = true
      uploadMessage.value = `这 ${result.exercises.length} 道习题已存在，无需重复上传`
      
      setTimeout(() => {
        uploadSuccess.value = false
        uploadMessage.value = ''
      }, 5000)
    }
  } catch (error) {
    console.error('Failed to upload exercises:', error)
    uploadSuccess.value = false
    uploadMessage.value = '习题上传失败，请重试'
  }
}
</script>

<template>
  <div class="parent-page min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
    <div
      v-if="showPasswordDialog && !isAuthenticated"
      class="password-overlay fixed inset-0 flex items-center justify-center z-50 bg-black/30 backdrop-blur-sm"
    >
      <div class="password-dialog bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all">
        <div class="dialog-header text-center mb-6">
          <div class="icon-wrapper w-16 h-16 mx-auto mb-4 bg-indigo-100 rounded-full flex items-center justify-center">
            <span class="text-3xl">🔐</span>
          </div>
          <h2 class="text-2xl font-bold text-gray-800">家长验证</h2>
          <p class="text-gray-500 mt-2">请输入密码进入管理页面</p>
        </div>
        
        <div class="password-form">
          <div class="input-wrapper relative">
            <input
              v-model="passwordInput"
              type="password"
              placeholder="请输入密码"
              class="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
              @keyup.enter="verifyPassword"
            >
          </div>
          
          <p v-if="passwordError" class="error-message text-red-500 text-sm mt-2 text-center">
            {{ passwordError }}
          </p>
          
          <button
            class="verify-btn w-full mt-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl transition-colors"
            @click="verifyPassword"
          >
            验证
          </button>
          
          <button
            class="cancel-btn w-full mt-2 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-xl transition-colors"
            @click="goBack"
          >
            返回首页
          </button>
        </div>
      </div>
    </div>

    <div v-else class="main-container min-h-screen flex flex-col">
      <header class="header bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-40">
        <div class="header-content max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div class="left-section flex items-center gap-4">
            <button
              class="back-btn p-2 hover:bg-gray-100 rounded-xl transition-colors"
              @click="goBack"
              title="返回首页"
            >
              <div class="i-carbon-arrow-left text-xl text-gray-600" />
            </button>
            
            <div class="title-section">
              <h1 class="text-xl md:text-2xl font-bold text-gray-800">
                👨‍👩‍👧 家长管理页面
              </h1>
              <p class="text-xs md:text-sm text-gray-500">管理孩子的学习任务和习题</p>
            </div>
          </div>
          
          <div class="right-section flex items-center gap-2">
            <button
              class="logout-btn px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors"
              @click="logout"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      <div class="mobile-tabs md:hidden bg-white border-b sticky top-16 z-30">
        <div class="tabs-container flex">
          <button
            class="tab-btn flex-1 py-3 text-center font-medium transition-colors"
            :class="activeTab === 'tasks' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-gray-500'"
            @click="activeTab = 'tasks'"
          >
            📋 任务管理
          </button>
          <button
            class="tab-btn flex-1 py-3 text-center font-medium transition-colors"
            :class="activeTab === 'exercises' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-gray-500'"
            @click="activeTab = 'exercises'"
          >
            📝 习题上传
          </button>
        </div>
      </div>

      <main class="main-content flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div class="content-grid grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
          <div
            class="task-section bg-white rounded-2xl shadow-lg p-6 transition-all"
            :class="{ 'hidden md:block': activeTab !== 'tasks' && isMobile }"
          >
            <div class="section-header flex items-center justify-between mb-6">
              <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span class="text-2xl">📋</span>
                任务管理
              </h2>
              <div class="task-stats flex gap-2">
                <span class="stat-badge px-3 py-1 bg-amber-100 text-amber-700 text-sm rounded-full">
                  待完成: {{ pendingTasksCount }}
                </span>
                <span class="stat-badge px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full">
                  已完成: {{ completedTasksCount }}
                </span>
              </div>
            </div>
            
            <div class="task-content">
              <TaskList
                :tasks="taskStore.tasks"
                :is-loading="taskStore.isLoading"
                @edit="handleTaskEdit"
                @delete="handleTaskDelete"
                @refresh="handleTaskRefresh"
              />
              
              <button
                class="add-task-btn w-full mt-4 py-3 border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 rounded-xl transition-all flex items-center justify-center gap-2"
                @click="openTaskCreator"
              >
                <div class="i-carbon-add text-xl" />
                <span>添加新任务</span>
              </button>
            </div>
          </div>

          <div
            class="exercise-section bg-white rounded-2xl shadow-lg p-6 transition-all"
            :class="{ 'hidden md:block': activeTab !== 'exercises' && isMobile }"
          >
            <div class="section-header flex items-center justify-between mb-6">
              <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span class="text-2xl">📝</span>
                习题上传
              </h2>
            </div>
            
            <div class="exercise-content">
              <Transition name="fade">
                <div
                  v-if="uploadSuccess"
                  class="upload-success mb-4 p-4 bg-green-50 border border-green-200 rounded-xl"
                >
                  <div class="flex items-center gap-3">
                    <span class="text-xl">✅</span>
                    <p class="text-green-700 font-medium">{{ uploadMessage }}</p>
                  </div>
                </div>
              </Transition>
              
              <ExerciseUploader @upload="handleExerciseUpload" />
            </div>
          </div>
        </div>
      </main>
      
      <TaskCreator
        :visible="showTaskCreator"
        @close="closeTaskCreator"
        @submit="handleTaskSubmit"
      />
      
      <TaskEditor
        :visible="showTaskEditor"
        :task="currentEditTask"
        @close="closeTaskEditor"
        @save="handleTaskSave"
      />
    </div>
  </div>
</template>

<style scoped>
.parent-page {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.password-dialog {
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .header-content {
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  .title-section h1 {
    font-size: 1.125rem;
  }
  
  .logout-btn {
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
  }
  
  .task-stats {
    flex-wrap: wrap;
  }
  
  .stat-badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }
}
</style>
