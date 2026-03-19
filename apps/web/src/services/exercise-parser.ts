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
  stats: {
    total: number
    byType: Record<ExerciseType, number>
  }
}

const CHAPTER_PATTERNS = [
  /^#+\s*(.+)$/m,
  /^第[一二三四五六七八九十\d]+[章节部]\s*(.*)$/m,
  /^Chapter\s*\d+[:\s]*(.*)$/im
]

const QUESTION_NUMBER_PATTERNS = [
  /^(\d+)\s*[\.、．]\s*/,
  /^[（\(](\d+)[）\)]\s*/,
  /^([一二三四五六七八九十]+)\s*[\.、．]\s*/
]

const EXERCISE_TYPE_KEYWORDS: Record<ExerciseType, string[]> = {
  '选择题': ['选择题', '单选题', '多选题', '单项选择', '多项选择'],
  '填空题': ['填空题', '填空', '完成句子'],
  '简答题': ['简答题', '简答', '问答题', '论述题', '解答题', '主观题']
}

const ANSWER_PATTERNS = [
  /^答案\s*[:：]\s*/,
  /^答\s*[:：]\s*/,
  /^正确答案\s*[:：]\s*/,
  /^参考答案\s*[:：]\s*/
]

const OPTION_PATTERN = /^([A-Fa-f])\s*[\.、．]\s*(.+)$/

function detectExerciseType(text: string): ExerciseType | null {
  const lowerText = text.toLowerCase()
  
  for (const [type, keywords] of Object.entries(EXERCISE_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return type as ExerciseType
      }
    }
  }
  
  return null
}

function extractChapter(lines: string[], startIndex: number): string | undefined {
  for (let i = startIndex; i >= 0; i--) {
    const line = lines[i].trim()
    for (const pattern of CHAPTER_PATTERNS) {
      const match = line.match(pattern)
      if (match) {
        return match[1] ? match[1].trim() : line
      }
    }
  }
  return undefined
}

function parseQuestionNumber(line: string): number | null {
  for (const pattern of QUESTION_NUMBER_PATTERNS) {
    const match = line.match(pattern)
    if (match) {
      const numStr = match[1]
      if (/^[一二三四五六七八九十]+$/.test(numStr)) {
        const chineseNums: Record<string, number> = {
          '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
          '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
        }
        return chineseNums[numStr] || null
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
               detectExerciseType(line)) {
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

function parseExercisesFromContent(content: string): ParsedExercise[] {
  const exercises: ParsedExercise[] = []
  const lines = content.split('\n')
  
  let currentType: ExerciseType | null = null
  let currentChapter: string | undefined = undefined
  let currentQuestion: string | null = null
  let currentOptions: string[] = []
  let currentAnswer: string | null = null
  let questionStartIndex = -1
  
  function saveCurrentExercise() {
    if (currentQuestion && currentQuestion.trim()) {
      const exercise: ParsedExercise = {
        type: currentType || '简答题',
        question: cleanQuestionText(currentQuestion),
        answer: currentAnswer || '',
        chapter: currentChapter
      }
      
      if (currentType === '选择题' && currentOptions.length > 0) {
        exercise.options = currentOptions
      }
      
      exercises.push(exercise)
    }
    
    currentQuestion = null
    currentOptions = []
    currentAnswer = null
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (!line) {
      continue
    }
    
    const detectedType = detectExerciseType(line)
    if (detectedType) {
      saveCurrentExercise()
      currentType = detectedType
      continue
    }
    
    const chapterMatch = CHAPTER_PATTERNS.some(p => p.test(line))
    if (chapterMatch && !parseQuestionNumber(line)) {
      currentChapter = line.replace(/^#+\s*/, '').trim()
      continue
    }
    
    const answerText = extractAnswer(line)
    if (answerText !== null) {
      currentAnswer = answerText
      continue
    }
    
    const questionNum = parseQuestionNumber(line)
    if (questionNum !== null) {
      saveCurrentExercise()
      currentQuestion = line
      questionStartIndex = i
      
      if (currentType === '选择题') {
        const { options, endIndex } = parseOptions(lines, i + 1)
        currentOptions = options
        i = endIndex - 1
      }
      
      continue
    }
    
    if (currentType === '选择题' && OPTION_PATTERN.test(line)) {
      const optionMatch = line.match(OPTION_PATTERN)
      if (optionMatch) {
        const optionLetter = optionMatch[1].toUpperCase()
        const optionContent = optionMatch[2].trim()
        const optionIndex = optionLetter.charCodeAt(0) - 65
        
        while (currentOptions.length <= optionIndex) {
          currentOptions.push('')
        }
        currentOptions[optionIndex] = optionContent
      }
      continue
    }
    
    if (currentQuestion && !currentAnswer) {
      currentQuestion += '\n' + line
    }
  }
  
  saveCurrentExercise()
  
  return exercises
}

export function parseExerciseDocument(content: string, filename: string): ParseResult {
  const errors: string[] = []
  
  if (!content || !content.trim()) {
    return {
      success: false,
      exercises: [],
      errors: ['文件内容为空'],
      stats: { total: 0, byType: { '选择题': 0, '填空题': 0, '简答题': 0 } }
    }
  }
  
  try {
    const exercises = parseExercisesFromContent(content)
    
    if (exercises.length === 0) {
      errors.push('未能识别到有效的习题，请检查文件格式')
    }
    
    const stats: { total: number; byType: Record<ExerciseType, number> } = {
      total: exercises.length,
      byType: { '选择题': 0, '填空题': 0, '简答题': 0 }
    }
    
    exercises.forEach(ex => {
      stats.byType[ex.type]++
    })
    
    const validExercises = exercises.filter(ex => {
      if (!ex.question) {
        errors.push(`发现空题目，已跳过`)
        return false
      }
      if (ex.type === '选择题' && (!ex.options || ex.options.length === 0)) {
        errors.push(`选择题缺少选项: ${ex.question.substring(0, 30)}...`)
        ex.type = '简答题'
      }
      return true
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
    
    return {
      success: validExercises.length > 0,
      exercises: validExercises,
      errors,
      stats
    }
  } catch (error) {
    return {
      success: false,
      exercises: [],
      errors: [`解析过程出错: ${error instanceof Error ? error.message : '未知错误'}`],
      stats: { total: 0, byType: { '选择题': 0, '填空题': 0, '简答题': 0 } }
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

三、简答题
1. 请简述光合作用的过程。
答案：光合作用是植物利用阳光能量，将二氧化碳和水转化为葡萄糖和氧气的过程。

2. 为什么要保护环境？
答案：保护环境可以维护生态平衡，保障人类健康，实现可持续发展。`
}
