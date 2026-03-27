import type {
  Task,
  TasksData,
  Exercise,
  ExercisesData,
  MemoryData,
  ConversationSummary,
  ExerciseRecord,
  ShortTermMemoryData,
  LongTermMemoryData,
  DailySummary,
  TopicRecord,
  AccumulatedKnowledge
} from '@/config/types'

const DATA_BASE_URL = '/data'
const API_BASE_URL = '/api/data'

const STORAGE_KEYS = {
  tasks: 'ai_study_tasks',
  exercises: 'ai_study_exercises',
  memory: 'ai_study_memory',
  shortTermMemory: 'ai_study_short_term_memory',
  longTermMemory: 'ai_study_long_term_memory'
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

// ==================== 短期记忆数据服务 ====================

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

function createEmptyShortTermMemory(): ShortTermMemoryData {
  const now = getCurrentTimestamp()
  const today = getTodayDateString()
  return {
    date: today,
    userId: 'child_001',
    messages: [],
    metadata: {
      totalMessages: 0,
      sessionCount: 0,
      lastSessionTime: ''
    },
    createdAt: now,
    lastUpdated: now
  }
}

export async function loadShortTermMemory(): Promise<ShortTermMemoryData> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.shortTermMemory)
    if (stored) {
      return JSON.parse(stored)
    }
    const data = await fetchJson<ShortTermMemoryData>(`${DATA_BASE_URL}/short-term-memory.json`)
    if (data && data.date) {
      localStorage.setItem(STORAGE_KEYS.shortTermMemory, JSON.stringify(data))
      return data
    }
    return createEmptyShortTermMemory()
  } catch (error) {
    console.error('Failed to load short-term memory:', error)
    return createEmptyShortTermMemory()
  }
}

export async function saveShortTermMemory(data: ShortTermMemoryData): Promise<boolean> {
  try {
    data.lastUpdated = getCurrentTimestamp()
    localStorage.setItem(STORAGE_KEYS.shortTermMemory, JSON.stringify(data))
    return true
  } catch (error) {
    console.error('Failed to save short-term memory:', error)
    return false
  }
}

export function getShortTermMemoryDate(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.shortTermMemory)
    if (stored) {
      const data = JSON.parse(stored) as ShortTermMemoryData
      return data.date || null
    }
    return null
  } catch (error) {
    console.error('Failed to get short-term memory date:', error)
    return null
  }
}

export async function clearShortTermMemory(): Promise<boolean> {
  try {
    const emptyMemory = createEmptyShortTermMemory()
    return await saveShortTermMemory(emptyMemory)
  } catch (error) {
    console.error('Failed to clear short-term memory:', error)
    return false
  }
}

// ==================== 长期记忆数据服务 ====================

function createEmptyLongTermMemory(): LongTermMemoryData {
  const now = getCurrentTimestamp()
  return {
    userId: 'child_001',
    dailySummaries: [],
    topicRecords: {},
    accumulatedKnowledge: {
      masteredTopics: [],
      weakTopics: [],
      totalStudyDays: 0,
      totalStudyHours: 0
    },
    createdAt: now,
    lastUpdated: now
  }
}

export async function loadLongTermMemory(): Promise<LongTermMemoryData> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.longTermMemory)
    if (stored) {
      const data = JSON.parse(stored)
      if (data && data.dailySummaries) {
        return data
      }
    }
    const data = await fetchJson<LongTermMemoryData>(`${DATA_BASE_URL}/long-term-memory.json`)
    if (data && data.dailySummaries) {
      localStorage.setItem(STORAGE_KEYS.longTermMemory, JSON.stringify(data))
      return data
    }
    return createEmptyLongTermMemory()
  } catch (error) {
    console.error('Failed to load long-term memory:', error)
    return createEmptyLongTermMemory()
  }
}

export async function saveLongTermMemory(data: LongTermMemoryData): Promise<boolean> {
  try {
    data.lastUpdated = getCurrentTimestamp()
    localStorage.setItem(STORAGE_KEYS.longTermMemory, JSON.stringify(data))
    return true
  } catch (error) {
    console.error('Failed to save long-term memory:', error)
    return false
  }
}

export async function addDailySummary(summary: DailySummary): Promise<boolean> {
  try {
    const longTermMemory = await loadLongTermMemory()
    const existingIndex = longTermMemory.dailySummaries.findIndex(s => s.date === summary.date)
    if (existingIndex >= 0) {
      longTermMemory.dailySummaries[existingIndex] = summary
    } else {
      longTermMemory.dailySummaries.push(summary)
    }
    longTermMemory.dailySummaries.sort((a, b) => a.date.localeCompare(b.date))
    if (longTermMemory.dailySummaries.length > 90) {
      longTermMemory.dailySummaries = longTermMemory.dailySummaries.slice(-90)
    }
    return await saveLongTermMemory(longTermMemory)
  } catch (error) {
    console.error('Failed to add daily summary:', error)
    return false
  }
}

