import type { ShortTermMemoryData, DailySummary, ChatMessage, PracticeSummary, Task } from '@/config/types'
import { shortTermMemoryService } from './short-term-memory'
import { longTermMemoryService } from './long-term-memory'
import { memoryArchiveService } from './memory-archive'
import { memoryLogger } from './memory-logger'
import { loadShortTermMemory, getTasksByDate } from './data-service'

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

function getCurrentTimestamp(): string {
  return new Date().toISOString()
}

type LLMCallFn = (systemPrompt: string, userPrompt: string) => Promise<string>

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

export class MemoryStartupCheckService {
  private isProcessing = false

  async checkAndProcessMemory(llmCallFn?: LLMCallFn): Promise<void> {
    if (this.isProcessing) {
      console.log('[启动检测] 已有处理任务在进行中，跳过')
      return
    }

    this.isProcessing = true
    const startTime = Date.now()
    
    try {
      console.log('[启动检测] 开始检查短期记忆...')
      
      const memory = await loadShortTermMemory()
      const today = getTodayDateString()
      
      if (memory.date === today) {
        console.log('[启动检测] 短期记忆是今天的，无需处理')
        return
      }
      
      console.log(`[启动检测] 发现非今日短期记忆: ${memory.date}`)
      await this.processNonTodayMemory(memory, llmCallFn)
      
      await shortTermMemoryService.initializeTodayMemory()
      console.log('[启动检测] 已初始化今日短期记忆')
      
      const duration = Date.now() - startTime
      console.log(`[启动检测] 处理完成，耗时 ${duration}ms`)
      
    } catch (error) {
      console.error('[启动检测] 处理失败:', error)
    } finally {
      this.isProcessing = false
    }
  }

  private async processNonTodayMemory(memory: ShortTermMemoryData, llmCallFn?: LLMCallFn): Promise<void> {
    const memoryDate = memory.date
    
    if (memory.status === 'summarized') {
      console.log(`[启动检测] 短期记忆 ${memoryDate} 已总结，直接清除`)
      memoryLogger.logShortTermClear('success')
      return
    }
    
    console.log(`[启动检测] 短期记忆 ${memoryDate} 未总结，开始自动总结`)
    await this.autoSummarize(memory, llmCallFn)
  }

  private async autoSummarize(memory: ShortTermMemoryData, llmCallFn?: LLMCallFn): Promise<void> {
    const memoryDate = memory.date
    const messages = memory.messages || []
    const practices = memory.practiceSummaries || []
    
    if (messages.length === 0 && practices.length === 0) {
      console.log(`[启动检测] 短期记忆 ${memoryDate} 无内容，跳过总结`)
      return
    }
    
    try {
      const tasks = await getTasksByDate(memoryDate)
      console.log(`[启动检测] 当日任务数: ${tasks.length}`)
      
      memoryLogger.logArchiveStart(messages.length)
      console.log(`[启动检测] 自动总结 ${memoryDate}: ${messages.length} 条消息, ${practices.length} 个练习, ${tasks.length} 个任务`)
      
      const existingSummary = await longTermMemoryService.getSummaryByDate(memoryDate)
      
      let summary: DailySummary
      
      if (existingSummary) {
        console.log(`[启动检测] 发现已有 ${memoryDate} 的长期记忆，进行增量更新`)
        summary = await this.generateIncrementalSummary(existingSummary, messages, practices, llmCallFn, tasks)
      } else {
        console.log(`[启动检测] 首次总结 ${memoryDate}`)
        summary = await memoryArchiveService.generateSummary(messages, llmCallFn, practices, tasks)
      }
      
      summary.date = memoryDate
      
      if (practices.length > 0) {
        summary.practiceSummaries = practices
        summary.totalPracticeCount = practices.length
        summary.totalPracticeTime = practices.reduce((sum, p) => sum + p.duration, 0)
        summary.overallPracticeAccuracy = practices.length > 0 
          ? practices.reduce((sum, p) => sum + p.accuracy, 0) / practices.length 
          : 0
      }
      
      await longTermMemoryService.addDailySummary(summary)
      memoryLogger.logArchiveComplete(memoryDate)
      console.log(`[启动检测] ${memoryDate} 总结已保存到长期记忆`)
      
    } catch (error) {
      memoryLogger.logArchiveFailed(String(error))
      console.error(`[启动检测] 自动总结 ${memoryDate} 失败:`, error)
    }
  }

