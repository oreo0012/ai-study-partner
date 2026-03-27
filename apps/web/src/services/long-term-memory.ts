import type { 
  LongTermMemoryData, 
  DailySummary, 
  TopicRecord, 
  AccumulatedKnowledge,
  MasteryLevel,
  TopicSearchResult
} from '@/config/types'
import { 
  loadLongTermMemory, 
  saveLongTermMemory,
  getTopicRecord as getTopicRecordFromStorage,
  updateTopicRecord as updateTopicRecordInStorage,
  searchTopicsByKeyword as searchTopicsInStorage,
  getWeakTopics as getWeakTopicsFromStorage,
  getMasteredTopics as getMasteredTopicsFromStorage,
  getRecentSummaries as getRecentSummariesFromStorage,
  getDailySummaries,
  updateAccumulatedKnowledge as updateAccumulatedKnowledgeInStorage,
  addDailySummary as addDailySummaryToStorage
} from './data-service'
import { memoryLogger } from './memory-logger'

const MAX_DAILY_SUMMARIES = 90

function getCurrentTimestamp(): string {
  return new Date().toISOString()
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

function createEmptyMemory(): LongTermMemoryData {
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

class LongTermMemoryService {
  private cache: LongTermMemoryData | null = null
  private isLoaded = false

  async load(): Promise<LongTermMemoryData> {
    const startTime = Date.now()
    
    if (this.isLoaded && this.cache) {
      memoryLogger.logMemoryLoad('success', this.cache.dailySummaries.length)
      return this.cache
    }
    
    try {
      const data = await loadLongTermMemory()
      this.cache = data
      this.isLoaded = true
      
      const duration = Date.now() - startTime
      memoryLogger.logMemoryLoad('success', data.dailySummaries.length)
      console.log(`[长期记忆] 加载完成，耗时 ${duration}ms，共 ${data.dailySummaries.length} 条日总结`)
      
      return data
    } catch (error) {
      const duration = Date.now() - startTime
      memoryLogger.logMemoryLoad('failed', 0)
      console.error('Failed to load long-term memory:', error)
      this.cache = createEmptyMemory()
      this.isLoaded = true
      return this.cache
    }
  }

  async save(data: LongTermMemoryData): Promise<boolean> {
    const startTime = Date.now()
    const beforeData = this.cache ? { 
      summariesCount: this.cache.dailySummaries.length,
      topicsCount: Object.keys(this.cache.topicRecords).length 
    } : null
    
    try {
      data.lastUpdated = getCurrentTimestamp()
      const success = await saveLongTermMemory(data)
      
      const duration = Date.now() - startTime
      const afterData = { 
        summariesCount: data.dailySummaries.length,
        topicsCount: Object.keys(data.topicRecords).length 
      }
      
      if (success) {
        this.cache = data
        memoryLogger.logMemorySave('success', data.dailySummaries.length)
        memoryLogger.logMemoryUpdate(beforeData, afterData, ['dailySummaries', 'topicRecords'])
        console.log(`[长期记忆] 保存完成，耗时 ${duration}ms，共 ${data.dailySummaries.length} 条日总结`)
      }
      
      return success
    } catch (error) {
      const duration = Date.now() - startTime
      memoryLogger.logMemorySave('failed', 0)
      console.error('Failed to save long-term memory:', error)
      return false
    }
  }

  async addDailySummary(summary: DailySummary): Promise<boolean> {
    const startTime = Date.now()
    
    try {
      const memory = await this.load()
      const beforeCount = memory.dailySummaries.length
      
      const existingIndex = memory.dailySummaries.findIndex(s => s.date === summary.date)
      if (existingIndex >= 0) {
        memory.dailySummaries[existingIndex] = summary
        console.log(`[长期记忆] 更新已有日总结: ${summary.date}`)
      } else {
        memory.dailySummaries.push(summary)
        console.log(`[长期记忆] 添加新日总结: ${summary.date}`)
      }
      
      memory.dailySummaries.sort((a, b) => a.date.localeCompare(b.date))
      
      if (memory.dailySummaries.length > MAX_DAILY_SUMMARIES) {
        const removedCount = memory.dailySummaries.length - MAX_DAILY_SUMMARIES
        memory.dailySummaries = memory.dailySummaries.slice(-MAX_DAILY_SUMMARIES)
        console.log(`[长期记忆] 移除 ${removedCount} 条旧总结（容量限制）`)
      }
      
      const result = await this.save(memory)
      
      const duration = Date.now() - startTime
      if (result) {
        memoryLogger.logSummarySuccess({
          date: summary.date,
          keyPoints: summary.keyPoints || [],
          studyDuration: summary.studyDuration || 0
        })
        console.log(`[长期记忆] 日总结添加成功，耗时 ${duration}ms，当前共 ${memory.dailySummaries.length} 条`)
      }
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      memoryLogger.logSummaryFailed(String(error))
      console.error('Failed to add daily summary:', error)
      return false
    }
  }

  async getSummaries(startDate: string, endDate: string): Promise<DailySummary[]> {
    try {
      const memory = await this.load()
      return memory.dailySummaries.filter(
        s => s.date >= startDate && s.date <= endDate
      )
    } catch (error) {
      console.error('Failed to get summaries:', error)
      return []
    }
  }

  async getRecentSummaries(count: number = 7): Promise<DailySummary[]> {
    try {
      const memory = await this.load()
      return memory.dailySummaries.slice(-count)
    } catch (error) {
      console.error('Failed to get recent summaries:', error)
      return []
    }
  }

  async getSummaryByDate(date: string): Promise<DailySummary | null> {
    try {
      const memory = await this.load()
      return memory.dailySummaries.find(s => s.date === date) || null
    } catch (error) {
      console.error('Failed to get summary by date:', error)
      return null
    }
  }

  async updateSummaryByDate(date: string, summary: DailySummary): Promise<boolean> {
    try {
      const memory = await this.load()
      const existingIndex = memory.dailySummaries.findIndex(s => s.date === date)
      
      if (existingIndex >= 0) {
        memory.dailySummaries[existingIndex] = summary
        console.log(`[长期记忆] 更新日总结: ${date}`)
      } else {
        memory.dailySummaries.push(summary)
        console.log(`[长期记忆] 添加日总结: ${date}`)
      }
      
      memory.dailySummaries.sort((a, b) => a.date.localeCompare(b.date))
      
      return await this.save(memory)
    } catch (error) {
      console.error('Failed to update summary by date:', error)
      return false
    }
  }

  async updateAccumulatedKnowledge(updates: Partial<AccumulatedKnowledge>): Promise<boolean> {
    try {
      const memory = await this.load()
      memory.accumulatedKnowledge = {
        ...memory.accumulatedKnowledge,
        ...updates
      }
      return await this.save(memory)
    } catch (error) {
      console.error('Failed to update accumulated knowledge:', error)
      return false
    }
  }

  async getTopicRecord(topic: string): Promise<TopicRecord | null> {
    try {
      const memory = await this.load()
      return memory.topicRecords[topic] || null
    } catch (error) {
      console.error('Failed to get topic record:', error)
      return null
    }
  }

  async updateTopicRecord(topic: string, updates: Partial<TopicRecord>): Promise<boolean> {
    try {
      const memory = await this.load()
      const existingRecord = memory.topicRecords[topic]
      
      if (existingRecord) {
        memory.topicRecords[topic] = {
          ...existingRecord,
          ...updates
        }
      } else {
        memory.topicRecords[topic] = {
          topic,
          firstLearnedDate: getTodayDateString(),
          lastReviewDate: getTodayDateString(),
          masteryLevel: '未掌握' as MasteryLevel,
          practiceCount: 0,
          correctRate: 0,
          relatedQuestions: [],
          notes: '',
          ...updates
        }
      }
      
      return await this.save(memory)
    } catch (error) {
      console.error('Failed to update topic record:', error)
      return false
    }
  }

  async searchTopicsByKeyword(keyword: string): Promise<TopicRecord[]> {
    try {
      const memory = await this.load()
      const results: TopicRecord[] = []
      
      for (const [topicName, record] of Object.entries(memory.topicRecords)) {
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

  async getWeakTopics(): Promise<TopicRecord[]> {
    try {
      const memory = await this.load()
      const weakTopics: TopicRecord[] = []
      
      for (const record of Object.values(memory.topicRecords)) {
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

  async getMasteredTopics(): Promise<TopicRecord[]> {
    try {
      const memory = await this.load()
      const masteredTopics: TopicRecord[] = []
      
      for (const record of Object.values(memory.topicRecords)) {
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

  async getTotalStudyDays(): Promise<number> {
    try {
      const memory = await this.load()
      return memory.accumulatedKnowledge.totalStudyDays
    } catch (error) {
      console.error('Failed to get total study days:', error)
      return 0
    }
  }

  async getTotalStudyHours(): Promise<number> {
    try {
      const memory = await this.load()
      return memory.accumulatedKnowledge.totalStudyHours
    } catch (error) {
      console.error('Failed to get total study hours:', error)
      return 0
    }
  }

  async getAccumulatedKnowledge(): Promise<AccumulatedKnowledge> {
    try {
      const memory = await this.load()
      return memory.accumulatedKnowledge
    } catch (error) {
      console.error('Failed to get accumulated knowledge:', error)
      return {
        masteredTopics: [],
        weakTopics: [],
        totalStudyDays: 0,
        totalStudyHours: 0
      }
    }
  }

  async incrementStudyDays(): Promise<boolean> {
    try {
      const memory = await this.load()
      memory.accumulatedKnowledge.totalStudyDays++
      return await this.save(memory)
    } catch (error) {
      console.error('Failed to increment study days:', error)
      return false
    }
  }

  async addStudyHours(hours: number): Promise<boolean> {
    try {
      const memory = await this.load()
      memory.accumulatedKnowledge.totalStudyHours += hours
      return await this.save(memory)
    } catch (error) {
      console.error('Failed to add study hours:', error)
      return false
    }
  }

  async updateMasteryLevel(topic: string, level: MasteryLevel): Promise<boolean> {
    return this.updateTopicRecord(topic, { masteryLevel: level })
  }

  async incrementPracticeCount(topic: string, isCorrect: boolean): Promise<boolean> {
    try {
      const record = await this.getTopicRecord(topic)
      if (!record) {
        return this.updateTopicRecord(topic, {
          practiceCount: 1,
          correctRate: isCorrect ? 1 : 0
        })
      }
      
      const newPracticeCount = record.practiceCount + 1
      const correctCount = Math.round(record.correctRate * record.practiceCount) + (isCorrect ? 1 : 0)
      const newCorrectRate = correctCount / newPracticeCount
      
      return this.updateTopicRecord(topic, {
        practiceCount: newPracticeCount,
        correctRate: newCorrectRate,
        lastReviewDate: getTodayDateString()
      })
    } catch (error) {
      console.error('Failed to increment practice count:', error)
      return false
    }
  }

  async addRelatedQuestion(topic: string, question: string): Promise<boolean> {
    try {
      const record = await this.getTopicRecord(topic)
      if (!record) {
        return this.updateTopicRecord(topic, {
          relatedQuestions: [question]
        })
      }
      
      if (!record.relatedQuestions.includes(question)) {
        return this.updateTopicRecord(topic, {
          relatedQuestions: [...record.relatedQuestions, question]
        })
      }
      
      return true
    } catch (error) {
      console.error('Failed to add related question:', error)
      return false
    }
  }

  async hasSummaryForDate(date: string): Promise<boolean> {
    try {
      const memory = await this.load()
      return memory.dailySummaries.some(s => s.date === date)
    } catch (error) {
      console.error('Failed to check summary for date:', error)
      return false
    }
  }

  clearCache(): void {
    this.cache = null
    this.isLoaded = false
  }
}

export const longTermMemoryService = new LongTermMemoryService()

export async function loadLongTermMemoryData(): Promise<LongTermMemoryData> {
  return longTermMemoryService.load()
}

export async function saveLongTermMemoryData(data: LongTermMemoryData): Promise<boolean> {
  return longTermMemoryService.save(data)
}

export async function addDailySummaryToLongTermMemory(summary: DailySummary): Promise<boolean> {
  return longTermMemoryService.addDailySummary(summary)
}

export async function getRecentDailySummaries(count?: number): Promise<DailySummary[]> {
  return longTermMemoryService.getRecentSummaries(count)
}

export async function getTopicRecordFromLongTermMemory(topic: string): Promise<TopicRecord | null> {
  return longTermMemoryService.getTopicRecord(topic)
}

export async function updateTopicRecordInLongTermMemory(topic: string, updates: Partial<TopicRecord>): Promise<boolean> {
  return longTermMemoryService.updateTopicRecord(topic, updates)
}

export async function getWeakTopicsFromLongTermMemory(): Promise<TopicRecord[]> {
  return longTermMemoryService.getWeakTopics()
}

export async function getMasteredTopicsFromLongTermMemory(): Promise<TopicRecord[]> {
  return longTermMemoryService.getMasteredTopics()
}

export default longTermMemoryService
