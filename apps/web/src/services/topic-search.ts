import type { TopicRecord, DailySummary, TopicSearchResult } from '@/config/types'
import { longTermMemoryService } from './long-term-memory'

const TOPIC_KEYWORDS_MAP: Record<string, string[]> = {
  '进一法': ['进一法', '进一', '向上取整', '舍入'],
  '去尾法': ['去尾法', '去尾', '向下取整', '舍去'],
  '四舍五入': ['四舍五入', '四舍', '五入', '舍入'],
  '加法': ['加法', '加', '相加', '求和', '和'],
  '减法': ['减法', '减', '相减', '差'],
  '乘法': ['乘法', '乘', '相乘', '积', '乘法口诀', '九九乘法'],
  '除法': ['除法', '除', '相除', '商', '除以'],
  '分数': ['分数', '分子', '分母', '约分', '通分'],
  '小数': ['小数', '小数点', '小数位'],
  '百分数': ['百分数', '百分比', '%'],
  '比例': ['比例', '比', '比值'],
  '方程': ['方程', '未知数', '解方程', 'x'],
  '几何': ['几何', '图形', '三角形', '正方形', '长方形', '圆', '面积', '周长'],
  '角度': ['角度', '角', '度', '直角', '锐角', '钝角'],
  '时间': ['时间', '时', '分', '秒', '时钟', '日历'],
  '长度': ['长度', '米', '厘米', '毫米', '千米', '公里'],
  '重量': ['重量', '克', '千克', '吨', '斤'],
  '容量': ['容量', '升', '毫升', '体积'],
  '拼音': ['拼音', '声母', '韵母', '声调', '拼读'],
  '汉字': ['汉字', '字', '笔画', '部首', '偏旁'],
  '词语': ['词语', '词', '近义词', '反义词', '成语'],
  '句子': ['句子', '句', '主语', '谓语', '宾语', '标点'],
  '阅读': ['阅读', '读', '理解', '文章', '段落'],
  '写作': ['写作', '作文', '写', '日记', '书信'],
  '英语字母': ['字母', 'ABC', 'abc', '大小写'],
  '英语单词': ['单词', '词汇', 'word', 'words'],
  '英语语法': ['语法', '时态', '过去式', '现在式', '将来式', 'grammar'],
  '英语口语': ['口语', '对话', 'conversation', 'speak']
}

const TOPIC_CATEGORIES: Record<string, string[]> = {
  '数学': ['进一法', '去尾法', '四舍五入', '加法', '减法', '乘法', '除法', '分数', '小数', '百分数', '比例', '方程', '几何', '角度', '时间', '长度', '重量', '容量'],
  '语文': ['拼音', '汉字', '词语', '句子', '阅读', '写作'],
  '英语': ['英语字母', '英语单词', '英语语法', '英语口语']
}

function findTopicByKeyword(keyword: string): string | null {
  const normalizedKeyword = keyword.toLowerCase().trim()
  
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS_MAP)) {
    for (const kw of keywords) {
      if (normalizedKeyword.includes(kw.toLowerCase()) || kw.toLowerCase().includes(normalizedKeyword)) {
        return topic
      }
    }
  }
  
  return null
}

function extractKeywordsFromQuestion(question: string): string[] {
  const keywords: string[] = []
  const words = question.split(/[\s,，。！？、；：""''（）【】《》]+/)
  
  for (const word of words) {
    if (word.length >= 2) {
      keywords.push(word)
    }
  }
  
  for (let i = 0; i < question.length - 1; i++) {
    keywords.push(question.substring(i, i + 2))
  }
  
  return [...new Set(keywords)]
}

class TopicSearchService {
  async detectTopicFromQuestion(question: string): Promise<string | null> {
    try {
      const directTopic = findTopicByKeyword(question)
      if (directTopic) {
        return directTopic
      }
      
      const keywords = extractKeywordsFromQuestion(question)
      for (const keyword of keywords) {
        const topic = findTopicByKeyword(keyword)
        if (topic) {
          return topic
        }
      }
      
      const topicRecord = await longTermMemoryService.searchTopicsByKeyword(question)
      if (topicRecord.length > 0) {
        return topicRecord[0].topic
      }
      
      return null
    } catch (error) {
      console.error('Failed to detect topic from question:', error)
      return null
    }
  }

