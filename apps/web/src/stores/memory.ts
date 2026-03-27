import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  MemoryData, 
  ConversationSummary, 
  ExerciseRecord, 
  LearningProgress,
  ShortTermMemoryData,
  LongTermMemoryData,
  ChatMessage,
  DailySummary,
  TopicRecord,
  AccumulatedKnowledge
} from '@/config/types'
import { 
  loadMemory, 
  saveMemory, 
  updateMemory as updateMemoryData, 
  addConversationSummary as addSummary, 
  addExerciseRecord as addRecord 
} from '@/services/data-service'
import { shortTermMemoryService } from '@/services/short-term-memory'
import { longTermMemoryService } from '@/services/long-term-memory'
import { memoryArchiveService } from '@/services/memory-archive'

export const useMemoryStore = defineStore('memory', () => {
  const memory = ref<MemoryData | null>(null)
  const shortTermMemory = ref<ShortTermMemoryData | null>(null)
  const longTermMemory = ref<LongTermMemoryData | null>(null)
  const isLoading = ref(false)
  const isArchiveInProgress = ref(false)
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

  const todayMessages = computed(() => {
    return shortTermMemory.value?.messages ?? []
  })

  const recentSummaries = computed(() => {
    return longTermMemory.value?.dailySummaries.slice(-7) ?? []
  })

  const accumulatedKnowledge = computed(() => {
    return longTermMemory.value?.accumulatedKnowledge ?? {
      masteredTopics: [],
      weakTopics: [],
      totalStudyDays: 0,
      totalStudyHours: 0
    }
  })

  const totalStudyDaysFromLongTerm = computed(() => {
    return longTermMemory.value?.accumulatedKnowledge.totalStudyDays ?? 0
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

  async function loadShortTermMemoryData(): Promise<void> {
    try {
      shortTermMemory.value = await shortTermMemoryService.load()
    } catch (err) {
      console.error('Failed to load short-term memory:', err)
    }
  }

  async function loadLongTermMemoryData(): Promise<void> {
    try {
      longTermMemory.value = await longTermMemoryService.load()
    } catch (err) {
      console.error('Failed to load long-term memory:', err)
    }
  }

  async function loadAllMemory(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      await Promise.all([
        loadMemoryData(),
        loadShortTermMemoryData(),
        loadLongTermMemoryData()
      ])
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载记忆失败'
      console.error('Failed to load all memory:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function initializeMemory(llmCallFn?: (systemPrompt: string, userPrompt: string) => Promise<string>): Promise<void> {
    isLoading.value = true
    isArchiveInProgress.value = false
    error.value = null
    
    try {
      await loadShortTermMemoryData()
      
      const needsArchive = await memoryArchiveService.needsArchive()
      if (needsArchive) {
        isArchiveInProgress.value = true
        const result = await memoryArchiveService.checkAndArchive(llmCallFn)
        if (result.archived) {
          console.log('Memory archived successfully:', result.summary?.date)
        } else if (result.error) {
          console.error('Archive failed:', result.error)
        }
        isArchiveInProgress.value = false
      }
      
      await Promise.all([
        loadMemoryData(),
        loadShortTermMemoryData(),
        loadLongTermMemoryData()
      ])
      
      if (needsArchive && shortTermMemory.value) {
        shortTermMemory.value = await shortTermMemoryService.load()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '初始化记忆失败'
      console.error('Failed to initialize memory:', err)
    } finally {
      isLoading.value = false
      isArchiveInProgress.value = false
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
      r => r.date && new Date(r.date) > thirtyDaysAgo
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

  async function addMessageToShortTermMemory(
    role: 'user' | 'assistant',
    content: string,
    messageType?: 'text' | 'voice' | 'emotion',
    context?: { currentTask?: string; emotion?: string; intent?: string }
  ): Promise<boolean> {
    const success = await shortTermMemoryService.addMessage(role, content, messageType, context)
    if (success) {
      shortTermMemory.value = await shortTermMemoryService.load()
    }
    return success
  }

  async function getTodayMessages(): Promise<ChatMessage[]> {
    return shortTermMemoryService.getMessages()
  }

  async function getRecentSummariesList(count: number = 7): Promise<DailySummary[]> {
    return longTermMemoryService.getRecentSummaries(count)
  }

  async function getTopicRecord(topic: string): Promise<TopicRecord | null> {
    return longTermMemoryService.getTopicRecord(topic)
  }

  async function updateTopicRecord(topic: string, updates: Partial<TopicRecord>): Promise<boolean> {
    const success = await longTermMemoryService.updateTopicRecord(topic, updates)
    if (success) {
      longTermMemory.value = await longTermMemoryService.load()
    }
    return success
  }

  async function getWeakTopicsList(): Promise<TopicRecord[]> {
    return longTermMemoryService.getWeakTopics()
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
      const todayScore = todayRecords.reduce((sum, r) => sum + (r.score ?? 0) / (r.total ?? 1), 0) / todayRecords.length
      context += `- 今日练习正确率：${Math.round(todayScore * 100)}%\n`
    }

    return context
  }

  function getShortTermMemoryContext(): string {
    if (!shortTermMemory.value || shortTermMemory.value.messages.length === 0) {
      return ''
    }

    const messages = shortTermMemory.value.messages
    const recentMessages = messages.slice(-10)
    
    let context = `【今日对话记录摘要】\n`
    context += `日期：${shortTermMemory.value.date}\n`
    context += `对话条数：${messages.length}条\n`
    
    if (recentMessages.length > 0) {
      context += `\n最近对话：\n`
      recentMessages.forEach(msg => {
        const role = msg.role === 'user' ? '学生' : 'AI'
        const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        context += `[${time}] ${role}: ${msg.content.slice(0, 100)}${msg.content.length > 100 ? '...' : ''}\n`
      })
    }

    return context
  }

  function getLongTermMemoryContext(): string {
    if (!longTermMemory.value) {
      return ''
    }

    const knowledge = longTermMemory.value.accumulatedKnowledge
    const recentSummaries = longTermMemory.value.dailySummaries.slice(-3)
    
    let context = `【长期学习记忆】\n`
    context += `总学习天数：${knowledge.totalStudyDays}天\n`
    context += `总学习时长：${knowledge.totalStudyHours.toFixed(1)}小时\n`
    
    if (knowledge.masteredTopics.length > 0) {
      context += `已掌握知识点：${knowledge.masteredTopics.slice(0, 5).join('、')}\n`
    }
    
    if (knowledge.weakTopics.length > 0) {
      context += `薄弱知识点：${knowledge.weakTopics.slice(0, 3).join('、')}\n`
    }

    if (recentSummaries.length > 0) {
      context += `\n最近学习记录：\n`
      recentSummaries.forEach(summary => {
        context += `- ${summary.date}: ${summary.summary.slice(0, 80)}...\n`
      })
    }

    return context
  }

  function getContextForLLM(): string {
    const parts: string[] = []
    
    const memoryContext = getMemoryContext()
    if (memoryContext) {
      parts.push(memoryContext)
    }
    
    const shortTermContext = getShortTermMemoryContext()
    if (shortTermContext) {
      parts.push(shortTermContext)
    }
    
    const longTermContext = getLongTermMemoryContext()
    if (longTermContext) {
      parts.push(longTermContext)
    }

    return parts.join('\n---\n')
  }

  async function getPersonalizedGreeting(): Promise<string> {
    const hour = new Date().getHours()
    let timeGreeting = ''
    
    if (hour < 6) {
      timeGreeting = '夜深了'
    } else if (hour < 9) {
      timeGreeting = '早上好'
    } else if (hour < 12) {
      timeGreeting = '上午好'
    } else if (hour < 14) {
      timeGreeting = '中午好'
    } else if (hour < 18) {
      timeGreeting = '下午好'
    } else if (hour < 22) {
      timeGreeting = '晚上好'
    } else {
      timeGreeting = '夜深了'
    }

    const name = memory.value?.profile.name || '小朋友'
    const days = totalStudyDaysFromLongTerm.value
    
    let greeting = `${timeGreeting}呀${name}！`
    
    if (days > 0) {
      greeting += `你已经连续学习${days}天了，真棒！`
    }

    const weakTopics = await getWeakTopicsList()
    if (weakTopics.length > 0) {
      const topicNames = weakTopics.slice(0, 2).map(t => t.topic).join('和')
      greeting += `我注意到${topicNames}还需要练习，要不要今天复习一下？`
    }

    return greeting
  }

  return {
    memory,
    shortTermMemory,
    longTermMemory,
    isLoading,
    isArchiveInProgress,
    error,
    hasMemory,
    consecutiveDays,
    totalStudyTime,
    completionRate,
    recentExerciseRecords,
    favoriteSubjects,
    weakPoints,
    todayMessages,
    recentSummaries,
    accumulatedKnowledge,
    totalStudyDaysFromLongTerm,
    loadMemoryData,
    saveMemoryData,
    loadShortTermMemoryData,
    loadLongTermMemoryData,
    loadAllMemory,
    initializeMemory,
    updateLearningProgress,
    incrementTaskCompletion,
    addStudyTime,
    addConversationSummaryItem,
    addExerciseRecordItem,
    updateConsecutiveDays,
    addMessageToShortTermMemory,
    getTodayMessages,
    getRecentSummariesList,
    getTopicRecord,
    updateTopicRecord,
    getWeakTopicsList,
    getMemoryContext,
    getShortTermMemoryContext,
    getLongTermMemoryContext,
    getContextForLLM,
    getPersonalizedGreeting
  }
})
