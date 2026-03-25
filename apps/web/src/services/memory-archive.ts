import type { ChatMessage, DailySummary, ArchiveResult, EmotionStats, LearnedTopic, PracticeSummary, Task } from '@/config/types'
import { shortTermMemoryService } from './short-term-memory'
import { longTermMemoryService } from './long-term-memory'
import { backupMemoryWithType, getTasksByDate } from './data-service'
import { memoryLogger } from './memory-logger'
import { cleanupExpiredImages, cleanupByStorageLimit } from './image-storage'

const ARCHIVE_STATUS_KEY = 'ai_study_archive_status'

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

function getYesterdayDateString(): string {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return yesterday.toISOString().split('T')[0]
}

const SUMMARY_SYSTEM_PROMPT = `你是一个专业的学习分析助手，负责分析学生的学习对话记录、自主练习结果和任务完成情况，生成结构化的学习总结。

请根据提供的数据，生成一个JSON格式的学习总结，包含以下字段：

【基础学习总结】
1. summary: 一段简洁的学习总结（100-200字），综合描述当日学习情况
2. keyPoints: 关键知识点列表（数组）
3. emotion: 情绪状态统计，包含primary（主要情绪）和distribution（情绪分布对象）
4. tasksCompleted: 完成的任务列表（数组），【重要】请根据【当日任务记录】中"已完成任务"部分提取任务名称，不要从对话中推断
5. studyDuration: 估计学习时长（分钟，数字）
6. weakPoints: 薄弱知识点列表（数组）
7. achievements: 当日成就列表（数组）
8. learnedTopics: 学习的知识点详情数组，每个包含topic、masteryLevel、practiceCount、correctRate

【自主练习总结】（如有练习数据）
9. practiceAnalysis: 练习分析对象，包含：
   - overallPerformance: 整体表现评价（优秀/良好/一般/需加强）
   - practiceHighlights: 练习亮点数组（答对的难题、进步的题型等）
   - areasToImprove: 需改进领域数组
   - practiceSuggestions: 练习建议数组

情绪类型包括：开心、困惑、平静、兴奋、沮丧、好奇、自信

请只返回JSON格式的数据，不要包含其他文字。`

const INCREMENTAL_SUMMARY_PROMPT = `你是一个专业的学习分析助手，负责将新增的学习内容与已有的每日总结进行合并更新。

请根据已有的总结和新增内容，生成一个完整的学习总结，包含以下字段：

【基础学习总结】
1. summary: 一段简洁的学习总结（100-200字），综合描述当日学习情况
2. keyPoints: 关键知识点列表（数组），合并已有知识点和新增知识点
3. emotion: 情绪状态统计，包含primary（主要情绪）和distribution（情绪分布对象）
4. tasksCompleted: 完成的任务列表（数组）
5. studyDuration: 估计学习时长（分钟，数字），累加已有时长
6. weakPoints: 薄弱知识点列表（数组）
7. achievements: 当日成就列表（数组）
8. learnedTopics: 学习的知识点详情数组

【自主练习总结】（如有练习数据）
9. practiceAnalysis: 练习分析对象，包含：
   - overallPerformance: 整体表现评价（优秀/良好/一般/需加强）
   - practiceHighlights: 练习亮点数组
   - areasToImprove: 需改进领域数组
   - practiceSuggestions: 练习建议数组

要求：
- 合并已有总结和新增内容，生成完整的总结
- 不要简单拼接，要有机整合
- 更新学习时长和知识点列表
- 保持总结的连贯性和完整性

请只返回JSON格式的数据，不要包含其他文字。`

const PRACTICE_SUMMARY_PROMPT = `你是一个专业的学习分析助手，负责分析学生的自主练习结果并生成结构化的练习总结。

请根据提供的练习数据，生成一个JSON格式的练习总结，包含以下字段：

1. keyFindings: 关键发现数组，分析学生在本次练习中的表现特点
   - 识别学生的优势和薄弱环节
   - 发现答题模式或常见错误类型
   
2. improvementSuggestions: 改进建议数组，针对薄弱知识点提供具体建议
   - 建议要具体、可操作
   - 适合小学生理解
   
3. nextSteps: 下一步学习建议数组
   - 推荐复习的知识点
   - 建议练习的题型

分析要求：
- 客观分析，既肯定进步也指出不足
- 建议要具体、有针对性
- 语言简洁明了，适合家长阅读
- 关注学习方法和习惯的培养

请只返回JSON格式的数据，不要包含其他文字。`

