import type { Exercise, ExerciseType } from '@/config/types'

export interface ParsedExercise {
  type: ExerciseType
  question: string
  options?: string[]
  answer: string
  chapter?: string
  subject?: string
}

export interface ParseResult {
  success: boolean
  exercises: ParsedExercise[]
  errors: string[]
  warnings: string[]
  stats: {
    total: number
    byType: Record<ExerciseType, number>
  }
}

const SECTION_TITLE_PATTERNS = [
  /^[一二三四五六七八九十]+[、\.．]\s*(.+)$/,
  /^第[一二三四五六七八九十\d]+[章节部]\s*(.*)$/,
  /^#+\s*(.+)$/,
  /^Chapter\s*\d+[:\s]*(.*)$/i
]

const QUESTION_NUMBER_PATTERNS = [
  /^(\d+)\s*[\.、．]\s*/,
  /^[（\(](\d+)[）\)]\s*/,
  /^([一二三四五六七八九十]+)\s*[\.、．]\s*/
]

const EXERCISE_TYPE_KEYWORDS: Record<ExerciseType, string[]> = {
  '选择题': ['选择题', '单选题', '多选题', '单项选择', '多项选择', '一、选择题', '二、选择题', '三、选择题', '四、选择题'],
  '填空题': ['填空题', '填空', '完成句子', '一、填空题', '二、填空题', '三、填空题', '四、填空题'],
  '简答题': ['简答题', '简答', '问答题', '论述题', '解答题', '主观题', '一、简答题', '二、简答题', '三、简答题', '四、简答题'],
  '口算题': ['口算题', '口算', '一、口算题', '二、口算题', '三、口算题', '四、口算题'],
  '竖式计算题': ['竖式计算题', '竖式计算', '竖式题', '一、竖式计算题', '二、竖式计算题', '三、竖式计算题', '四、竖式计算题'],
  '应用题': ['应用题', '应用', '一、应用题', '二、应用题', '三、应用题', '四、应用题']
}

const ANSWER_PATTERNS = [
  /^答案\s*[:：]\s*/,
  /^答\s*[:：]\s*/,
  /^正确答案\s*[:：]\s*/,
  /^参考答案\s*[:：]\s*/
]

const OPTION_PATTERN = /^([A-Fa-f])\s*[\.、．]\s*(.+)$/

const CHINESE_NUM_MAP: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
}

function detectExerciseType(text: string): ExerciseType | null {
  const trimmedText = text.trim()
  
  for (const [type, keywords] of Object.entries(EXERCISE_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (trimmedText.includes(keyword) || trimmedText === keyword) {
        return type as ExerciseType
      }
    }
  }
  
  return null
}

function isSectionTitle(line: string): boolean {
  const trimmedLine = line.trim()
  for (const pattern of SECTION_TITLE_PATTERNS) {
    if (pattern.test(trimmedLine)) {
      return true
    }
  }
  return false
}

function extractSectionTitle(line: string): string | null {
  const trimmedLine = line.trim()
  for (const pattern of SECTION_TITLE_PATTERNS) {
    const match = trimmedLine.match(pattern)
    if (match) {
      return match[1] ? match[1].trim() : trimmedLine
    }
  }
  return null
}

function parseQuestionNumber(line: string): number | null {
  const trimmedLine = line.trim()
  for (const pattern of QUESTION_NUMBER_PATTERNS) {
    const match = trimmedLine.match(pattern)
    if (match) {
      const numStr = match[1]
      if (/^[一二三四五六七八九十]+$/.test(numStr)) {
        return CHINESE_NUM_MAP[numStr] || null
      }
      return parseInt(numStr, 10)
    }
  }
  return null
}