export async function getDailySummaries(startDate: string, endDate: string): Promise<DailySummary[]> {
  try {
    const longTermMemory = await loadLongTermMemory()
    return longTermMemory.dailySummaries.filter(
      s => s.date >= startDate && s.date <= endDate
    )
  } catch (error) {
    console.error('Failed to get daily summaries:', error)
    return []
  }
}

export async function getRecentSummaries(count: number = 7): Promise<DailySummary[]> {
  try {
    const longTermMemory = await loadLongTermMemory()
    return longTermMemory.dailySummaries.slice(-count)
  } catch (error) {
    console.error('Failed to get recent summaries:', error)
    return []
  }
}

export async function updateAccumulatedKnowledge(updates: Partial<AccumulatedKnowledge>): Promise<boolean> {
  try {
    const longTermMemory = await loadLongTermMemory()
    longTermMemory.accumulatedKnowledge = {
      ...longTermMemory.accumulatedKnowledge,
      ...updates
    }
    return await saveLongTermMemory(longTermMemory)
  } catch (error) {
    console.error('Failed to update accumulated knowledge:', error)
    return false
  }
}

export async function getTopicRecord(topic: string): Promise<TopicRecord | null> {
  try {
    const longTermMemory = await loadLongTermMemory()
    return longTermMemory.topicRecords[topic] || null
  } catch (error) {
    console.error('Failed to get topic record:', error)
    return null
  }
}

export async function updateTopicRecord(topic: string, updates: Partial<TopicRecord>): Promise<boolean> {
  try {
    const longTermMemory = await loadLongTermMemory()
    const existingRecord = longTermMemory.topicRecords[topic]
    if (existingRecord) {
      longTermMemory.topicRecords[topic] = {
        ...existingRecord,
        ...updates
      }
    } else {
      longTermMemory.topicRecords[topic] = {
        topic,
        firstLearnedDate: getTodayDateString(),
        lastReviewDate: getTodayDateString(),
        masteryLevel: '未掌握',
        practiceCount: 0,
        correctRate: 0,
        relatedQuestions: [],
        notes: '',
        ...updates
      }
    }
    return await saveLongTermMemory(longTermMemory)
  } catch (error) {
    console.error('Failed to update topic record:', error)
    return false
  }
}

export async function searchTopicsByKeyword(keyword: string): Promise<TopicRecord[]> {
  try {
    const longTermMemory = await loadLongTermMemory()
    const results: TopicRecord[] = []
    for (const [topicName, record] of Object.entries(longTermMemory.topicRecords)) {
      if (topicName.includes(keyword) || record.notes.includes(keyword)) {
        results.push(record)
      }
    }
    return results
  } catch (error) {
    console.error('Failed to search topics:', error)
    return []
  }
}

export async function getWeakTopics(): Promise<TopicRecord[]> {
  try {
    const longTermMemory = await loadLongTermMemory()
    const weakTopics: TopicRecord[] = []
    for (const record of Object.values(longTermMemory.topicRecords)) {
      if (record.masteryLevel === '未掌握' || record.masteryLevel === '初步理解') {
        weakTopics.push(record)
      }
    }
    return weakTopics
  } catch (error) {
    console.error('Failed to get weak topics:', error)
    return []
  }
}

export async function getMasteredTopics(): Promise<TopicRecord[]> {
  try {
    const longTermMemory = await loadLongTermMemory()
    const masteredTopics: TopicRecord[] = []
    for (const record of Object.values(longTermMemory.topicRecords)) {
      if (record.masteryLevel === '基本掌握' || record.masteryLevel === '熟练掌握') {
        masteredTopics.push(record)
      }
    }
    return masteredTopics
  } catch (error) {
    console.error('Failed to get mastered topics:', error)
    return []
  }
}

// ==================== 记忆备份服务 ====================

export async function backupMemoryWithType(type: 'short' | 'long'): Promise<boolean> {
  try {
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupKey = `ai_study_memory_backup_${type}_${timestamp}`
    
    if (type === 'short') {
      const data = await loadShortTermMemory()
      localStorage.setItem(backupKey, JSON.stringify(data))
    } else {
      const data = await loadLongTermMemory()
      localStorage.setItem(backupKey, JSON.stringify(data))
    }
    console.log(`Memory backup created: ${backupKey}`)
    return true
  } catch (error) {
    console.error('Failed to backup memory:', error)
    return false
  }
}

export async function restoreMemoryFromBackup(type: 'short' | 'long'): Promise<boolean> {
  try {
    const prefix = `ai_study_memory_backup_${type}_`
    const backupKeys: string[] = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        backupKeys.push(key)
      }
    }
    
    if (backupKeys.length === 0) {
      console.log('No backup found')
      return false
    }
    
    backupKeys.sort().reverse()
    const latestBackupKey = backupKeys[0]
    const backupData = localStorage.getItem(latestBackupKey)
    
    if (!backupData) {
      return false
    }
    
    if (type === 'short') {
      localStorage.setItem(STORAGE_KEYS.shortTermMemory, backupData)
    } else {
      localStorage.setItem(STORAGE_KEYS.longTermMemory, backupData)
    }
    
    console.log(`Memory restored from: ${latestBackupKey}`)
    return true
  } catch (error) {
    console.error('Failed to restore memory from backup:', error)
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
