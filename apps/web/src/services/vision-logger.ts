type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

interface LogEntry {
  requestId: string
  timestamp: string
  level: LogLevel
  module: string
  message: string
  duration?: number
  data?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

const LOG_STORAGE_KEY = 'vision_recognition_logs'
const MAX_LOG_ENTRIES = 1000

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function formatTimestamp(): string {
  return new Date().toISOString()
}

function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  const sensitiveKeys = ['apiKey', 'api_key', 'token', 'password', 'secret', 'authorization']
  
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '***REDACTED***'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

function formatLogEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level}]`,
    `[${entry.module}]`,
    `[${entry.requestId}]`,
    entry.message
  ]
  
  if (entry.duration !== undefined) {
    parts.push(`(${entry.duration}ms)`)
  }
  
  if (entry.data) {
    parts.push(`| ${JSON.stringify(entry.data)}`)
  }
  
  if (entry.error) {
    parts.push(`\n  Error: ${entry.error.name}: ${entry.error.message}`)
    if (entry.error.stack) {
      parts.push(`\n  Stack: ${entry.error.stack}`)
    }
  }
  
  return parts.join(' ')
}

function saveLogToStorage(entry: LogEntry): void {
  try {
    const stored = localStorage.getItem(LOG_STORAGE_KEY)
    const logs: LogEntry[] = stored ? JSON.parse(stored) : []
    
    logs.push(entry)
    
    if (logs.length > MAX_LOG_ENTRIES) {
      logs.splice(0, logs.length - MAX_LOG_ENTRIES)
    }
    
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs))
  } catch (e) {
    console.warn('Failed to save log to storage:', e)
  }
}

class VisionLogger {
  private module: string
  private requestId: string
  private startTime: number

  constructor(module: string, requestId?: string) {
    this.module = module
    this.requestId = requestId || generateRequestId()
    this.startTime = Date.now()
  }

  getRequestId(): string {
    return this.requestId
  }

  getModule(): string {
    return this.module
  }

  getElapsedTime(): number {
    return Date.now() - this.startTime
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('INFO', message, data)
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('WARN', message, data)
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      requestId: this.requestId,
      timestamp: formatTimestamp(),
      level: 'ERROR',
      module: this.module,
      message,
      duration: this.getElapsedTime(),
      data: data ? sanitizeData(data) : undefined,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    }
    
    console.error(formatLogEntry(entry))
    saveLogToStorage(entry)
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (import.meta.env.DEV) {
      this.log('DEBUG', message, data)
    }
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      requestId: this.requestId,
      timestamp: formatTimestamp(),
      level,
      module: this.module,
      message,
      duration: this.getElapsedTime(),
      data: data ? sanitizeData(data) : undefined
    }
    
    const formatted = formatLogEntry(entry)
    
    switch (level) {
      case 'ERROR':
        console.error(formatted)
        break
      case 'WARN':
        console.warn(formatted)
        break
      case 'DEBUG':
        console.debug(formatted)
        break
      default:
        console.log(formatted)
    }
    
    saveLogToStorage(entry)
  }

  logPhaseStart(phase: string, data?: Record<string, unknown>): void {
    this.info(`[START] ${phase}`, data)
  }

  logPhaseEnd(phase: string, data?: Record<string, unknown>): void {
    this.info(`[END] ${phase}`, {
      ...data,
      phaseDuration: this.getElapsedTime()
    })
  }

  logSuccess(message: string, data?: Record<string, unknown>): void {
    this.info(`[SUCCESS] ${message}`, data)
  }

  logFailure(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.error(message, error, data)
  }
}

export function createLogger(module: string, requestId?: string): VisionLogger {
  return new VisionLogger(module, requestId)
}

export function generateNewRequestId(): string {
  return generateRequestId()
}

export function getStoredLogs(): LogEntry[] {
  try {
    const stored = localStorage.getItem(LOG_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function clearStoredLogs(): void {
  localStorage.removeItem(LOG_STORAGE_KEY)
}

export function exportLogsAsString(): string {
  const logs = getStoredLogs()
  return logs.map(formatLogEntry).join('\n')
}

export type { LogEntry, LogLevel }
export { VisionLogger }