function parseOptions(lines: string[], startIndex: number): { options: string[]; endIndex: number } {
  const options: string[] = []
  let currentIndex = startIndex
  
  while (currentIndex < lines.length) {
    const line = lines[currentIndex].trim()
    if (!line) {
      currentIndex++
      continue
    }
    
    const optionMatch = line.match(OPTION_PATTERN)
    if (optionMatch) {
      const optionLetter = optionMatch[1].toUpperCase()
      const optionContent = optionMatch[2].trim()
      const optionIndex = optionLetter.charCodeAt(0) - 65
      
      while (options.length <= optionIndex) {
        options.push('')
      }
      options[optionIndex] = optionContent
      currentIndex++
    } else if (parseQuestionNumber(line) !== null || 
               ANSWER_PATTERNS.some(p => p.test(line)) ||
               detectExerciseType(line) ||
               isSectionTitle(line)) {
      break
    } else {
      currentIndex++
    }
  }
  
  return { options, endIndex: currentIndex }
}

function extractAnswer(line: string): string | null {
  for (const pattern of ANSWER_PATTERNS) {
    if (pattern.test(line)) {
      return line.replace(pattern, '').trim()
    }
  }
  return null
}

function cleanQuestionText(text: string): string {
  return text
    .replace(/^(\d+)\s*[\.、．]\s*/, '')
    .replace(/^[（\(](\d+)[）\)]\s*/, '')
    .replace(/^([一二三四五六七八九十]+)\s*[\.、．]\s*/, '')
    .replace(/_+/g, '______')
    .trim()
}

function parseExercisesFromContent(content: string, errors: string[], warnings: string[]): ParsedExercise[] {
  const exercises: ParsedExercise[] = []
  const lines = content.split('\n')
  
  let currentType: ExerciseType | null = null
  let currentChapter: string | undefined = undefined
  let lineNumber = 0
  
  for (let i = 0; i < lines.length; i++) {
    lineNumber++
    const line = lines[i].trim()
    
    if (!line) {
      continue
    }
    
    const detectedType = detectExerciseType(line)
    if (detectedType) {
      currentType = detectedType
      console.log(`[解析] 第${lineNumber}行: 检测到题型 "${detectedType}"`)
      continue
    }
    
    if (isSectionTitle(line)) {
      const title = extractSectionTitle(line)
      if (title && !detectExerciseType(title)) {
        currentChapter = title
        console.log(`[解析] 第${lineNumber}行: 检测到章节 "${title}"`)
      }
      continue
    }
    
    const questionNum = parseQuestionNumber(line)
    if (questionNum !== null) {
      const questionText = cleanQuestionText(line)
      
      if (!questionText) {
        warnings.push(`第${lineNumber}行: 题目编号 ${questionNum} 但内容为空`)
        continue
      }
      
      const exercise: ParsedExercise = {
        type: currentType || '简答题',
        question: questionText,
        answer: '',
        chapter: currentChapter
      }
      
      if (currentType === '选择题') {
        const { options, endIndex } = parseOptions(lines, i + 1)
        if (options.length > 0) {
          exercise.options = options
          i = endIndex - 1
        } else {
          warnings.push(`第${lineNumber}行: 选择题 "${questionText.substring(0, 20)}..." 缺少选项`)
        }
      }
      
      let j = i + 1
      while (j < lines.length) {
        const nextLine = lines[j].trim()
        if (!nextLine) {
          j++
          continue
        }
        
        if (parseQuestionNumber(nextLine) !== null || 
            detectExerciseType(nextLine) || 
            isSectionTitle(nextLine)) {
          break
        }
        
        const answerText = extractAnswer(nextLine)
        if (answerText !== null) {
          exercise.answer = answerText
          i = j
          break
        }
        
        if (currentType === '选择题' && OPTION_PATTERN.test(nextLine)) {
          break
        }
        
        exercise.question += '\n' + nextLine
        j++
      }
      
      exercises.push(exercise)
      console.log(`[解析] 第${lineNumber}行: 成功解析题目 "${questionText.substring(0, 30)}..."`)
    }
  }
  
  return exercises
}

