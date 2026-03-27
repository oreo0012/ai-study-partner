export type LogLevel = 'info' | 'warn' | 'error' | 'debug'
export type MemoryOperationType = 
  | 'SUMMARY_GENERATE' 
  | 'SUMMARY_SUCCESS' 
  | 'SUMMARY_FAILED'
  | 'MEMORY_UPDATE'
  | 'MEMORY_LOAD'
  | 'MEMORY_SAVE'
  | 'ARCHIVE_START'
  | 'ARCHIVE_COMPLETE'
  | 'ARCHIVE_FAILED'
  | 'SHORT_TERM_CLEAR'

export interface MemoryLogEntry {
  timestamp: string
  level: LogLevel
  operationType: MemoryOperationType
  message: string
  data?: Record<string, unknown>
  duration?: number
  status: 'success' | 'failed' | 'pending'
}

const LOG_STORAGE_KEY = 'ai_study_memory_logs'
const MAX_LOG_ENTRIES = 500

class MemoryLogger {
  private logs: MemoryLogEntry[] = []
  private initialized = false

  constructor() {
    this.loadLogs()
  }

  private loadLogs(): void {
    try {
      const stored = localStorage.getItem(LOG_STORAGE_KEY)
      if (stored) {
        this.logs = JSON.parse(stored)
      }
      this.initialized = true
    } catch (error) {
      console.error('Failed to load memory logs:', error)
      this.logs = []
    }
  }

  private saveLogs(): void {
    try {
      if (this.logs.length > MAX_LOG_ENTRIES) {
        this.logs = this.logs.slice(-MAX_LOG_ENTRIES)
      }
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.logs))
    } catch (error) {
      console.error('Failed to save memory logs:', error)
    }
  }

  private formatTimestamp(): string {
    return new Date().toISOString()
  }

  private formatLogForConsole(entry: MemoryLogEntry): string {
    const time = new Date(entry.timestamp).toLocaleString('zh-CN')
    const statusIcon = entry.status === 'success' ? '✅' : entry.status === 'failed' ? '❌' : '⏳'
    return `[${time}] ${statusIcon} [${entry.operationType}] ${entry.message}`
  }

  log(
    operationType: MemoryOperationType,
    message: string,
    options: {
      level?: LogLevel
      data?: Record<string, unknown>
      duration?: number
      status: 'success' | 'failed' | 'pending'
    }
  ): MemoryLogEntry {
    const entry: MemoryLogEntry = {
      timestamp: this.formatTimestamp(),
      level: options.level || 'info',
      operationType,
      message,
      data: options.data,
      duration: options.duration,
      status: options.status
    }

    this.logs.push(entry)
    this.saveLogs()

    const consoleMessage = this.formatLogForConsole(entry)
    switch (entry.level) {
      case 'error':
        console.error(consoleMessage, options.data || '')
        break
      case 'warn':
        console.warn(consoleMessage, options.data || '')
        break
      case 'debug':
        console.debug(consoleMessage, options.data || '')
        break
      default:
        console.log(consoleMessage, options.data || '')
    }

    return entry
  }

  logSummaryGenerate(summaryContent: string, status: 'success' | 'failed', duration?: number): void {
    this.log('SUMMARY_GENERATE', '生成学习总结', {
      status,
      duration,
      data: {
        summaryLength: summaryContent.length,
        summaryPreview: summaryContent.slice(0, 100) + '...'
      }
    })
  }

  logSummarySuccess(summary: { date: string; keyPoints: string[]; studyDuration: number }): void {
    this.log('SUMMARY_SUCCESS', '学习总结生成成功', {
      status: 'success',
      data: {
        date: summary.date,
        keyPointsCount: summary.keyPoints.length,
        studyDuration: summary.studyDuration
      }
    })
  }

  logSummaryFailed(error: string): void {
    this.log('SUMMARY_FAILED', `学习总结生成失败: ${error}`, {
      level: 'error',
      status: 'failed',
      data: { error }
    })
  }

  logMemoryUpdate(beforeData: unknown, afterData: unknown, affectedFields: string[]): void {
    this.log('MEMORY_UPDATE', '长期记忆更新', {
      status: 'success',
      data: {
        affectedFields,
        before: beforeData,
        after: afterData
      }
    })
  }

  logMemoryLoad(status: 'success' | 'failed', dataSize?: number): void {
    this.log('MEMORY_LOAD', '加载长期记忆数据', {
      status,
      data: { dataSize }
    })
  }

  logMemorySave(status: 'success' | 'failed', dataSize?: number): void {
    this.log('MEMORY_SAVE', '保存长期记忆数据', {
      status,
      data: { dataSize }
    })
  }

  logArchiveStart(messageCount: number): void {
    this.log('ARCHIVE_START', `开始记忆归档，共${messageCount}条消息`, {
      status: 'pending',
      data: { messageCount }
    })
  }

  logArchiveComplete(summaryDate: string): void {
    this.log('ARCHIVE_COMPLETE', `记忆归档完成，日期: ${summaryDate}`, {
      status: 'success',
      data: { summaryDate }
    })
  }

  logArchiveFailed(error: string): void {
    this.log('ARCHIVE_FAILED', `记忆归档失败: ${error}`, {
      level: 'error',
      status: 'failed',
      data: { error }
    })
  }

  logShortTermClear(status: 'success' | 'failed'): void {
    this.log('SHORT_TERM_CLEAR', '清除短期记忆', {
      status,
      data: {}
    })
  }

  getLogs(limit?: number): MemoryLogEntry[] {
    if (limit) {
      return this.logs.slice(-limit)
    }
    return [...this.logs]
  }

  getLogsByOperation(operationType: MemoryOperationType): MemoryLogEntry[] {
    return this.logs.filter(log => log.operationType === operationType)
  }

  getLogsByDate(date: string): MemoryLogEntry[] {
    return this.logs.filter(log => log.timestamp.startsWith(date))
  }

  clearLogs(): void {
    this.logs = []
    localStorage.removeItem(LOG_STORAGE_KEY)
  }

  getRecentErrors(count: number = 10): MemoryLogEntry[] {
    return this.logs
      .filter(log => log.level === 'error' || log.status === 'failed')
      .slice(-count)
  }
}

export const memoryLogger = new MemoryLogger()

export function logMemoryOperation(
  operationType: MemoryOperationType,
  message: string,
  options: {
    level?: LogLevel
    data?: Record<string, unknown>
    duration?: number
    status: 'success' | 'failed' | 'pending'
  }
): MemoryLogEntry {
  return memoryLogger.log(operationType, message, options)
}

export default memoryLogger