function buildPracticeDataPrompt(practiceSummaries: PracticeSummary[]): string {
  if (!practiceSummaries || practiceSummaries.length === 0) {
    return ''
  }
  
  let text = '\n\n【当日自主练习记录】\n'
  
  practiceSummaries.forEach((practice, index) => {
    text += `\n练习${index + 1}：${practice.practiceType}\n`
    text += `- 时间：${practice.startTime.split('T')[1]?.slice(0, 5) || ''} - ${practice.endTime.split('T')[1]?.slice(0, 5) || ''}\n`
    text += `- 时长：${practice.duration}分钟\n`
    text += `- 题目：${practice.totalQuestions}题\n`
    text += `- 成绩：${practice.correctCount}/${practice.totalQuestions}（正确率${Math.round(practice.accuracy * 100)}%）\n`
    text += `- 表现：${practice.performance}\n`
    
    if (practice.weakTopics && practice.weakTopics.length > 0) {
      text += `- 薄弱知识点：${practice.weakTopics.join('、')}\n`
    }
    
    if (practice.keyFindings && practice.keyFindings.length > 0) {
      text += `- 关键发现：${practice.keyFindings.join('；')}\n`
    }
  })
  
  return text
}

function buildTaskDataPrompt(tasks: Task[]): string {
  if (!tasks || tasks.length === 0) {
    return ''
  }
  
  let text = '\n\n【当日任务记录】\n'
  
  const completedTasks = tasks.filter(t => t.status === '已完成')
  const pendingTasks = tasks.filter(t => t.status === '未完成')
  
  if (completedTasks.length > 0) {
    text += `\n已完成任务 (${completedTasks.length}个):\n`
    completedTasks.forEach((task, index) => {
      text += `${index + 1}. ${task.name}`
      text += ` [${task.type}]`
      if (task.estimatedTime) {
        text += ` 预计${task.estimatedTime}分钟`
      }
      if (task.completedAt) {
        text += ` 完成于${task.completedAt.split('T')[1]?.slice(0, 5) || ''}`
      }
      text += '\n'
    })
  }
  
  if (pendingTasks.length > 0) {
    text += `\n未完成任务 (${pendingTasks.length}个):\n`
    pendingTasks.forEach((task, index) => {
      text += `${index + 1}. ${task.name}`
      text += ` [${task.type}]`
      if (task.estimatedTime) {
        text += ` 预计${task.estimatedTime}分钟`
      }
      text += '\n'
    })
  }
  
  return text
}

function buildSummaryUserPrompt(messages: ChatMessage[], practiceSummaries?: PracticeSummary[], tasks?: Task[]): string {
  const conversationText = messages.map(m => {
    const role = m.role === 'user' ? '学生' : 'AI助手'
    return `[${m.timestamp}] ${role}: ${m.content}`
  }).join('\n')

  let prompt = `以下是今日的学习对话记录，请分析并生成学习总结：

${conversationText}`

  if (practiceSummaries && practiceSummaries.length > 0) {
    prompt += buildPracticeDataPrompt(practiceSummaries)
  }

  if (tasks && tasks.length > 0) {
    prompt += buildTaskDataPrompt(tasks)
  }

  prompt += '\n\n请生成JSON格式的学习总结。'
  
  return prompt
}