export function parseExerciseDocument(content: string, filename: string): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  console.log(`[解析] 开始解析文件: ${filename}`)
  console.log(`[解析] 文件内容长度: ${content.length} 字符`)
  
  if (!content || !content.trim()) {
    errors.push('文件内容为空')
    return {
      success: false,
      exercises: [],
      errors,
      warnings,
      stats: { 
        total: 0, 
        byType: { 
          '选择题': 0, 
          '填空题': 0, 
          '简答题': 0,
          '口算题': 0,
          '竖式计算题': 0,
          '应用题': 0
        } 
      }
    }
  }
  
  try {
    const exercises = parseExercisesFromContent(content, errors, warnings)
    
    if (exercises.length === 0) {
      errors.push('未能识别到有效的习题，请检查文件格式')
      errors.push('提示: 确保题目使用数字编号（如 1. 2. 3.）或中文编号（如 一、二、三、）')
    }
    
    const stats: { total: number; byType: Record<ExerciseType, number> } = {
      total: exercises.length,
      byType: { 
        '选择题': 0, 
        '填空题': 0, 
        '简答题': 0,
        '口算题': 0,
        '竖式计算题': 0,
        '应用题': 0
      }
    }
    
    const validExercises: ParsedExercise[] = []
    
    exercises.forEach((ex, index) => {
      if (!ex.question || !ex.question.trim()) {
        errors.push(`第${index + 1}题: 题目内容为空，已跳过`)
        return
      }
      
      if (ex.type === '选择题' && (!ex.options || ex.options.length === 0)) {
        warnings.push(`第${index + 1}题: 选择题缺少选项，已转为简答题`)
        ex.type = '简答题'
      }
      
      stats.byType[ex.type]++
      validExercises.push(ex)
    })
    
    const subject = filename.includes('数学') ? '数学' :
                    filename.includes('语文') ? '语文' :
                    filename.includes('英语') ? '英语' :
                    filename.includes('物理') ? '物理' :
                    filename.includes('化学') ? '化学' :
                    undefined
    
    validExercises.forEach(ex => {
      ex.subject = subject
    })
    
    console.log(`[解析] 解析完成: 共 ${validExercises.length} 道题目`)
    console.log(`[解析] 题型分布:`, stats.byType)
    
    if (warnings.length > 0) {
      console.log(`[解析] 警告:`, warnings)
    }
    
    if (errors.length > 0) {
      console.log(`[解析] 错误:`, errors)
    }
    
    return {
      success: validExercises.length > 0,
      exercises: validExercises,
      errors,
      warnings,
      stats
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误'
    errors.push(`解析过程出错: ${errorMsg}`)
    console.error(`[解析] 解析失败:`, error)
    
    return {
      success: false,
      exercises: [],
      errors,
      warnings,
      stats: { 
        total: 0, 
        byType: { 
          '选择题': 0, 
          '填空题': 0, 
          '简答题': 0,
          '口算题': 0,
          '竖式计算题': 0,
          '应用题': 0
        } 
      }
    }
  }
}

export function getFormatExample(): string {
  return `一、选择题
1. 下列哪个是中国的首都？
A. 上海
B. 北京
C. 广州
D. 深圳
答案：B

2. 1+1等于多少？
A. 1
B. 2
C. 3
D. 4
答案：B

二、填空题
1. 中国的首都是______。
答案：北京

2. 一年有______个月。
答案：12

三、口算题
1. 49 ÷ 7 =
答案：7

2. 36 ÷ 6 =
答案：6

四、竖式计算题
1. 41 + 18 - 26 =
答案：33

五、应用题
1. 小明有5个苹果，给了小红2个，还剩几个？
答案：5 - 2 = 3（个）`
}

export function generateExerciseHash(exercise: { type: string; question: string; answer?: string }): string {
  const content = `${exercise.type}|${exercise.question}|${exercise.answer || ''}`
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}
