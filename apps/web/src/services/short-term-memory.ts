import type { ChatMessage, ShortTermMemoryData, MessageContext, MessageType, PracticeSummary, MemoryStatus } from '@/config/types'
import { loadShortTermMemory, saveShortTermMemory } from './data-service'

const MAX_MESSAGES = 500

function getCurrentTimestamp(): string {
  return new Date().toISOString()
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function createEmptyMemory(): ShortTermMemoryData {
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
    practiceSummaries: [],
    status: 'pending',
    createdAt: now,
    lastUpdated: now
  }
}

class ShortTermMemoryService {
  private cache: ShortTermMemoryData | null = null
  private isLoaded = false

  async load(): Promise<ShortTermMemoryData> {
    if (this.isLoaded && this.cache) {
      return this.cache
    }
    
    try {
      const data = await loadShortTermMemory()
      this.cache = data
      this.isLoaded = true
      return data
    } catch (error) {
      console.error('Failed to load short-term memory:', error)
      this.cache = createEmptyMemory()
      this.isLoaded = true
      return this.cache
    }
  }

  async save(data: ShortTermMemoryData): Promise<boolean> {
    try {
      data.lastUpdated = getCurrentTimestamp()
      const success = await saveShortTermMemory(data)
      if (success) {
        this.cache = data
      }
      return success
    } catch (error) {
      console.error('Failed to save short-term memory:', error)
      return false
    }
  }

  async addMessage(
    role: 'user' | 'assistant',
    content: string,
    messageType: MessageType = 'text',
    context?: MessageContext
  ): Promise<boolean> {
    try {
      const memory = await this.load()
      
      const message: ChatMessage = {
        id: generateId(),
        role,
        content,
        timestamp: getCurrentTimestamp(),
        messageType,
        context: context || {}
      }
      
      memory.messages.push(message)
      
      if (memory.messages.length > MAX_MESSAGES) {
        const removedCount = memory.messages.length - MAX_MESSAGES
        memory.messages = memory.messages.slice(-MAX_MESSAGES)
        console.log(`Removed ${removedCount} old messages due to capacity limit`)
      }
      
      memory.metadata.totalMessages = memory.messages.length
      memory.metadata.lastSessionTime = getCurrentTimestamp()
      
      return await this.save(memory)
    } catch (error) {
      console.error('Failed to add message to short-term memory:', error)
      return false
    }
  }

  async clear(): Promise<boolean> {
    try {
      const emptyMemory = createEmptyMemory()
      return await this.save(emptyMemory)
    } catch (error) {
      console.error('Failed to clear short-term memory:', error)
      return false
    }
  }

  async getDate(): Promise<string | null> {
    try {
      const memory = await this.load()
      return memory.date || null
    } catch (error) {
      console.error('Failed to get short-term memory date:', error)
      return null
    }
  }

  async isToday(): Promise<boolean> {
    try {
      const memoryDate = await this.getDate()
      if (!memoryDate) return false
      return memoryDate === getTodayDateString()
    } catch (error) {
      console.error('Failed to check if memory is today:', error)
      return false
    }
  }

  async getMessages(): Promise<ChatMessage[]> {
    try {
      const memory = await this.load()
      return memory.messages || []
    } catch (error) {
      console.error('Failed to get messages:', error)
      return []
    }
  }

  async initializeTodayMemory(): Promise<boolean> {
    try {
      const memory = await this.load()
      const today = getTodayDateString()
      
      if (memory.date !== today) {
        const newMemory = createEmptyMemory()
        return await this.save(newMemory)
      }
      
      return true
    } catch (error) {
      console.error('Failed to initialize today memory:', error)
      return false
    }
  }

  async getMetadata(): Promise<ShortTermMemoryData['metadata']> {
    try {
      const memory = await this.load()
      return memory.metadata
    } catch (error) {
      console.error('Failed to get metadata:', error)
      return {
        totalMessages: 0,
        sessionCount: 0,
        lastSessionTime: ''
      }
    }
  }

  async getMessageCount(): Promise<number> {
    try {
      const memory = await this.load()
      return memory.messages.length
    } catch (error) {
      console.error('Failed to get message count:', error)
      return 0
    }
  }

  async getMessagesByRole(role: 'user' | 'assistant'): Promise<ChatMessage[]> {
    try {
      const memory = await this.load()
      return memory.messages.filter(m => m.role === role)
    } catch (error) {
      console.error('Failed to get messages by role:', error)
      return []
    }
  }

  async getLastMessage(): Promise<ChatMessage | null> {
    try {
      const memory = await this.load()
      if (memory.messages.length === 0) return null
      return memory.messages[memory.messages.length - 1]
    } catch (error) {
      console.error('Failed to get last message:', error)
      return null
    }
  }

  async searchMessages(keyword: string): Promise<ChatMessage[]> {
    try {
      const memory = await this.load()
      return memory.messages.filter(m => 
        m.content.toLowerCase().includes(keyword.toLowerCase())
      )
    } catch (error) {
      console.error('Failed to search messages:', error)
      return []
    }
  }

  async savePracticeSummary(summary: PracticeSummary): Promise<boolean> {
    try {
      const memory = await this.load()
      
      if (!memory.practiceSummaries) {
        memory.practiceSummaries = []
      }
      
      const existingIndex = memory.practiceSummaries.findIndex(s => s.sessionId === summary.sessionId)
      if (existingIndex >= 0) {
        memory.practiceSummaries[existingIndex] = summary
      } else {
        memory.practiceSummaries.push(summary)
      }
      
      console.log(`[短期记忆] 保存练习总结: ${summary.sessionId}`)
      return await this.save(memory)
    } catch (error) {
      console.error('Failed to save practice summary:', error)
      return false
    }
  }