function tryFixJson(jsonStr: string): string {
  let fixed = jsonStr
  
  fixed = fixed.replace(/,\s*}/g, '}')
  fixed = fixed.replace(/,\s*]/g, ']')
  fixed = fixed.replace(/([^"\w])'([^"']+)'/g, '$1"$2"')
  fixed = fixed.replace(/\n/g, ' ')
  fixed = fixed.replace(/\s+/g, ' ')
  fixed = fixed.replace(/"\s*:\s*"/g, '": "')
  fixed = fixed.replace(/"\s*,\s*"/g, '", "')
  
  fixed = fixed.replace(/\]\s*\[/g, '], [')
  fixed = fixed.replace(/\}\s*\{/g, '}, {')
  fixed = fixed.replace(/\]\s*\}/g, ']}')
  fixed = fixed.replace(/\}\s*\]/g, '}]')
  fixed = fixed.replace(/\[\s*"/g, '["')
  fixed = fixed.replace(/"\s*\]/g, '"]')
  fixed = fixed.replace(/,\s*,/g, ',')
  fixed = fixed.replace(/\[\s*,/g, '[')
  fixed = fixed.replace(/,\s*\]/g, ']')
  
  return fixed
}

function parseSummaryResponse(response: string): DailySummary | null {
  try {
    let jsonStr = response.trim()
    
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }
    
    jsonStr = jsonStr.trim()
    jsonStr = jsonStr
      .replace(/「/g, '[')
      .replace(/」/g, ']')
      .replace(/【/g, '{')
      .replace(/】/g, '}')
      .replace(/，/g, ',')
      .replace(/：/g, ':')
      .replace(/"/g, '"')
      .replace(/"/g, '"')
    
    try {
      const parsed = JSON.parse(jsonStr)
      
      return {
        date: getYesterdayDateString(),
        summary: parsed.summary || '',
        keyPoints: parsed.keyPoints || [],
        emotion: parsed.emotion || { primary: '平静', distribution: { '平静': 1 } },
        tasksCompleted: parsed.tasksCompleted || [],
        studyDuration: parsed.studyDuration || 0,
        weakPoints: parsed.weakPoints || [],
        achievements: parsed.achievements || [],
        learnedTopics: parsed.learnedTopics || [],
        practiceSummaries: parsed.practiceSummaries || [],
        totalPracticeCount: parsed.totalPracticeCount || 0,
        totalPracticeTime: parsed.totalPracticeTime || 0,
        overallPracticeAccuracy: parsed.overallPracticeAccuracy || 0,
        practiceAnalysis: parsed.practiceAnalysis || undefined
      }
    } catch (e) {
      console.error('[记忆归档] JSON修复失败:', e)
      
      const fixedJsonStr = tryFixJson(jsonStr)
      try {
        const parsed = JSON.parse(fixedJsonStr)
        
        return {
          date: getYesterdayDateString(),
          summary: parsed.summary || '',
          keyPoints: parsed.keyPoints || [],
          emotion: parsed.emotion || { primary: '平静', distribution: { '平静': 1 } },
          tasksCompleted: parsed.tasksCompleted || [],
          studyDuration: parsed.studyDuration || 0,
          weakPoints: parsed.weakPoints || [],
          achievements: parsed.achievements || [],
          learnedTopics: parsed.learnedTopics || [],
          practiceSummaries: parsed.practiceSummaries || [],
          totalPracticeCount: parsed.totalPracticeCount || 0,
          totalPracticeTime: parsed.totalPracticeTime || 0,
          overallPracticeAccuracy: parsed.overallPracticeAccuracy || 0,
          practiceAnalysis: parsed.practiceAnalysis || undefined
        }
      } catch (e2) {
        console.error('[记忆归档] JSON修复后仍失败:', e2)
        return null
      }
    }
  } catch (error) {
    console.error('Failed to parse summary response:', error)
    return null
  }
}

export function isValidSummary(summary: DailySummary | null): boolean {
  if (!summary) return false
  const hasValidSummary = summary.summary && summary.summary.trim() !== ''
  const hasValidDuration = summary.studyDuration > 0
  const hasValidKeyPoints = summary.keyPoints && summary.keyPoints.length > 0
  return hasValidSummary || hasValidDuration || hasValidKeyPoints
}

function createDefaultSummary(messages: ChatMessage[]): DailySummary {
  return {
    date: getYesterdayDateString(),
    summary: `今日共有${messages.length}条对话记录。`,
    keyPoints: [],
    emotion: { primary: '平静', distribution: { '平静': 1 } },
    tasksCompleted: [],
    studyDuration: Math.round(messages.length * 0.5),
    weakPoints: [],
    achievements: [],
    learnedTopics: [],
    practiceSummaries: [],
    totalPracticeCount: 0,
    totalPracticeTime: 0,
    overallPracticeAccuracy: 0
  }
}

interface ArchiveStatus {
  lastArchiveDate: string
  pendingArchive: boolean
  lastError?: string
}

function getArchiveStatus(): ArchiveStatus {
  try {
    const stored = localStorage.getItem(ARCHIVE_STATUS_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to get archive status:', error)
  }
  return {
    lastArchiveDate: '',
    pendingArchive: false
  }
}

function setArchiveStatus(status: Partial<ArchiveStatus>): void {
  try {
    const current = getArchiveStatus()
    const updated = { ...current, ...status }
    localStorage.setItem(ARCHIVE_STATUS_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Failed to set archive status:', error)
  }
}

class MemoryArchiveService {
  private isArchiving = false

  async cleanupExpiredImages(): Promise<void> {
    try {
      const cleanedByDays = await cleanupExpiredImages(7)
      const cleanedByLimit = await cleanupByStorageLimit(50)
      const totalCleaned = cleanedByDays + cleanedByLimit
      if (totalCleaned > 0) {
        console.log(`[图片清理] 共清理 ${totalCleaned} 张过期图片`)
      }
    } catch (error) {
      console.error('[图片清理] 清理失败:', error)
    }
  }

  async needsArchive(): Promise<boolean> {
    if (this.isArchiving) {
      return false
    }

    const memoryDate = await shortTermMemoryService.getDate()
    if (!memoryDate) {
      return false
    }

    const today = getTodayDateString()
    if (memoryDate === today) {
      return false
    }

    const messages = await shortTermMemoryService.getMessages()
    if (messages.length === 0) {
      return false
    }

    const status = getArchiveStatus()
    if (status.lastArchiveDate === memoryDate) {
      return false
    }

    return true
  }

  async generateSummary(
    messages: ChatMessage[], 
    llmCallFn?: (systemPrompt: string, userPrompt: string) => Promise<string>,
    practiceSummaries?: PracticeSummary[],
    tasks?: Task[]
  ): Promise<DailySummary> {
    const startTime = Date.now()
    
    if (messages.length === 0 && (!practiceSummaries || practiceSummaries.length === 0) && (!tasks || tasks.length === 0)) {
      memoryLogger.logSummaryGenerate('无消息记录', 'success', 0)
      return createDefaultSummary([])
    }

    if (!llmCallFn) {
      console.log('[记忆归档] 无LLM调用函数，使用默认总结')
      memoryLogger.logSummaryGenerate('无LLM函数', 'success', Date.now() - startTime)
      const summary = createDefaultSummary(messages)
      
      if (practiceSummaries && practiceSummaries.length > 0) {
        summary.practiceSummaries = practiceSummaries
        summary.totalPracticeCount = practiceSummaries.length
        summary.totalPracticeTime = practiceSummaries.reduce((sum, p) => sum + p.duration, 0)
        summary.overallPracticeAccuracy = practiceSummaries.length > 0 
          ? practiceSummaries.reduce((sum, p) => sum + p.accuracy, 0) / practiceSummaries.length 
          : 0
      }
      
      if (tasks && tasks.length > 0) {
        summary.tasksCompleted = tasks
          .filter(t => t.status === '已完成')
          .map(t => t.name)
      }
      
      return summary
    }

    try {
      console.log(`[记忆归档] 开始生成总结，共 ${messages.length} 条消息，${practiceSummaries?.length || 0} 个练习，${tasks?.length || 0} 个任务`)
      memoryLogger.logSummaryGenerate(`开始处理 ${messages.length} 条消息`, 'pending')
      
      const userPrompt = buildSummaryUserPrompt(messages, practiceSummaries, tasks)
      const response = await llmCallFn(SUMMARY_SYSTEM_PROMPT, userPrompt)
      
      const summary = parseSummaryResponse(response)
      const duration = Date.now() - startTime
      
      if (summary) {
        if (practiceSummaries && practiceSummaries.length > 0) {
          summary.practiceSummaries = practiceSummaries
          summary.totalPracticeCount = practiceSummaries.length
          summary.totalPracticeTime = practiceSummaries.reduce((sum, p) => sum + p.duration, 0)
          summary.overallPracticeAccuracy = practiceSummaries.length > 0 
            ? practiceSummaries.reduce((sum, p) => sum + p.accuracy, 0) / practiceSummaries.length 
            : 0
        }
        
        if (tasks && tasks.length > 0) {
          summary.tasksCompleted = tasks
            .filter(t => t.status === '已完成')
            .map(t => t.name)
        }
        
        memoryLogger.logSummaryGenerate(summary.summary.slice(0, 100), 'success', duration)
        console.log(`[记忆归档] 总结生成成功，耗时 ${duration}ms`)
        return summary
      }
      
      memoryLogger.logSummaryGenerate('解析失败，使用默认', 'success', duration)
      return createDefaultSummary(messages)
    } catch (error) {
      const duration = Date.now() - startTime
      memoryLogger.logSummaryFailed(String(error))
      console.error('Failed to generate summary:', error)
      return createDefaultSummary(messages)
    } finally {
      await this.cleanupExpiredImages()
    }
  }

  async generateIncrementalSummary(
    existingSummary: DailySummary,
    newMessages: ChatMessage[],
    newPractices: PracticeSummary[],
    llmCallFn?: (systemPrompt: string, userPrompt: string) => Promise<string>,
    tasks?: Task[]
  ): Promise<DailySummary> {
    const startTime = Date.now()
    
    if (!llmCallFn) {
      console.log('[记忆归档] 无LLM调用函数，简单合并')
      return this.mergeWithoutLLM(existingSummary, newMessages, newPractices, tasks)
    }

    try {
      const incrementalPrompt = this.buildIncrementalPrompt(existingSummary, newMessages, newPractices, tasks)
      const response = await llmCallFn(INCREMENTAL_SUMMARY_PROMPT, incrementalPrompt)
      
      const parsed = this.parseIncrementalResponse(response)
      const duration = Date.now() - startTime
      
      if (parsed) {
        if (tasks && tasks.length > 0) {
          parsed.tasksCompleted = tasks
            .filter(t => t.status === '已完成')
            .map(t => t.name)
        }
        memoryLogger.logSummaryGenerate(parsed.summary.slice(0, 100), 'success', duration)
        console.log(`[记忆归档] 增量总结生成成功，耗时 ${duration}ms`)
        return parsed
      }
      
      memoryLogger.logSummaryGenerate('解析失败，使用简单合并', 'success', duration)
      return this.mergeWithoutLLM(existingSummary, newMessages, newPractices, tasks)
    } catch (error) {
      const duration = Date.now() - startTime
      memoryLogger.logSummaryFailed(String(error))
      console.error('[记忆归档] 增量总结失败，使用简单合并:', error)
      return this.mergeWithoutLLM(existingSummary, newMessages, newPractices, tasks)
    } finally {
      await this.cleanupExpiredImages()
    }
  }

  private mergeWithoutLLM(
    existingSummary: DailySummary,
    newMessages: ChatMessage[],
    newPractices: PracticeSummary[],
    tasks?: Task[]
  ): DailySummary {
    const merged: DailySummary = {
      ...existingSummary,
      studyDuration: existingSummary.studyDuration + Math.round(newMessages.length * 0.5),
      keyPoints: [...new Set([...existingSummary.keyPoints, ...this.extractKeyPointsFromMessages(newMessages)])],
      weakPoints: [...new Set([...existingSummary.weakPoints, ...this.extractWeakPointsFromPractices(newPractices)])],
      achievements: existingSummary.achievements || [],
      learnedTopics: existingSummary.learnedTopics || [],
      practiceSummaries: [...(existingSummary.practiceSummaries || []), ...newPractices],
      totalPracticeCount: (existingSummary.totalPracticeCount || 0) + newPractices.length,
      totalPracticeTime: (existingSummary.totalPracticeTime || 0) + newPractices.reduce((sum, p) => sum + p.duration, 0)
    }

    if (newPractices.length > 0) {
      const newAccuracy = newPractices.reduce((sum, p) => sum + p.accuracy, 0) / newPractices.length
      const existingAccuracy = existingSummary.overallPracticeAccuracy || 0
      const existingCount = existingSummary.totalPracticeCount || 0
      merged.overallPracticeAccuracy = existingCount > 0 
        ? (existingAccuracy * existingCount + newAccuracy * newPractices.length) / (existingCount + newPractices.length)
        : newAccuracy
    }

    if (tasks && tasks.length > 0) {
      const completedTaskNames = tasks
        .filter(t => t.status === '已完成')
        .map(t => t.name)
      merged.tasksCompleted = [...new Set([...existingSummary.tasksCompleted, ...completedTaskNames])]
    }

    merged.summary = `${existingSummary.summary}（后续新增 ${newMessages.length} 条对话和 ${newPractices.length} 个练习）`

    return merged
  }

  private buildIncrementalPrompt(
    existingSummary: DailySummary,
    newMessages: ChatMessage[],
    newPractices: PracticeSummary[],
    tasks?: Task[]
  ): string {
    let prompt = `【已有总结】
日期: ${existingSummary.date}
总结: ${existingSummary.summary}
知识点: ${existingSummary.keyPoints.join('、')}
薄弱点: ${existingSummary.weakPoints.join('、')}
学习时长: ${existingSummary.studyDuration}分钟
`

    if (existingSummary.practiceAnalysis) {
      prompt += `练习分析: 
- 整体表现: ${existingSummary.practiceAnalysis.overallPerformance}
- 亮点: ${existingSummary.practiceAnalysis.practiceHighlights.join('、')}
- 需改进: ${existingSummary.practiceAnalysis.areasToImprove.join('、')}
`
    }

    prompt += `\n【新增内容】\n`

    if (newMessages.length > 0) {
      prompt += `\n新增对话记录 (${newMessages.length}条):\n`
      newMessages.slice(-10).forEach(m => {
        const role = m.role === 'user' ? '学生' : 'AI助手'
        prompt += `[${m.timestamp}] ${role}: ${m.content}\n`
      })
    }

    if (newPractices.length > 0) {
      prompt += `\n新增练习记录 (${newPractices.length}个):\n`
      newPractices.forEach((p, i) => {
        prompt += `练习${i + 1}: ${p.practiceType}, ${p.correctCount}/${p.totalQuestions}正确, 表现${p.performance}\n`
        if (p.weakTopics.length > 0) {
          prompt += `  薄弱知识点: ${p.weakTopics.join('、')}\n`
        }
      })
    }

    if (tasks && tasks.length > 0) {
      prompt += buildTaskDataPrompt(tasks)
    }

    prompt += `\n请合并生成完整的JSON格式学习总结。`

    return prompt
  }

  private parseIncrementalResponse(response: string): DailySummary | null {
    try {
      let jsonStr = response.trim()
      
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7)
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3)
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3)
      }
      
      jsonStr = jsonStr.trim()
      jsonStr = jsonStr
        .replace(/「/g, '[')
        .replace(/」/g, ']')
        .replace(/【/g, '{')
        .replace(/】/g, '}')
        .replace(/，/g, ',')
        .replace(/：/g, ':')
        .replace(/"/g, '"')
        .replace(/"/g, '"')
      
      let parsed: any = null
      
      try {
        parsed = JSON.parse(jsonStr)
      } catch (parseError) {
        console.error('[记忆归档] JSON解析失败，尝试修复:', parseError)
        console.log('[记忆归档] 原始响应:', response.slice(0, 500))
        
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            const fixedJson = this.tryFixJson(jsonMatch[0])
            parsed = JSON.parse(fixedJson)
          } catch (e) {
            console.error('[记忆归档] JSON修复失败:', e)
            return null
          }
        } else {
          console.error('[记忆归档] 未找到JSON对象')
          return null
        }
      }
      
      if (!parsed || typeof parsed !== 'object') {
        console.error('[记忆归档] 解析结果无效')
        return null
      }
      
      if (!parsed.summary && !parsed.keyPoints?.length && !parsed.studyDuration) {
        console.error('[记忆归档] 解析结果缺少必要字段，拒绝返回空数据')
        return null
      }
      
      return {
        date: parsed.date || getTodayDateString(),
        summary: parsed.summary || '',
        keyPoints: parsed.keyPoints || [],
        emotion: parsed.emotion || { primary: '平静', distribution: { '平静': 1 } },
        tasksCompleted: parsed.tasksCompleted || [],
        studyDuration: parsed.studyDuration || 0,
        weakPoints: parsed.weakPoints || [],
        achievements: parsed.achievements || [],
        learnedTopics: parsed.learnedTopics || [],
        practiceSummaries: parsed.practiceSummaries || [],
        totalPracticeCount: parsed.totalPracticeCount || 0,
        totalPracticeTime: parsed.totalPracticeTime || 0,
        overallPracticeAccuracy: parsed.overallPracticeAccuracy || 0,
        practiceAnalysis: parsed.practiceAnalysis || undefined
      }
    } catch (error) {
      console.error('Failed to parse incremental response:', error)
      return null
    }
  }

  private tryFixJson(jsonStr: string): string {
    let fixed = jsonStr
    
    fixed = fixed.replace(/,\s*}/g, '}')
    fixed = fixed.replace(/,\s*]/g, ']')
    fixed = fixed.replace(/([^"\w])'([^"']+)'/g, '$1"$2"')
    fixed = fixed.replace(/\n/g, ' ')
    fixed = fixed.replace(/\s+/g, ' ')
    fixed = fixed.replace(/"\s*:\s*"/g, '": "')
    fixed = fixed.replace(/"\s*,\s*"/g, '", "')
    
    fixed = fixed.replace(/\]\s*\[/g, '], [')
    fixed = fixed.replace(/\}\s*\{/g, '}, {')
    fixed = fixed.replace(/\]\s*\}/g, ']}')
    fixed = fixed.replace(/\}\s*\]/g, '}]')
    fixed = fixed.replace(/\[\s*"/g, '["')
    fixed = fixed.replace(/"\s*\]/g, '"]')
    fixed = fixed.replace(/,\s*,/g, ',')
    fixed = fixed.replace(/\[\s*,/g, '[')
    fixed = fixed.replace(/,\s*\]/g, ']')
    
    return fixed
  }

  private extractKeyPointsFromMessages(messages: ChatMessage[]): string[] {
    const keywords: string[] = []
    const subjectPatterns = [
      /数学|语文|英语|科学|物理|化学|生物|历史|地理/g,
      /加减乘除|分数|小数|方程|几何|代数/g,
      /阅读|作文|古诗|文言文|拼音|汉字/g,
      /单词|语法|听力|口语|写作/g
    ]
    
    messages.forEach(m => {
      subjectPatterns.forEach(pattern => {
        const matches = m.content.match(pattern)
        if (matches) {
          keywords.push(...matches)
        }
      })
    })
    
    return [...new Set(keywords)].slice(0, 5)
  }

  private extractWeakPointsFromPractices(practices: PracticeSummary[]): string[] {
    const weakPoints: string[] = []
    practices.forEach(p => {
      if (p.weakTopics) {
        weakPoints.push(...p.weakTopics)
      }
    })
    return [...new Set(weakPoints)]
  }

  async archive(llmCallFn?: (systemPrompt: string, userPrompt: string) => Promise<string>): Promise<ArchiveResult> {
    if (this.isArchiving) {
      return { archived: false, error: 'Archive already in progress' }
    }

    this.isArchiving = true
    const startTime = Date.now()
    
    console.log('[记忆归档] 开始归档流程')
    memoryLogger.logArchiveStart(0)

    try {
      const memoryDate = await shortTermMemoryService.getDate()
      if (!memoryDate) {
        memoryLogger.logArchiveFailed('未找到记忆日期')
        return { archived: false, error: 'No memory date found' }
      }

      const messages = await shortTermMemoryService.getMessages()
      if (messages.length === 0) {
        memoryLogger.logArchiveFailed('无消息可归档')
        await shortTermMemoryService.initializeTodayMemory()
        return { archived: false, error: 'No messages to archive' }
      }

      memoryLogger.logArchiveStart(messages.length)
      console.log(`[记忆归档] 归档日期: ${memoryDate}，消息数: ${messages.length}`)

      await backupMemoryWithType('short')
      await backupMemoryWithType('long')
      console.log('[记忆归档] 备份完成')

      const tasks = await getTasksByDate(memoryDate)
      console.log(`[记忆归档] 当日任务数: ${tasks.length}`)

      const summary = await this.generateSummary(messages, llmCallFn, undefined, tasks)
      summary.date = memoryDate
      console.log(`[记忆归档] 总结生成完成: ${summary.summary.slice(0, 50)}...`)

      await longTermMemoryService.addDailySummary(summary)
      console.log('[记忆归档] 日总结已添加到长期记忆')

      for (const learnedTopic of summary.learnedTopics) {
        const existingRecord = await longTermMemoryService.getTopicRecord(learnedTopic.topic)
        if (existingRecord) {
          await longTermMemoryService.updateTopicRecord(learnedTopic.topic, {
            masteryLevel: learnedTopic.masteryLevel,
            practiceCount: existingRecord.practiceCount + learnedTopic.practiceCount,
            correctRate: (existingRecord.correctRate + learnedTopic.correctRate) / 2,
            lastReviewDate: memoryDate
          })
        } else {
          await longTermMemoryService.updateTopicRecord(learnedTopic.topic, {
            firstLearnedDate: memoryDate,
            lastReviewDate: memoryDate,
            masteryLevel: learnedTopic.masteryLevel,
            practiceCount: learnedTopic.practiceCount,
            correctRate: learnedTopic.correctRate
          })
        }
      }
      console.log(`[记忆归档] 已更新 ${summary.learnedTopics.length} 个知识点记录`)

      const currentKnowledge = await longTermMemoryService.getAccumulatedKnowledge()
      const newMasteredTopics = [...new Set([...currentKnowledge.masteredTopics, ...summary.keyPoints])]
      const newWeakTopics = [...new Set([...currentKnowledge.weakTopics, ...summary.weakPoints])]
      
      await longTermMemoryService.updateAccumulatedKnowledge({
        masteredTopics: newMasteredTopics,
        weakTopics: newWeakTopics,
        totalStudyDays: currentKnowledge.totalStudyDays + 1,
        totalStudyHours: currentKnowledge.totalStudyHours + (summary.studyDuration / 60)
      })
      console.log('[记忆归档] 累计知识已更新')

      await shortTermMemoryService.clear()
      memoryLogger.logShortTermClear('success')
      console.log('[记忆归档] 短期记忆已清除')
      
      await shortTermMemoryService.initializeTodayMemory()
      console.log('[记忆归档] 今日记忆已初始化')

      setArchiveStatus({
        lastArchiveDate: memoryDate,
        pendingArchive: false
      })

      const duration = Date.now() - startTime
      memoryLogger.logArchiveComplete(memoryDate)
      console.log(`[记忆归档] ✅ 归档完成，总耗时 ${duration}ms`)

      return { archived: true, summary }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const duration = Date.now() - startTime
      
      memoryLogger.logArchiveFailed(errorMessage)
      console.error(`[记忆归档] ❌ 归档失败 (${duration}ms):`, error)
      
      setArchiveStatus({
        pendingArchive: true,
        lastError: errorMessage
      })

      return { archived: false, error: errorMessage }
    } finally {
      this.isArchiving = false
    }
  }

  async checkAndArchive(llmCallFn?: (systemPrompt: string, userPrompt: string) => Promise<string>): Promise<ArchiveResult> {
    const needsArchive = await this.needsArchive()
    
    if (!needsArchive) {
      return { archived: false }
    }

    return this.archive(llmCallFn)
  }

  getArchiveStatus(): ArchiveStatus {
    return getArchiveStatus()
  }

  clearArchiveStatus(): void {
    localStorage.removeItem(ARCHIVE_STATUS_KEY)
  }
}

export const memoryArchiveService = new MemoryArchiveService()

export async function checkAndArchiveMemory(llmCallFn?: (systemPrompt: string, userPrompt: string) => Promise<string>): Promise<ArchiveResult> {
  return memoryArchiveService.checkAndArchive(llmCallFn)
}

export async function archiveMemory(llmCallFn?: (systemPrompt: string, userPrompt: string) => Promise<string>): Promise<ArchiveResult> {
  return memoryArchiveService.archive(llmCallFn)
}

export async function needsArchiveMemory(): Promise<boolean> {
  return memoryArchiveService.needsArchive()
}

export default memoryArchiveService
