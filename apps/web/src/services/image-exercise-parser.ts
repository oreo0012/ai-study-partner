import type { Exercise, ExerciseType } from '@/config/types'
import type { VisionConfig } from '@/config/types'

const SYSTEM_PROMPT = `你是一个专业的小学习题识别助手。请仔细分析上传的图片，识别出其中的习题。

【识别要求】
1. 如果图片中有多道题目，请逐一识别
2. 对于每道题目，请识别：
   - 题型（选择题、填空题、简答题、口算题、应用题等）
   - 题目内容（如果有图片，请标注"[图片]"）
   - 选项（如果是选择题）
   - 正确答案
3. 如果图片模糊或无法识别，请注明

【输出格式】
请以JSON格式返回，格式如下：
{
  "exercises": [
    {
      "type": "选择题",
      "question": "题目内容",
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
      "answer": "B",
      "hasImage": true
    }
  ]
}

请直接返回JSON，不要有其他文字。`

interface SiliconFlowMessage {
  role: string
  content: Array<{
    type: 'text' | 'image_url'
    text?: string
    image_url?: { url: string }
  }>
}

interface SiliconFlowRequest {
  model: string
  messages: SiliconFlowMessage[]
  max_tokens: number
  stream: boolean
}

interface SiliconFlowResponse {
  id: string
  choices: Array<{
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface ParsedExerciseData {
  type: string
  question: string
  options?: string[]
  answer: string
  hasImage: boolean
}

interface ParseResult {
  exercises: ParsedExerciseData[]
}

function getDefaultVisionConfig(): VisionConfig {
  return {
    provider: 'siliconflow',
    apiKey: '',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen3.5-397B-A17B',
    timeout: 30000,
    maxRetries: 2
  }
}

function normalizeExerciseType(type: string): ExerciseType {
  const typeMap: Record<string, ExerciseType> = {
    '选择题': '选择题',
    '填空题': '填空题',
    '简答题': '简答题',
    '口算题': '口算题',
    '竖式计算题': '竖式计算题',
    '应用题': '应用题',
    '计算题': '口算题',
    '判断题': '选择题',
    '问答题': '简答题'
  }

  return typeMap[type] || '简答题'
}

function parseAIResponse(content: string): ParseResult {
  try {
    let jsonStr = content.trim()

    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim()
    }

    const jsonMatch = jsonStr.match(/^\s*\{[\s\S]*\}\s*$/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    return JSON.parse(jsonStr) as ParseResult
  } catch (error) {
    console.error('Failed to parse AI response:', error)
    console.error('Raw content:', content)
    throw new Error('AI返回格式解析失败')
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function parseImageToExercises(
  imageBase64: string,
  apiKey: string,
  config?: Partial<VisionConfig>
): Promise<Omit<Exercise, 'id' | 'createdAt' | 'status' | 'hash'>[]> {
  const visionConfig = {
    ...getDefaultVisionConfig(),
    ...config
  }

  if (!apiKey) {
    throw new Error('API密钥不能为空')
  }

  const requestBody: SiliconFlowRequest = {
    model: visionConfig.model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: imageBase64
            }
          },
          {
            type: 'text',
            text: SYSTEM_PROMPT
          }
        ]
      }
    ],
    max_tokens: 8192,
    stream: false
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= visionConfig.maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        `${visionConfig.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        },
        visionConfig.timeout
      )

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `API Error: ${response.status}`

        switch (response.status) {
          case 400:
            errorMessage = '请求格式错误，请检查图片格式'
            break
          case 401:
            errorMessage = 'API密钥无效'
            break
          case 429:
            errorMessage = '请求频率限制，请稍后重试'
            break
          case 500:
          case 502:
          case 503:
            errorMessage = '服务暂不可用，请稍后重试'
            break
        }

        throw new Error(`${errorMessage} (${errorText})`)
      }

      const result = await response.json() as SiliconFlowResponse
      const content = result.choices?.[0]?.message?.content

      if (!content) {
        throw new Error('API返回内容为空')
      }

      const parseResult = parseAIResponse(content)

      const exercises: Omit<Exercise, 'id' | 'createdAt' | 'status' | 'hash'>[] = parseResult.exercises.map(ex => ({
        type: normalizeExerciseType(ex.type),
        question: ex.question,
        options: ex.options,
        answer: ex.answer,
        hasImageReference: ex.hasImage
      }))

      return exercises
    } catch (error) {
      lastError = error as Error

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('识别超时，请稍后重试')
        }

        if (error.message.includes('API密钥无效') || error.message.includes('请求格式错误')) {
          throw error
        }
      }

      if (attempt < visionConfig.maxRetries) {
        const delay = Math.pow(2, attempt) * 1000
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('识别失败，请稍后重试')
}

export function isImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp']
  return validTypes.includes(file.type)
}

export function isImageSizeValid(file: File, maxSizeMB: number = 10): boolean {
  const maxBytes = maxSizeMB * 1024 * 1024
  return file.size <= maxBytes
}

export function validateImage(file: File): { valid: boolean; error?: string } {
  if (!isImageFile(file)) {
    return {
      valid: false,
      error: '不支持的图片格式，请上传 JPEG、PNG 或 WebP 格式的图片'
    }
  }

  if (!isImageSizeValid(file)) {
    return {
      valid: false,
      error: `图片大小超过限制（最大${10}MB）`
    }
  }

  return { valid: true }
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.onerror = () => {
      reject(new Error('图片读取失败'))
    }
    reader.readAsDataURL(file)
  })
}

export async function compressImage(
  base64: string,
  maxWidth: number = 1920,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      const compressedBase64 = canvas.toDataURL('image/jpeg', quality)
      resolve(compressedBase64)
    }

    img.onerror = () => {
      reject(new Error('图片加载失败'))
    }

    img.src = base64
  })
}

export const imageExerciseParser = {
  parseImageToExercises,
  validateImage,
  fileToBase64,
  compressImage,
  isImageFile,
  isImageSizeValid
}

export default imageExerciseParser
