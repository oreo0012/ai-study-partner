import type {
  Task,
  TasksData,
  Exercise,
  ExercisesData,
  MemoryData,
  ConversationSummary,
  ExerciseRecord
} from '@/config/types'

const DATA_BASE_URL = '/data'
const API_BASE_URL = '/api/data'

function getCurrentTimestamp(): string {
  return new Date().toISOString()
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

async function postJson<T>(url: string, data: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    throw new Error(`Failed to post ${url}: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

export async function loadTasks(): Promise<TasksData> {
  try {
    const data = await fetchJson<TasksData>(`${DATA_BASE_URL}/tasks.json`)
    return data
  } catch (error) {
    console.error('Failed to load tasks:', error)
    return {
      tasks: [],
      lastUpdated: getCurrentTimestamp()
    }
  }
}

export async function saveTasks(data: TasksData): Promise<boolean> {
  try {
    data.lastUpdated = getCurrentTimestamp()
    await postJson(`${API_BASE_URL}/tasks`, data)
    return true
  } catch (error) {
    console.error('Failed to save tasks:', error)
    return false
  }
}

export async function addTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task | null> {
  try {
    const tasksData = await loadTasks()
    const newTask: Task = {
      ...task,
      id: generateId(),
      createdAt: getCurrentTimestamp()
    }
    tasksData.tasks.push(newTask)
    const success = await saveTasks(tasksData)
    return success ? newTask : null
  } catch (error) {
    console.error('Failed to add task:', error)
    return null
  }
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<boolean> {
  try {
    const tasksData = await loadTasks()
    const index = tasksData.tasks.findIndex(t => t.id === taskId)
    if (index === -1) {
      console.error('Task not found:', taskId)
      return false
    }
    tasksData.tasks[index] = {
      ...tasksData.tasks[index],
      ...updates
    }
    if (updates.status === '已完成' && !tasksData.tasks[index].completedAt) {
      tasksData.tasks[index].completedAt = getCurrentTimestamp()
    }
    return await saveTasks(tasksData)
  } catch (error) {
    console.error('Failed to update task:', error)
    return false
  }
}

export async function deleteTask(taskId: string): Promise<boolean> {
  try {
    const tasksData = await loadTasks()
    const index = tasksData.tasks.findIndex(t => t.id === taskId)
    if (index === -1) {
      console.error('Task not found:', taskId)
      return false
    }
    tasksData.tasks.splice(index, 1)
    return await saveTasks(tasksData)
  } catch (error) {
    console.error('Failed to delete task:', error)
    return false
  }
}

export async function getTasksByDate(date: string): Promise<Task[]> {
  try {
    const tasksData = await loadTasks()
    return tasksData.tasks.filter(t => t.date === date)
  } catch (error) {
    console.error('Failed to get tasks by date:', error)
    return []
  }
}

export async function loadExercises(): Promise<ExercisesData> {
  try {
    const data = await fetchJson<ExercisesData>(`${DATA_BASE_URL}/exercises.json`)
    return data
  } catch (error) {
    console.error('Failed to load exercises:', error)
    return {
      exercises: [],
      lastUpdated: getCurrentTimestamp()
    }
  }
}

export async function saveExercises(data: ExercisesData): Promise<boolean> {
  try {
    data.lastUpdated = getCurrentTimestamp()
    await postJson(`${API_BASE_URL}/exercises`, data)
    return true
  } catch (error) {
    console.error('Failed to save exercises:', error)
    return false
  }
}

export async function addExercises(exercises: Omit<Exercise, 'id'>[]): Promise<Exercise[]> {
  try {
    const exercisesData = await loadExercises()
    const newExercises: Exercise[] = exercises.map(e => ({
      ...e,
      id: generateId()
    }))
    exercisesData.exercises.push(...newExercises)
    const success = await saveExercises(exercisesData)
    return success ? newExercises : []
  } catch (error) {
    console.error('Failed to add exercises:', error)
    return []
  }
}

export async function deleteExercises(exerciseIds: string[]): Promise<boolean> {
  try {
    const exercisesData = await loadExercises()
    exercisesData.exercises = exercisesData.exercises.filter(
      e => !exerciseIds.includes(e.id)
    )
    return await saveExercises(exercisesData)
  } catch (error) {
    console.error('Failed to delete exercises:', error)
    return false
  }
}

export async function loadMemory(): Promise<MemoryData> {
  try {
    const data = await fetchJson<MemoryData>(`${DATA_BASE_URL}/memory.json`)
    return data
  } catch (error) {
    console.error('Failed to load memory:', error)
    return {
      userId: 'default',
      createdAt: getCurrentTimestamp(),
      lastUpdated: getCurrentTimestamp(),
      profile: {
        name: '小朋友',
        age: 8,
        grade: '二年级'
      },
      learningProgress: {
        totalTasks: 0,
        completedTasks: 0,
        completionRate: 0,
        totalStudyTime: 0,
        consecutiveDays: 0
      },
      exerciseRecords: [],
      conversationSummaries: [],
      preferences: {
        favoriteSubjects: [],
        learningStyle: '',
        bestStudyTime: ''
      }
    }
  }
}

export async function saveMemory(data: MemoryData): Promise<boolean> {
  try {
    data.lastUpdated = getCurrentTimestamp()
    await postJson(`${API_BASE_URL}/memory`, data)
    return true
  } catch (error) {
    console.error('Failed to save memory:', error)
    return false
  }
}

export async function updateMemory(updates: Partial<MemoryData>): Promise<boolean> {
  try {
    const memoryData = await loadMemory()
    const updatedData: MemoryData = {
      ...memoryData,
      ...updates,
      profile: {
        ...memoryData.profile,
        ...(updates.profile || {})
      },
      learningProgress: {
        ...memoryData.learningProgress,
        ...(updates.learningProgress || {})
      },
      preferences: {
        ...memoryData.preferences,
        ...(updates.preferences || {})
      }
    }
    return await saveMemory(updatedData)
  } catch (error) {
    console.error('Failed to update memory:', error)
    return false
  }
}

export async function addConversationSummary(summary: Omit<ConversationSummary, 'timestamp'>): Promise<boolean> {
  try {
    const memoryData = await loadMemory()
    const newSummary: ConversationSummary = {
      ...summary,
      timestamp: getCurrentTimestamp()
    }
    memoryData.conversationSummaries.push(newSummary)
    return await saveMemory(memoryData)
  } catch (error) {
    console.error('Failed to add conversation summary:', error)
    return false
  }
}

export async function addExerciseRecord(record: Omit<ExerciseRecord, 'date'> & { date?: string }): Promise<boolean> {
  try {
    const memoryData = await loadMemory()
    const newRecord: ExerciseRecord = {
      ...record,
      date: record.date || getCurrentTimestamp().split('T')[0]
    }
    memoryData.exerciseRecords.push(newRecord)
    return await saveMemory(memoryData)
  } catch (error) {
    console.error('Failed to add exercise record:', error)
    return false
  }
}

function getBackupFileName(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `memory_backup_${year}${month}${day}.json`
}

export async function backupMemory(): Promise<boolean> {
  try {
    const memoryData = await loadMemory()
    const backupFileName = getBackupFileName()
    await postJson(`${API_BASE_URL}/backup`, {
      filename: backupFileName,
      data: memoryData
    })
    console.log('Memory backup created:', backupFileName)
    return true
  } catch (error) {
    console.error('Failed to backup memory:', error)
    return false
  }
}

export async function cleanOldBackups(daysToKeep: number = 7): Promise<boolean> {
  try {
    await postJson(`${API_BASE_URL}/clean-backups`, { daysToKeep })
    console.log(`Cleaned backups older than ${daysToKeep} days`)
    return true
  } catch (error) {
    console.error('Failed to clean old backups:', error)
    return false
  }
}

export const dataService = {
  loadTasks,
  saveTasks,
  addTask,
  updateTask,
  deleteTask,
  getTasksByDate,
  loadExercises,
  saveExercises,
  addExercises,
  deleteExercises,
  loadMemory,
  saveMemory,
  updateMemory,
  addConversationSummary,
  addExerciseRecord,
  backupMemory,
  cleanOldBackups
}

export default dataService
