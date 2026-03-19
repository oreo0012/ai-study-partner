import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MemoryData, ConversationSummary, ExerciseRecord, LearningProgress } from '@/config/types'
import { loadMemory, saveMemory, updateMemory as updateMemoryData, addConversationSummary as addSummary, addExerciseRecord as addRecord } from '@/services/data-service'

export const useMemoryStore = defineStore('memory', () => {
  const memory = ref<MemoryData | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const hasMemory = computed(() => memory.value !== null)

  const consecutiveDays = computed(() => {
    return memory.value?.learningProgress.consecutiveDays ?? 0
  })

  const totalStudyTime = computed(() => {
    return memory.value?.learningProgress.totalStudyTime ?? 0
  })

  const completionRate = computed(() => {
    const progress = memory.value?.learningProgress
    if (!progress || progress.totalTasks === 0) return 0
    return Math.round((progress.completedTasks / progress.totalTasks) * 100)
  })

  const recentExerciseRecords = computed(() => {
    const records = memory.value?.exerciseRecords ?? []
    return records.slice(-5).reverse()
  })

  const favoriteSubjects = computed(() => {
    return memory.value?.preferences.favoriteSubjects ?? []
  })

  const weakPoints = computed(() => {
    const records = memory.value?.exerciseRecords ?? []
    const weakPoints: string[] = []
    records.forEach(record => {
      if (record.weakPoints) {
        weakPoints.push(...record.weakPoints)
      }
    })
    return [...new Set(weakPoints)]
  })

  async function loadMemoryData(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      memory.value = await loadMemory()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载记忆失败'
      console.error('Failed to load memory:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function saveMemoryData(): Promise<boolean> {
    if (!memory.value) return false
    try {
      return await saveMemory(memory.value)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '保存记忆失败'
      console.error('Failed to save memory:', err)
      return false
    }
  }

  async function updateLearningProgress(progress: Partial<LearningProgress>): Promise<void> {
    if (!memory.value) {
      await loadMemoryData()
    }
    if (!memory.value) return

    memory.value.learningProgress = {
      ...memory.value.learningProgress,
      ...progress
    }
    memory.value.lastUpdated = new Date().toISOString()
    await saveMemoryData()
  }

  async function incrementTaskCompletion(): Promise<void> {
    if (!memory.value) {
      await loadMemoryData()
    }
    if (!memory.value) return

    const progress = memory.value.learningProgress
    progress.totalTasks++
    progress.completedTasks++
    progress.completionRate = Math.round((progress.completedTasks / progress.totalTasks) * 100)
    memory.value.lastUpdated = new Date().toISOString()
    await saveMemoryData()
  }

  async function addStudyTime(minutes: number): Promise<void> {
    if (!memory.value) {
      await loadMemoryData()
    }
    if (!memory.value) return

    memory.value.learningProgress.totalStudyTime += minutes
    memory.value.lastUpdated = new Date().toISOString()
    await saveMemoryData()
  }

  async function addConversationSummaryItem(summary: ConversationSummary): Promise<void> {
    if (!memory.value) {
      await loadMemoryData()
    }
    if (!memory.value) return

    memory.value.conversationSummaries.push(summary)
    
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    memory.value.conversationSummaries = memory.value.conversationSummaries.filter(
      s => new Date(s.timestamp) > thirtyDaysAgo
    )
    
    memory.value.lastUpdated = new Date().toISOString()
    await saveMemoryData()
  }

  async function addExerciseRecordItem(record: ExerciseRecord): Promise<void> {
    if (!memory.value) {
      await loadMemoryData()
    }
    if (!memory.value) return

    memory.value.exerciseRecords.push(record)
    
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    memory.value.exerciseRecords = memory.value.exerciseRecords.filter(
      r => new Date(r.date) > thirtyDaysAgo
    )
    
    memory.value.lastUpdated = new Date().toISOString()
    await saveMemoryData()
  }

  async function updateConsecutiveDays(days: number): Promise<void> {
    if (!memory.value) {
      await loadMemoryData()
    }
    if (!memory.value) return

    memory.value.learningProgress.consecutiveDays = days
    memory.value.lastUpdated = new Date().toISOString()
    await saveMemoryData()
  }

  function getMemoryContext(): string {
    if (!memory.value) return ''

    const progress = memory.value.learningProgress
    const today = new Date().toISOString().split('T')[0]
    
    let context = `用户学习信息：
- 用户名：${memory.value.profile.name}
- 年级：${memory.value.profile.grade}
- 连续学习天数：${progress.consecutiveDays}天
- 总任务完成率：${progress.completionRate}%
- 今日学习时长：${progress.totalStudyTime}分钟
`

    if (memory.value.preferences.favoriteSubjects.length > 0) {
      context += `- 喜欢的科目：${memory.value.preferences.favoriteSubjects.join('、')}\n`
    }

    if (memory.value.preferences.bestStudyTime) {
      context += `- 最佳学习时间：${memory.value.preferences.bestStudyTime}\n`
    }

    if (weakPoints.value.length > 0) {
      context += `- 需要加强的知识点：${weakPoints.value.slice(0, 3).join('、')}\n`
    }

    const todayRecords = memory.value.exerciseRecords.filter(r => r.date === today)
    if (todayRecords.length > 0) {
      const todayScore = todayRecords.reduce((sum, r) => sum + r.score / r.total, 0) / todayRecords.length
      context += `- 今日练习正确率：${Math.round(todayScore * 100)}%\n`
    }

    return context
  }

  return {
    memory,
    isLoading,
    error,
    hasMemory,
    consecutiveDays,
    totalStudyTime,
    completionRate,
    recentExerciseRecords,
    favoriteSubjects,
    weakPoints,
    loadMemoryData,
    saveMemoryData,
    updateLearningProgress,
    incrementTaskCompletion,
    addStudyTime,
    addConversationSummaryItem,
    addExerciseRecordItem,
    updateConsecutiveDays,
    getMemoryContext
  }
})