  private async generateIncrementalSummary(
    existingSummary: DailySummary,
    newMessages: ChatMessage[],
    newPractices: PracticeSummary[],
    llmCallFn?: LLMCallFn,
    tasks?: Task[]
  ): Promise<DailySummary> {
    if (!llmCallFn) {
      console.log('[启动检测] 无LLM调用函数，合并现有数据')
      return this.mergeWithoutLLM(existingSummary, newMessages, newPractices, tasks)
    }

    try {
      const incrementalPrompt = this.buildIncrementalPrompt(existingSummary, newMessages, newPractices, tasks)
      const response = await llmCallFn(INCREMENTAL_SUMMARY_PROMPT, incrementalPrompt)
      
      const parsed = this.parseIncrementalResponse(response)
      if (parsed) {
        if (tasks && tasks.length > 0) {
          parsed.tasksCompleted = tasks
            .filter(t => t.status === '已完成')
            .map(t => t.name)
        }
        return parsed
      }
      
      return this.mergeWithoutLLM(existingSummary, newMessages, newPractices, tasks)
    } catch (error) {
      console.error('[启动检测] 增量总结失败，使用简单合并:', error)
      return this.mergeWithoutLLM(existingSummary, newMessages, newPractices, tasks)
    }
  }

  private mergeWithoutLLM(
    existing: DailySummary,
    newMessages: ChatMessage[],
    newPractices: PracticeSummary[],
    tasks?: Task[]
  ): DailySummary {
    const merged: DailySummary = {
      ...existing,
      studyDuration: existing.studyDuration + Math.round(newMessages.length * 0.5),
      keyPoints: [...new Set([...existing.keyPoints, ...this.extractKeyPointsFromMessages(newMessages)])],
      weakPoints: [...new Set([...existing.weakPoints, ...this.extractWeakPointsFromPractices(newPractices)])],
      achievements: existing.achievements || [],
      learnedTopics: existing.learnedTopics || [],
      practiceSummaries: [...(existing.practiceSummaries || []), ...newPractices],
      totalPracticeCount: (existing.totalPracticeCount || 0) + newPractices.length,
      totalPracticeTime: (existing.totalPracticeTime || 0) + newPractices.reduce((sum, p) => sum + p.duration, 0)
    }

    if (newPractices.length > 0) {
      const newAccuracy = newPractices.reduce((sum, p) => sum + p.accuracy, 0) / newPractices.length
      const existingAccuracy = existing.overallPracticeAccuracy || 0
      const existingCount = existing.totalPracticeCount || 0
      merged.overallPracticeAccuracy = existingCount > 0 
        ? (existingAccuracy * existingCount + newAccuracy * newPractices.length) / (existingCount + newPractices.length)
        : newAccuracy
    }

    if (tasks && tasks.length > 0) {
      const completedTaskNames = tasks
        .filter(t => t.status === '已完成')
        .map(t => t.name)
      merged.tasksCompleted = [...new Set([...existing.tasksCompleted, ...completedTaskNames])]
    }

    merged.summary = `${existing.summary}（后续新增 ${newMessages.length} 条对话和 ${newPractices.length} 个练习）`

    return merged
  }

  private buildIncrementalPrompt(
    existing: DailySummary,
    newMessages: ChatMessage[],
    newPractices: PracticeSummary[],
    tasks?: Task[]
  ): string {
    let prompt = `【已有总结】
日期: ${existing.date}
总结: ${existing.summary}
知识点: ${existing.keyPoints.join('、')}
薄弱点: ${existing.weakPoints.join('、')}
学习时长: ${existing.studyDuration}分钟
`

    if (existing.practiceAnalysis) {
      prompt += `练习分析: 
- 整体表现: ${existing.practiceAnalysis.overallPerformance}
- 亮点: ${existing.practiceAnalysis.practiceHighlights.join('、')}
- 需改进: ${existing.practiceAnalysis.areasToImprove.join('、')}
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
      
      const parsed = JSON.parse(jsonStr.trim())
      
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
}

const INCREMENTAL_SUMMARY_PROMPT = `你是一个专业的学习分析助手，负责将新增的学习内容与已有的每日总结进行合并更新。

请根据已有的总结和新增内容，生成一个完整的学习总结，包含以下字段：

【基础学习总结】
1. summary: 合并后的学习总结（100-200字），综合描述当日所有学习情况
2. keyPoints: 合并后的关键知识点列表（数组）
3. emotion: 情绪状态统计，包含primary和distribution
4. tasksCompleted: 完成的任务列表
5. studyDuration: 总学习时长（分钟）
6. weakPoints: 合并后的薄弱知识点列表
7. achievements: 当日成就列表
8. learnedTopics: 学习的知识点详情数组

【自主练习总结】
9. practiceAnalysis: 练习分析对象（如有练习数据）

要求：
- 合并已有总结和新增内容，生成完整的总结
- 不要简单拼接，要有机整合
- 更新学习时长和知识点列表
- 保持总结的连贯性和完整性

请只返回JSON格式的数据，不要包含其他文字。`

export const memoryStartupCheckService = new MemoryStartupCheckService()
export default memoryStartupCheckService
