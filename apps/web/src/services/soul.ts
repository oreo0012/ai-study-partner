export interface SoulConfig {
  path: string
  encoding?: string
}

export interface SoulLoadResult {
  content: string
  source: 'file' | 'default' | 'fallback'
  error?: string
}

const DEFAULT_SOUL_CONTENT = `# AI学伴角色设定

## 角色信息
- 名称：小伴
- 性格：活泼、耐心、鼓励、友善

## 行为规则
1. 直接回答问题，不要输出任何思考过程
2. 不要使用任何形式的思考标签
3. 不要使用emoji表情包
4. 用简单、有趣的语言与孩子交流

## 输出规范
- 直接给出答案或结论
- 用简单的方式解释原因
- 提供相关的有趣知识或例子
- 给予鼓励或引导`

let soulCache: string | null = null
let lastLoadTime = 0
const CACHE_DURATION = 60000

export async function loadSoul(config: SoulConfig): Promise<SoulLoadResult> {
  const now = Date.now()
  
  if (soulCache && (now - lastLoadTime) < CACHE_DURATION) {
    return {
      content: soulCache,
      source: 'file'
    }
  }

  try {
    const response = await fetch(config.path, {
      method: 'GET',
      headers: {
        'Accept': 'text/markdown, text/plain, */*'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const content = await response.text()
    
    if (!content || content.trim().length === 0) {
      throw new Error('Empty soul file')
    }

    soulCache = content
    lastLoadTime = now

    return {
      content,
      source: 'file'
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    console.warn(`[Soul] Failed to load soul file: ${errorMessage}`)
    console.warn('[Soul] Using default soul content')

    return {
      content: DEFAULT_SOUL_CONTENT,
      source: 'default',
      error: errorMessage
    }
  }
}

export function getSoulContent(): string | null {
  return soulCache
}

export function clearSoulCache(): void {
  soulCache = null
  lastLoadTime = 0
}

export function getDefaultSoulContent(): string {
  return DEFAULT_SOUL_CONTENT
}

export function extractSystemPrompt(markdownContent: string): string {
  const lines = markdownContent.split('\n')
  const promptParts: string[] = []
  let inSection = false
  let currentSection = ''

  for (const line of lines) {
    if (line.startsWith('# ')) {
      continue
    }
    
    if (line.startsWith('## ')) {
      if (currentSection && promptParts.length > 0) {
        promptParts.push('')
      }
      currentSection = line.replace('## ', '').trim()
      inSection = true
      continue
    }

    if (line.startsWith('### ')) {
      continue
    }

    if (line.trim().startsWith('```')) {
      continue
    }

    if (inSection && line.trim()) {
      const cleanLine = line
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .trim()
      
      if (cleanLine && !cleanLine.startsWith('|') && !cleanLine.startsWith('---')) {
        promptParts.push(cleanLine)
      }
    }
  }

  return promptParts.join('\n').trim()
}

export function parseSoulMarkdown(content: string): {
  name: string
  personality: string
  rules: string[]
  systemPrompt: string
} {
  const result = {
    name: '小伴',
    personality: '活泼、耐心、鼓励、友善',
    rules: [] as string[],
    systemPrompt: ''
  }

  const lines = content.split('\n')
  let currentSection = ''

  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentSection = line.replace('## ', '').trim().toLowerCase()
      continue
    }

    if (currentSection === '角色信息') {
      if (line.includes('名称') || line.includes('名字')) {
        const match = line.match(/[:：]\s*(.+)/)
        if (match) result.name = match[1].trim()
      }
      if (line.includes('性格')) {
        const match = line.match(/[:：]\s*(.+)/)
        if (match) result.personality = match[1].trim()
      }
    }

    if (currentSection === '核心行为规则' || currentSection === '行为规则') {
      const match = line.match(/^\d+\.\s*(.+)/)
      if (match) {
        result.rules.push(match[1].trim())
      }
    }
  }

  result.systemPrompt = extractSystemPrompt(content)

  return result
}
