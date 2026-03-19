export interface ThinkFilterOptions {
  enableStreamFilter?: boolean
  bufferSize?: number
}

export interface ThinkFilterState {
  isInThinkBlock: boolean
  buffer: string
  filteredCount: number
}

const THINK_TAG_PATTERNS = [
  /<think[\s\S]*?<\/think>/gi,
  /<thinking[\s\S]*?<\/thinking>/gi,
  /<thought[\s\S]*?<\/thought>/gi,
  /<reasoning[\s\S]*?<\/reasoning>/gi,
  /<reflection[\s\S]*?<\/reflection>/gi,
  /【思考】[\s\S]*?【\/思考】/g,
  /【思维过程】[\s\S]*?【\/思维过程】/g,
  /【推理】[\s\S]*?【\/推理】/g,
]

const THINK_START_PATTERNS = [
  /<think[^>]*>/i,
  /<thinking[^>]*>/i,
  /<thought[^>]*>/i,
  /<reasoning[^>]*>/i,
  /<reflection[^>]*>/i,
  /【思考】/i,
  /【思维过程】/i,
  /【推理】/i,
]

const THINK_END_PATTERNS = [
  /<\/think>/i,
  /<\/thinking>/i,
  /<\/thought>/i,
  /<\/reasoning>/i,
  /<\/reflection>/i,
  /【\/思考】/i,
  /【\/思维过程】/i,
  /【\/推理】/i,
]

export class ThinkFilter {
  private state: ThinkFilterState = {
    isInThinkBlock: false,
    buffer: '',
    filteredCount: 0
  }
  
  private options: ThinkFilterOptions

  constructor(options: ThinkFilterOptions = {}) {
    this.options = {
      enableStreamFilter: options.enableStreamFilter ?? true,
      bufferSize: options.bufferSize ?? 1024
    }
  }

  filter(text: string): string {
    let result = text
    
    for (const pattern of THINK_TAG_PATTERNS) {
      const matches = result.match(pattern)
      if (matches) {
        this.state.filteredCount += matches.length
      }
      result = result.replace(pattern, '')
    }
    
    result = result.trim()
    
    return result
  }

  filterStream(chunk: string): string {
    if (!this.options.enableStreamFilter) {
      return this.filter(chunk)
    }

    const textToProcess = this.state.buffer + chunk
    
    let hasStartTag = false
    let hasEndTag = false
    
    for (const pattern of THINK_START_PATTERNS) {
      if (pattern.test(textToProcess)) {
        hasStartTag = true
        break
      }
    }
    
    for (const pattern of THINK_END_PATTERNS) {
      if (pattern.test(textToProcess)) {
        hasEndTag = true
        break
      }
    }

    if (this.state.isInThinkBlock) {
      if (hasEndTag) {
        this.state.isInThinkBlock = false
        this.state.buffer = ''
        
        let result = textToProcess
        for (const pattern of THINK_TAG_PATTERNS) {
          result = result.replace(pattern, '')
        }
        
        return result.trim()
      } else {
        this.state.buffer = textToProcess.slice(-this.options.bufferSize!)
        this.state.filteredCount++
        return ''
      }
    } else {
      if (hasStartTag) {
        if (hasEndTag) {
          let result = textToProcess
          for (const pattern of THINK_TAG_PATTERNS) {
            result = result.replace(pattern, '')
          }
          return result.trim()
        } else {
          this.state.isInThinkBlock = true
          
          let beforeThink = textToProcess
          for (const pattern of THINK_START_PATTERNS) {
            const match = beforeThink.match(pattern)
            if (match && match.index !== undefined) {
              beforeThink = beforeThink.slice(0, match.index)
              break
            }
          }
          
          this.state.buffer = textToProcess.slice(-this.options.bufferSize!)
          
          return beforeThink.trim()
        }
      } else {
        return chunk
      }
    }
  }

  finalize(pendingText?: string): string {
    let result = ''
    
    if (this.state.buffer) {
      result = this.state.buffer
      this.state.buffer = ''
    }
    
    if (pendingText) {
      result += pendingText
    }
    
    result = this.filter(result)
    
    this.state.isInThinkBlock = false
    
    return result
  }

  reset(): void {
    this.state = {
      isInThinkBlock: false,
      buffer: '',
      filteredCount: 0
    }
  }

  getState(): ThinkFilterState {
    return { ...this.state }
  }

  getFilteredCount(): number {
    return this.state.filteredCount
  }

  isInThinkBlock(): boolean {
    return this.state.isInThinkBlock
  }
}

export function filterThinkTags(text: string): string {
  let result = text
  
  for (const pattern of THINK_TAG_PATTERNS) {
    result = result.replace(pattern, '')
  }
  
  return result.trim()
}

export function hasThinkTags(text: string): boolean {
  for (const pattern of THINK_TAG_PATTERNS) {
    if (pattern.test(text)) {
      return true
    }
  }
  return false
}

export function createThinkFilter(options?: ThinkFilterOptions): ThinkFilter {
  return new ThinkFilter(options)
}