  async getPracticeSummaries(): Promise<PracticeSummary[]> {
    try {
      const memory = await this.load()
      return memory.practiceSummaries || []
    } catch (error) {
      console.error('Failed to get practice summaries:', error)
      return []
    }
  }

  async getPracticeSummaryById(sessionId: string): Promise<PracticeSummary | null> {
    try {
      const memory = await this.load()
      return memory.practiceSummaries?.find(s => s.sessionId === sessionId) || null
    } catch (error) {
      console.error('Failed to get practice summary by id:', error)
      return null
    }
  }

  async getStatus(): Promise<MemoryStatus> {
    try {
      const memory = await this.load()
      return memory.status || 'pending'
    } catch (error) {
      console.error('Failed to get memory status:', error)
      return 'pending'
    }
  }

  async markAsSummarized(): Promise<boolean> {
    try {
      const memory = await this.load()
      memory.status = 'summarized'
      memory.summaryDate = getCurrentTimestamp()
      memory.summarizedMessageCount = memory.messages.length
      memory.summarizedPracticeCount = memory.practiceSummaries?.length || 0
      
      console.log(`[短期记忆] 标记为已总结: ${memory.summarizedMessageCount} 条消息, ${memory.summarizedPracticeCount} 个练习`)
      return await this.save(memory)
    } catch (error) {
      console.error('Failed to mark as summarized:', error)
      return false
    }
  }

  async getNewContentCountAfterSummary(): Promise<{ messages: number, practices: number }> {
    try {
      const memory = await this.load()
      
      if (memory.status !== 'summarized') {
        return {
          messages: memory.messages.length,
          practices: memory.practiceSummaries?.length || 0
        }
      }
      
      const summarizedMsgCount = memory.summarizedMessageCount || 0
      const summarizedPracticeCount = memory.summarizedPracticeCount || 0
      
      return {
        messages: Math.max(0, memory.messages.length - summarizedMsgCount),
        practices: Math.max(0, (memory.practiceSummaries?.length || 0) - summarizedPracticeCount)
      }
    } catch (error) {
      console.error('Failed to get new content count:', error)
      return { messages: 0, practices: 0 }
    }
  }

  async hasUnsummarizedContent(): Promise<boolean> {
    try {
      const memory = await this.load()
      
      if (memory.status !== 'summarized') {
        return memory.messages.length > 0 || (memory.practiceSummaries?.length || 0) > 0
      }
      
      const newContent = await this.getNewContentCountAfterSummary()
      return newContent.messages > 0 || newContent.practices > 0
    } catch (error) {
      console.error('Failed to check unsummarized content:', error)
      return false
    }
  }

  async getNewMessagesAfterSummary(): Promise<ChatMessage[]> {
    try {
      const memory = await this.load()
      
      if (memory.status !== 'summarized') {
        return memory.messages
      }
      
      const summarizedCount = memory.summarizedMessageCount || 0
      return memory.messages.slice(summarizedCount)
    } catch (error) {
      console.error('Failed to get new messages after summary:', error)
      return []
    }
  }

  async getNewPracticesAfterSummary(): Promise<PracticeSummary[]> {
    try {
      const memory = await this.load()
      
      if (memory.status !== 'summarized') {
        return memory.practiceSummaries || []
      }
      
      const summarizedCount = memory.summarizedPracticeCount || 0
      return (memory.practiceSummaries || []).slice(summarizedCount)
    } catch (error) {
      console.error('Failed to get new practices after summary:', error)
      return []
    }
  }

  async getSummarizedMessageCount(): Promise<number> {
    try {
      const memory = await this.load()
      return memory.summarizedMessageCount || 0
    } catch (error) {
      console.error('Failed to get summarized message count:', error)
      return 0
    }
  }

  async getSummarizedPracticeCount(): Promise<number> {
    try {
      const memory = await this.load()
      return memory.summarizedPracticeCount || 0
    } catch (error) {
      console.error('Failed to get summarized practice count:', error)
      return 0
    }
  }

  clearCache(): void {
    this.cache = null
    this.isLoaded = false
  }
}

export const shortTermMemoryService = new ShortTermMemoryService()

export async function loadShortTermMemoryData(): Promise<ShortTermMemoryData> {
  return shortTermMemoryService.load()
}

export async function saveShortTermMemoryData(data: ShortTermMemoryData): Promise<boolean> {
  return shortTermMemoryService.save(data)
}

export async function addMessageToShortTermMemory(
  role: 'user' | 'assistant',
  content: string,
  messageType?: MessageType,
  context?: MessageContext
): Promise<boolean> {
  return shortTermMemoryService.addMessage(role, content, messageType, context)
}

export async function clearShortTermMemoryData(): Promise<boolean> {
  return shortTermMemoryService.clear()
}

export async function getShortTermMemoryDate(): Promise<string | null> {
  return shortTermMemoryService.getDate()
}

export async function isShortTermMemoryToday(): Promise<boolean> {
  return shortTermMemoryService.isToday()
}

export async function getTodayMessages(): Promise<ChatMessage[]> {
  return shortTermMemoryService.getMessages()
}

export async function initializeTodayShortTermMemory(): Promise<boolean> {
  return shortTermMemoryService.initializeTodayMemory()
}

export async function savePracticeSummaryToShortTermMemory(summary: PracticeSummary): Promise<boolean> {
  return shortTermMemoryService.savePracticeSummary(summary)
}

export async function getPracticeSummariesFromShortTermMemory(): Promise<PracticeSummary[]> {
  return shortTermMemoryService.getPracticeSummaries()
}

export default shortTermMemoryService
