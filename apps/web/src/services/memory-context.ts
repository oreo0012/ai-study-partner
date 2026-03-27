import type { ChatMessage, DailySummary, TopicRecord, AccumulatedKnowledge } from '@/config/types'
import { shortTermMemoryService } from './short-term-memory'
import { longTermMemoryService } from './long-term-memory'
import { topicSearchService } from './topic-search'
import type { Message } from './types'

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

export function formatShortTermMemoryContext(messages: ChatMessage[]): string {
  if (!messages || messages.length === 0) {
    return ''
  }

  const today = getTodayDateString()
  const recentMessages = messages.slice(-10)
  
  let context = `【今日对话记录】\n`
  context += `日期：${today}\n`
  context += `对话条数：${messages.length}条\n`
  
  if (recentMessages.length > 0) {
    context += `\n最近对话：\n`
    recentMessages.forEach(msg => {
      const role = msg.role === 'user' ? '学生' : 'AI'
      const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      context += `[${time}] ${role}: ${msg.content.slice(0, 150)}${msg.content.length > 150 ? '...' : ''}\n`
    })
  }

  return context
}

export function formatLongTermMemoryContext(
  summaries: DailySummary[],
  knowledge: AccumulatedKnowledge,
  topicRecords: Record<string, TopicRecord>
): string {
  if (summaries.length === 0 && Object.keys(topicRecords).length === 0) {
    return ''
  }

  let context = `【长期学习记忆】\n`
  
  if (knowledge.totalStudyDays > 0) {
    context += `总学习天数：${knowledge.totalStudyDays}天\n`
    context += `总学习时长：${knowledge.totalStudyHours.toFixed(1)}小时\n`
  }
  
  if (knowledge.masteredTopics.length > 0) {
    context += `已掌握知识点：${knowledge.masteredTopics.slice(0, 5).join('、')}\n`
  }
  
  if (knowledge.weakTopics.length > 0) {
    context += `薄弱知识点：${knowledge.weakTopics.slice(0, 3).join('、')}\n`
  }

  if (summaries.length > 0) {
    context += `\n最近学习记录：\n`
    summaries.slice(-3).forEach(summary => {
      context += `- ${summary.date}: ${summary.summary.slice(0, 80)}...\n`
    })
  }

  const weakTopicRecords = Object.values(topicRecords).filter(
    r => r.masteryLevel === '未掌握' || r.masteryLevel === '初步理解'
  )
  if (weakTopicRecords.length > 0) {
    context += `\n需要复习的知识点：\n`
    weakTopicRecords.slice(0, 3).forEach(record => {
      context += `- ${record.topic}（${record.masteryLevel}，正确率${Math.round(record.correctRate * 100)}%）\n`
    })
  }

  return context
}

export async function buildSystemPromptWithMemory(basePrompt: string): Promise<string> {
  try {
    const shortTermMessages = await shortTermMemoryService.getMessages()
    const longTermData = await longTermMemoryService.load()
    
    const shortTermContext = formatShortTermMemoryContext(shortTermMessages)
    const longTermContext = formatLongTermMemoryContext(
      longTermData.dailySummaries,
      longTermData.accumulatedKnowledge,
      longTermData.topicRecords
    )
    
    let memoryContext = ''
    if (shortTermContext) {
      memoryContext += shortTermContext + '\n'
    }
    if (longTermContext) {
      memoryContext += longTermContext + '\n'
    }
    
    if (memoryContext) {
      return `${basePrompt}\n\n${memoryContext}\n请根据用户的学习情况和历史记忆，提供个性化的学习建议和互动。`
    }
    
    return basePrompt
  } catch (error) {
    console.error('Failed to build system prompt with memory:', error)
    return basePrompt
  }
}

export async function generatePersonalizedGreeting(
  userName: string,
  knowledge: AccumulatedKnowledge,
  weakTopics: TopicRecord[]
): Promise<string> {
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

  let greeting = `${timeGreeting}呀${userName}！`
  
  if (knowledge.totalStudyDays > 0) {
    greeting += `你已经连续学习${knowledge.totalStudyDays}天了，真棒！`
  }

  if (weakTopics.length > 0) {
    const topicNames = weakTopics.slice(0, 2).map(t => t.topic).join('和')
    greeting += `我注意到${topicNames}还需要练习，要不要今天复习一下？`
  }

  return greeting
}

export async function detectAndInjectTopicContext(question: string): Promise<string | null> {
  try {
    const topic = await topicSearchService.detectTopicFromQuestion(question)
    if (!topic) {
      return null
    }

    const searchResult = await topicSearchService.searchTopicHistory(topic)
    if (!searchResult.found) {
      return `【知识点：${topic}】\n这是用户首次学习这个知识点。`
    }

    return topicSearchService.buildTopicContext(topic, searchResult.record || null)
  } catch (error) {
    console.error('Failed to detect and inject topic context:', error)
    return null
  }
}

export function convertChatMessagesToMessages(chatMessages: ChatMessage[]): Message[] {
  return chatMessages.map(msg => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    createdAt: new Date(msg.timestamp).getTime()
  }))
}

export function convertMessagesToChatMessages(messages: Message[]): ChatMessage[] {
  return messages
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(msg.createdAt).toISOString(),
      messageType: 'text' as const,
      context: {}
    }))
}

export const memoryContextService = {
  formatShortTermMemoryContext,
  formatLongTermMemoryContext,
  buildSystemPromptWithMemory,
  generatePersonalizedGreeting,
  detectAndInjectTopicContext,
  convertChatMessagesToMessages,
  convertMessagesToChatMessages
}

export default memoryContextService
