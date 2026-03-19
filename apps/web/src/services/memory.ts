import type { ConversationSummary } from '@/config/types'

export interface SummaryGenerationResult {
  topic: string
  keyPoints: string[]
  performance: '积极' | '需要改进'
  emotion: '开心' | '困惑' | '疲惫' | '平静'
  nextSuggestions: string[]
}

export async function generateConversationSummary(
  messages: Array<{ role: string; content: string }>,
  duration: number
): Promise<SummaryGenerationResult> {
  const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n')
  
  const response = await fetch('/api/llm/summarize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      conversation: conversationText,
      duration
    })
  })

  if (!response.ok) {
    throw new Error('Failed to generate summary')
  }

  const result = await response.json()
  return result as SummaryGenerationResult
}

export function createSummaryFromMessages(
  messages: Array<{ role: string; content: string }>,
  duration: number
): ConversationSummary {
  const userMessages = messages.filter(m => m.role === 'user')
  const assistantMessages = messages.filter(m => m.role === 'assistant')
  
  const lastUserMessage = userMessages[userMessages.length - 1]?.content || ''
  const lastAssistantMessage = assistantMessages[assistantMessages.length - 1]?.content || ''
  
  const topic = extractTopic(lastUserMessage, lastAssistantMessage)
  const keyPoints = extractKeyPoints(messages)
  const performance = assessPerformance(messages)
  const emotion = detectEmotion(messages)
  const nextSuggestions = generateSuggestions(keyPoints, performance)
  
  return {
    timestamp: new Date().toISOString(),
    duration,
    topic,
    keyPoints,
    performance,
    emotion,
    nextSuggestions
  }
}

function extractTopic(userMessage: string, assistantMessage: string): string {
  const combined = `${userMessage} ${assistantMessage}`
  
  const topics: Record<string, string> = {
    '数学': '数学学习',
    '语文': '语文学习',
    '英语': '英语学习',
    '乘法': '乘法口诀',
    '除法': '除法运算',
    '加法': '加法运算',
    '减法': '减法运算',
    '练习': '习题练习',
    '作业': '完成作业',
    '阅读': '阅读理解',
    '背诵': '背诵练习',
    '学习': '日常学习'
  }
  
  for (const [keyword, topic] of Object.entries(topics)) {
    if (combined.includes(keyword)) {
      return topic
    }
  }
  
  return '日常学习对话'
}

function extractKeyPoints(messages: Array<{ role: string; content: string }>): string[] {
  const keyPoints: string[] = []
  const combinedText = messages.map(m => m.content).join(' ')
  
  const patterns = [
    /学会了?(.+?)的?/g,
    /掌握了?(.+?)的?/g,
    /学习了?(.+?)/g,
    /了解了?(.+?)/g
  ]
  
  for (const pattern of patterns) {
    const matches = combinedText.matchAll(pattern)
    for (const match of matches) {
      if (match[1] && match[1].length < 20) {
        keyPoints.push(match[1])
      }
    }
  }
  
  return [...new Set(keyPoints)].slice(0, 5)
}

function assessPerformance(messages: Array<{ role: string; content: string }>): '积极' | '需要改进' {
  const combinedText = messages.map(m => m.content).join(' ')
  
  const positivePatterns = [
    '明白了', '懂了', '会了', '学会了', '掌握了', '太棒了', '真棒', '不错', '很好', '厉害'
  ]
  
  const negativePatterns = [
    '不会', '不懂', '不知道', '错了', '不明白', '不清楚'
  ]
  
  let positiveCount = 0
  let negativeCount = 0
  
  for (const pattern of positivePatterns) {
    if (combinedText.includes(pattern)) positiveCount++
  }
  
  for (const pattern of negativePatterns) {
    if (combinedText.includes(pattern)) negativeCount++
  }
  
  return positiveCount > negativeCount ? '积极' : '需要改进'
}

function detectEmotion(messages: Array<{ role: string; content: string }>): '开心' | '困惑' | '疲惫' | '平静' {
  const combinedText = messages.map(m => m.content).join(' ')
  
  const emotionPatterns = {
    '开心': ['太棒了', '真棒', '太好了', '开心', '高兴', '喜欢', '爱你'],
    '困惑': ['不懂', '不会', '不知道', '不明白', '疑问', '困惑'],
    '疲惫': ['累了', '困了', '想休息', '不想学了', '好累'],
    '平静': ['好的', '嗯', '明白', '好']
  }
  
  let maxCount = 0
  let detectedEmotion: '开心' | '困惑' | '疲惫' | '平静' = '平静'
  
  for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
    let count = 0
    for (const pattern of patterns) {
      if (combinedText.includes(pattern)) count++
    }
    if (count > maxCount) {
      maxCount = count
      detectedEmotion = emotion as typeof detectedEmotion
    }
  }
  
  return detectedEmotion
}

function generateSuggestions(keyPoints: string[], performance: '积极' | '需要改进'): string[] {
  const suggestions: string[] = []
  
  if (performance === '需要改进' && keyPoints.length > 0) {
    suggestions.push(`建议继续练习「${keyPoints[0]}」相关的内容`)
  }
  
  if (keyPoints.length > 2) {
    suggestions.push('今天学了很多内容，记得复习哦！')
  }
  
  if (suggestions.length === 0) {
    suggestions.push('继续保持学习热情，明天继续加油！')
  }
  
  return suggestions
}

export function shouldTriggerSummary(lastInteractionTime: number, currentTime: number): boolean {
  const fifteenMinutes = 15 * 60 * 1000
  return currentTime - lastInteractionTime > fifteenMinutes
}

export function calculateConsecutiveDays(lastDate: string | null): number {
  if (!lastDate) return 1
  
  const last = new Date(lastDate)
  const today = new Date()
  
  last.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  
  const diffTime = today.getTime() - last.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return 0
  } else if (diffDays === 1) {
    return 1
  } else {
    return 0
  }
}
