export interface FormatFilterOptions {
  enableStreamFilter?: boolean
  bufferSize?: number
  replaceBrackets?: boolean
}

export interface FormatFilterState {
  buffer: string
  filteredCount: number
}

const SPECIAL_CHARS_PATTERNS = [
  /\*\*([^*]+)\*\*/g,
  /##\s*([^\n#]+)/g,
  /#+\s*([^\n#]+)/g,
  /```[\s\S]*?```/g,
  /`([^`]+)`/g,
  /<[^>]+>/g,
]

const BRACKET_PATTERNS = [
  /【([^】]+)】/g,
  /\[([^\]]+)\]/g,
  /\|([^|]+)\|/g,
]

export class FormatFilter {
  private state: FormatFilterState = {
    buffer: '',
    filteredCount: 0
  }

  private options: Required<FormatFilterOptions>

  constructor(options: FormatFilterOptions = {}) {
    this.options = {
      enableStreamFilter: options.enableStreamFilter ?? true,
      bufferSize: options.bufferSize ?? 1024,
      replaceBrackets: options.replaceBrackets ?? true
    }
  }

  filter(text: string): string {
    let result = text

    for (const pattern of SPECIAL_CHARS_PATTERNS) {
      const matches = result.match(pattern)
      if (matches) {
        this.state.filteredCount += matches.length
      }
      result = result.replace(pattern, '$1')
    }

    if (this.options.replaceBrackets) {
      result = this.replaceBrackets(result)
    }

    result = result.trim()

    return result
  }

  private replaceBrackets(text: string): string {
    let result = text
    for (const pattern of BRACKET_PATTERNS) {
      const matches = result.match(pattern)
      if (matches) {
        this.state.filteredCount += matches.length
      }
      result = result.replace(pattern, '「$1」')
    }
    return result
  }

  filterStream(chunk: string): string {
    if (!this.options.enableStreamFilter) {
      return this.filter(chunk)
    }

    this.state.buffer += chunk

    if (this.state.buffer.length > this.options.bufferSize) {
      this.state.buffer = this.state.buffer.slice(-this.options.bufferSize)
    }

    let result = this.filter(this.state.buffer)
    this.state.buffer = ''

    return result
  }

  finalize(pendingText?: string): string {
    let result = this.state.buffer

    if (pendingText) {
      result += pendingText
    }

    this.state.buffer = ''

    return this.filter(result)
  }

  reset(): void {
    this.state = {
      buffer: '',
      filteredCount: 0
    }
  }

  getState(): FormatFilterState {
    return { ...this.state }
  }

  getFilteredCount(): number {
    return this.state.filteredCount
  }
}

export function filterSpecialChars(text: string): string {
  let result = text

  for (const pattern of SPECIAL_CHARS_PATTERNS) {
    result = result.replace(pattern, '$1')
  }

  for (const pattern of BRACKET_PATTERNS) {
    result = result.replace(pattern, '「$1」')
  }

  return result.trim()
}

export function hasSpecialChars(text: string): boolean {
  const patterns = [...SPECIAL_CHARS_PATTERNS, ...BRACKET_PATTERNS]
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return true
    }
  }
  return false
}

export function createFormatFilter(options?: FormatFilterOptions): FormatFilter {
  return new FormatFilter(options)
}
