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

const STORAGE_KEYS = {
  tasks: 'ai_study_tasks',
  exercises: 'ai_study_exercises',
  memory: 'ai_study_memory'
}

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

export async function loadTasks(): Promise<TasksData> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.tasks)
    if (stored) {
      return JSON.parse(stored)
    }
    const data = await fetchJson<TasksData>(`${DATA_BASE_URL}/tasks.json`)
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(data))
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
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(data))
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
    const stored = localStorage.getItem(STORAGE_KEYS.exercises)
    if (stored) {
      return JSON.parse(stored)
    }
    const data = await fetchJson<ExercisesData>(`${DATA_BASE_URL}/exercises.json`)
    localStorage.setItem(STORAGE_KEYS.exercises, JSON.stringify(data))
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
    localStorage.setItem(STORAGE_KEYS.exercises, JSON.stringify(data))
    return true
  } catch (error) {
    console.error('Failed to save exercises:', error)
    return false
  }
}

export async function addExercises(exercises: Omit<Exercise, 'id'>[]): Promise<Exercise[]> {
  try {
    const exercisesData = await loadExercises()
    
    const { generateExerciseHash } = await import('./exercise-parser')
    
    const existingHashes = new Set(
      exercisesData.exercises.map(e => e.hash || generateExerciseHash(e))
    )
    
    const uniqueExercises: Exercise[] = []
    for (const exercise of exercises) {
      const hash = generateExerciseHash(exercise)
      if (!existingHashes.has(hash)) {
        uniqueExercises.push({
          ...exercise,
          id: generateId(),
          hash,
          createdAt: getCurrentTimestamp(),
          status: 'pending'
        })
        existingHashes.add(hash)
      }
    }
    
    if (uniqueExercises.length === 0) {
      console.log('No new exercises to add (all duplicates)')
      return []
    }
    
    exercisesData.exercises.push(...uniqueExercises)
    const success = await saveExercises(exercisesData)
    
    console.log(`Added ${uniqueExercises.length} new exercises (${exercises.length - uniqueExercises.length} duplicates skipped)`)
    
    return success ? uniqueExercises : []
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

export async function archiveCompletedExercises(): Promise<void> {
  try {
    const exercisesData = await loadExercises()
    const memoryData = await loadMemory()
    
    const completedExercises = exercisesData.exercises.filter(
      e => e.status === 'completed'
    )
    
    if (completedExercises.length === 0) {
      return
    }
    
    for (const exercise of completedExercises) {
      memoryData.exerciseRecords.push({
        exerciseId: exercise.id,
        type: exercise.type,
        question: exercise.question,
        userAnswer: exercise.userAnswer || '',
        correctAnswer: exercise.answer,
        isCorrect: exercise.isCorrect || false,
        completedAt: exercise.completedAt || getCurrentTimestamp()
      })
    }
    
    exercisesData.exercises = exercisesData.exercises.filter(
      e => e.status !== 'completed'
    )
    
    await saveExercises(exercisesData)
    await saveMemory(memoryData)
    
    console.log(`Archived ${completedExercises.length} completed exercises`)
  } catch (error) {
    console.error('Failed to archive exercises:', error)
  }
}

export async function cleanupExpiredExercises(): Promise<void> {
  try {
    const exercisesData = await loadExercises()
    const memoryData = await loadMemory()
    const today = new Date().toISOString().split('T')[0]
    
    const expiredExercises = exercisesData.exercises.filter(e => {
      if (!e.createdAt) return false
      const createdDate = e.createdAt.split('T')[0]
      return createdDate !== today
    })
    
    if (expiredExercises.length === 0) {
      return
    }
    
    for (const exercise of expiredExercises) {
      memoryData.exerciseRecords.push({
        exerciseId: exercise.id,
        type: exercise.type,
        question: exercise.question,
        userAnswer: exercise.userAnswer || '',
        correctAnswer: exercise.answer,
        isCorrect: exercise.isCorrect || false,
        completedAt: exercise.completedAt || getCurrentTimestamp(),
        status: 'expired'
      })
    }
    
    exercisesData.exercises = exercisesData.exercises.filter(e => {
      if (!e.createdAt) return true
      const createdDate = e.createdAt.split('T')[0]
      return createdDate === today
    })
    
    await saveExercises(exercisesData)
    await saveMemory(memoryData)
    
    console.log(`Cleaned up ${expiredExercises.length} expired exercises`)
  } catch (error) {
    console.error('Failed to cleanup exercises:', error)
  }
}

export async function loadMemory(): Promise<MemoryData> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.memory)
    if (stored) {
      return JSON.parse(stored)
    }
    const data = await fetchJson<MemoryData>(`${DATA_BASE_URL}/memory.json`)
    localStorage.setItem(STORAGE_KEYS.memory, JSON.stringify(data))
    return data
  } catch (error) {
    console.error('Failed to load memory:', error)
    return {
      userId: 'default',
      createdAt: getCurrentTimestamp(),
      lastUpdated: getCurrentTimestamp(),
      profile: {
        name: '小橙子',
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
    localStorage.setItem(STORAGE_KEYS.memory, JSON.stringify(data))
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
  return `memory_backup_${year}${month}${day}`
}

function getBackupStorageKey(dateStr: string): string {
  return `ai_study_backup_${dateStr}`
}

export async function backupMemory(): Promise<boolean> {
  try {
    const memoryData = await loadMemory()
    const backupDate = new Date().toISOString().split('T')[0]
    const backupKey = getBackupStorageKey(backupDate)
    localStorage.setItem(backupKey, JSON.stringify(memoryData))
    console.log('Memory backup created:', backupDate)
    return true
  } catch (error) {
    console.error('Failed to backup memory:', error)
    return false
  }
}

export async function cleanOldBackups(daysToKeep: number = 7): Promise<boolean> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('ai_study_backup_')) {
        const dateStr = key.replace('ai_study_backup_', '')
        const backupDate = new Date(dateStr)
        if (backupDate < cutoffDate) {
          keysToRemove.push(key)
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    console.log(`Cleaned ${keysToRemove.length} old backups`)
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
