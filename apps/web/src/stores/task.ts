import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Task, TaskStatus, TaskType } from '@/config/types'
import { loadTasks, addTask, updateTask, deleteTask, getTasksByDate } from '@/services/data-service'

interface TaskEditData {
  name: string
  description: string
  type: TaskType
  estimatedTime: number
  date: string
  status: TaskStatus
}

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const todayTasks = computed(() => {
    const today = new Date().toISOString().split('T')[0]
    return tasks.value.filter(task => task.date === today)
  })

  const pendingTasks = computed(() => {
    return tasks.value.filter(task => task.status === '未完成')
  })

  const completedTasks = computed(() => {
    return tasks.value.filter(task => task.status === '已完成')
  })

  const completionRate = computed(() => {
    const total = tasks.value.length
    if (total === 0) return 0
    const completed = completedTasks.value.length
    return Math.round((completed / total) * 100)
  })

  const totalEstimatedTime = computed(() => {
    return tasks.value.reduce((total, task) => total + task.estimatedTime, 0)
  })

  async function loadAllTasks(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await loadTasks()
      tasks.value = data.tasks
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载任务失败'
    } finally {
      isLoading.value = false
    }
  }

  async function loadTodayTasks(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const today = new Date().toISOString().split('T')[0]
      const todayTaskList = await getTasksByDate(today)
      tasks.value = todayTaskList
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载今日任务失败'
    } finally {
      isLoading.value = false
    }
  }

  async function createTask(taskData: Omit<Task, 'id' | 'createdAt'>): Promise<Task | null> {
    isLoading.value = true
    error.value = null
    try {
      const newTask = await addTask(taskData)
      if (newTask) {
        tasks.value.push(newTask)
        return newTask
      }
      return null
    } catch (err) {
      error.value = err instanceof Error ? err.message : '创建任务失败'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<boolean> {
    error.value = null
    try {
      const success = await updateTask(taskId, { status })
      if (success) {
        const taskIndex = tasks.value.findIndex(t => t.id === taskId)
        if (taskIndex !== -1) {
          tasks.value[taskIndex].status = status
          if (status === '已完成') {
            tasks.value[taskIndex].completedAt = new Date().toISOString()
          }
        }
        return true
      }
      return false
    } catch (err) {
      error.value = err instanceof Error ? err.message : '更新任务状态失败'
      return false
    }
  }

  async function removeTask(taskId: string): Promise<boolean> {
    error.value = null
    try {
      const success = await deleteTask(taskId)
      if (success) {
        tasks.value = tasks.value.filter(t => t.id !== taskId)
        return true
      }
      return false
    } catch (err) {
      error.value = err instanceof Error ? err.message : '删除任务失败'
      return false
    }
  }

  async function completeTask(taskId: string): Promise<boolean> {
    return await updateTaskStatus(taskId, '已完成')
  }

  async function editTask(taskId: string, taskData: TaskEditData): Promise<boolean> {
    error.value = null
    try {
      const success = await updateTask(taskId, taskData)
      if (success) {
        const taskIndex = tasks.value.findIndex(t => t.id === taskId)
        if (taskIndex !== -1) {
          tasks.value[taskIndex] = {
            ...tasks.value[taskIndex],
            ...taskData
          }
          if (taskData.status === '已完成' && !tasks.value[taskIndex].completedAt) {
            tasks.value[taskIndex].completedAt = new Date().toISOString()
          }
        }
        return true
      }
      return false
    } catch (err) {
      error.value = err instanceof Error ? err.message : '编辑任务失败'
      return false
    }
  }

  return {
    tasks,
    isLoading,
    error,
    todayTasks,
    pendingTasks,
    completedTasks,
    completionRate,
    totalEstimatedTime,
    loadAllTasks,
    loadTodayTasks,
    createTask,
    updateTaskStatus,
    removeTask,
    completeTask,
    editTask
  }
})