  async searchTopicHistory(topic: string): Promise<TopicSearchResult> {
    try {
      const record = await longTermMemoryService.getTopicRecord(topic)
      const allSummaries = await longTermMemoryService.getRecentSummaries(30)
      
      const relatedSummaries = allSummaries.filter(summary => {
        if (summary.keyPoints.some(p => p.includes(topic))) {
          return true
        }
        if (summary.learnedTopics.some(t => t.topic.includes(topic))) {
          return true
        }
        if (summary.summary.includes(topic)) {
          return true
        }
        return false
      })
      
      const suggestions: string[] = []
      if (record) {
        if (record.masteryLevel === '未掌握' || record.masteryLevel === '初步理解') {
          suggestions.push(`建议复习${topic}相关内容`)
        }
        if (record.correctRate < 0.7) {
          suggestions.push(`正确率较低，建议多做练习`)
        }
        if (record.weakSubTopics && record.weakSubTopics.length > 0) {
          suggestions.push(`薄弱环节：${record.weakSubTopics.join('、')}`)
        }
      }
      
      return {
        found: record !== null,
        record: record || undefined,
        relatedSummaries,
        suggestions
      }
    } catch (error) {
      console.error('Failed to search topic history:', error)
      return {
        found: false,
        relatedSummaries: [],
        suggestions: []
      }
    }
  }

  buildTopicContext(topic: string, record: TopicRecord | null): string {
    if (!record) {
      return `【知识点：${topic}】\n这是用户首次学习这个知识点。`
    }
    
    const contextParts: string[] = []
    contextParts.push(`【知识点：${topic}】`)
    contextParts.push(`首次学习：${record.firstLearnedDate}`)
    contextParts.push(`最近复习：${record.lastReviewDate}`)
    contextParts.push(`掌握程度：${record.masteryLevel}`)
    contextParts.push(`练习次数：${record.practiceCount}次`)
    contextParts.push(`正确率：${Math.round(record.correctRate * 100)}%`)
    
    if (record.relatedQuestions.length > 0) {
      contextParts.push(`相关问题：${record.relatedQuestions.slice(-3).join('、')}`)
    }
    
    if (record.notes) {
      contextParts.push(`学习备注：${record.notes}`)
    }
    
    if (record.weakSubTopics && record.weakSubTopics.length > 0) {
      contextParts.push(`薄弱环节：${record.weakSubTopics.join('、')}`)
    }
    
    return contextParts.join('\n')
  }

  async getTopicsByCategory(category: string): Promise<TopicRecord[]> {
    try {
      const topicNames = TOPIC_CATEGORIES[category] || []
      const records: TopicRecord[] = []
      
      for (const topicName of topicNames) {
        const record = await longTermMemoryService.getTopicRecord(topicName)
        if (record) {
          records.push(record)
        }
      }
      
      return records
    } catch (error) {
      console.error('Failed to get topics by category:', error)
      return []
    }
  }

  async getAllLearnedTopics(): Promise<TopicRecord[]> {
    try {
      const weakTopics = await longTermMemoryService.getWeakTopics()
      const masteredTopics = await longTermMemoryService.getMasteredTopics()
      return [...weakTopics, ...masteredTopics]
    } catch (error) {
      console.error('Failed to get all learned topics:', error)
      return []
    }
  }

  async getTopicSuggestions(): Promise<string[]> {
    try {
      const weakTopics = await longTermMemoryService.getWeakTopics()
      const suggestions: string[] = []
      
      for (const topic of weakTopics) {
        if (topic.masteryLevel === '未掌握') {
          suggestions.push(`${topic.topic}需要重新学习`)
        } else if (topic.masteryLevel === '初步理解') {
          suggestions.push(`${topic.topic}需要更多练习`)
        }
      }
      
      return suggestions
    } catch (error) {
      console.error('Failed to get topic suggestions:', error)
      return []
    }
  }

  getCategoryForTopic(topic: string): string | null {
    for (const [category, topics] of Object.entries(TOPIC_CATEGORIES)) {
      if (topics.includes(topic)) {
        return category
      }
    }
    return null
  }

  getRelatedTopics(topic: string): string[] {
    const category = this.getCategoryForTopic(topic)
    if (category) {
      const categoryTopics = TOPIC_CATEGORIES[category] || []
      return categoryTopics.filter(t => t !== topic)
    }
    return []
  }
}

export const topicSearchService = new TopicSearchService()

export async function detectTopicFromQuestion(question: string): Promise<string | null> {
  return topicSearchService.detectTopicFromQuestion(question)
}

export async function searchTopicHistory(topic: string): Promise<TopicSearchResult> {
  return topicSearchService.searchTopicHistory(topic)
}

export function buildTopicContext(topic: string, record: TopicRecord | null): string {
  return topicSearchService.buildTopicContext(topic, record)
}

export default topicSearchService
