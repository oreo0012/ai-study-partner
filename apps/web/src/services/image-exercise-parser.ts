import type { Exercise, ExerciseType } from '@/config/types'
import type { VisionConfig } from '@/config/types'
import { createLogger, type VisionLogger } from './vision-logger'

const SYSTEM_PROMPT = `你是一个专业的小学习题识别助手。请仔细分析上传的试卷图片，识别出其中的所有习题。

【试卷结构说明】
小学试卷通常采用"大题-小题"的层级结构：
- 大题：通常以"一、二、三..."或"1、2、3..."编号，带有题型标题（如"一、口算题"、"二、填空题"）或是字体加粗显示
- 小题：每个大题下包含的具体题目，通常以"1. 2. 3..."或"(1) (2) (3)..."编号，有些计算题没有标号但是有完整的表达式也应被判定为一道独立小题
- 选项：如果是选择题，列出所有选项，每个选项占一行，选项前有"A."、"B."、"C."等
- 没份试卷的排版没有标准，需要根据实际情况判断，但每道大题通常都会有个相对独立的区域（通过线条或色块划分），小题会在这个区域内。

【识别要求】
1. 必须识别出每个小题，而不是只识别大题标题
2. 每个小题作为独立的一条记录输出
3. 对于每个小题，请识别：
   - 题型：将识别到的大题的标题填入type字段（选择题、填空题、简答题、口算题、应用题、竖式计算题等）
   - 题号：小题的编号填入questionNumber字段，如果为空则自行按顺序编号（如"1"、"2"、"(1)"等）
   - 题目内容：小题的完整题目文字（如果有图片，请标注"[图片]"）
   - 选项：如果是选择题，列出所有选项，每个选项占一行，选项前有"A."、"B."、"C."等
   - 正确答案：如果图片中有答案请标注，没有则填"待填写"

【重要提示】
- 不要将大题标题作为单独的题目输出
- 每个小题都要单独识别，不要遗漏
- 保持小题的原始编号，如果为空则自行按顺序编号
- 如果题目内容包含分数、算式等，请完整保留

【输出格式】
请以JSON格式返回，格式如下：
{
  "exercises": [
    {
      "type": "口算题",
      "questionNumber": "1",
      "question": "25 + 37 = ",
      "answer": "62",
      "hasImage": false
    },
    {
      "type": "口算题",
      "questionNumber": "2",
      "question": "100 - 45 = ",
      "answer": "55",
      "hasImage": false
    },
    {
      "type": "选择题",
      "questionNumber": "1",
      "question": "下列哪个数是偶数？",
      "options": ["A. 13", "B. 17", "C. 24", "D. 35"],
      "answer": "C",
      "hasImage": false
    }
  ]
}

请直接返回JSON，不要有其他文字。确保识别出所有小题，不要遗漏任何一道题目。`

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
  questionNumber?: string
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
    model: 'Qwen/Qwen2-VL-72B-Instruct',
    timeout: 60000,
    maxRetries: 3
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

function parseAIResponse(content: string, logger: VisionLogger): ParseResult {
  const parseStartTime = Date.now()
  
  try {
    logger.debug('开始解析AI响应', { contentLength: content.length })
    
    let jsonStr = content.trim()

    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim()
      logger.debug('从代码块中提取JSON')
    }

    const jsonMatch = jsonStr.match(/^\s*\{[\s\S]*\}\s*$/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const result = JSON.parse(jsonStr) as ParseResult
    
    const parseDuration = Date.now() - parseStartTime
    logger.info('AI响应解析成功', {
      exerciseCount: result.exercises.length,
      parseDuration
    })
    
    return result
  } catch (error) {
    logger.error('AI响应解析失败', error instanceof Error ? error : new Error(String(error)), {
      contentPreview: content.substring(0, 200)
    })
    throw new Error('AI返回格式解析失败')
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number,
  logger: VisionLogger
): Promise<Response> {
  const fetchStartTime = Date.now()
  
  logger.info('发起HTTP请求', {
    url: url,
    method: options.method,
    timeout,
    hasBody: !!options.body,
    bodySize: options.body ? (options.body as string).length : 0
  })
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    logger.warn('HTTP请求超时，正在中止', { timeout, elapsed: Date.now() - fetchStartTime })
    controller.abort()
  }, timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    
    const fetchDuration = Date.now() - fetchStartTime
    logger.info('HTTP请求完成', {
      status: response.status,
      statusText: response.statusText,
      fetchDuration,
      ok: response.ok
    })
    
    return response
  } catch (fetchError) {
    const fetchDuration = Date.now() - fetchStartTime
    logger.error('HTTP请求异常', fetchError instanceof Error ? fetchError : new Error(String(fetchError)), {
      fetchDuration,
      errorName: fetchError instanceof Error ? fetchError.name : 'Unknown'
    })
    throw fetchError
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function parseImageToExercises(
  imageBase64: string,
  apiKey: string,
  config?: Partial<VisionConfig>,
  parentLogger?: VisionLogger
): Promise<Omit<Exercise, 'id' | 'createdAt' | 'status' | 'hash'>[]> {
  const logger = parentLogger || createLogger('VLModel', undefined)
  
  const visionConfig = {
    ...getDefaultVisionConfig(),
    ...config
  }

  logger.logPhaseStart('VL模型请求', {
    model: visionConfig.model,
    baseUrl: visionConfig.baseUrl,
    imageSize: imageBase64.length,
    timeout: visionConfig.timeout,
    maxRetries: visionConfig.maxRetries
  })

  if (!apiKey) {
    const error = new Error('API密钥不能为空')
    logger.error('API密钥验证失败', error)
    throw error
  }

  const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
  
  logger.info('图片数据格式检查', {
    hasDataPrefix: imageBase64.startsWith('data:'),
    originalLength: imageBase64.length,
    prefixPreview: imageBase64.substring(0, 50)
  })

  const requestBody: SiliconFlowRequest = {
    model: visionConfig.model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: imageUrl
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

  logger.info('请求体构建完成', {
    model: requestBody.model,
    maxTokens: requestBody.max_tokens,
    messageCount: requestBody.messages.length
  })

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= visionConfig.maxRetries; attempt++) {
    const attemptStartTime = Date.now()
    
    logger.info(`开始第 ${attempt + 1} 次请求尝试`, {
      attempt: attempt + 1,
      maxAttempts: visionConfig.maxRetries + 1
    })

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
        visionConfig.timeout,
        logger
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

        logger.error('VL模型请求失败', new Error(errorMessage), {
          statusCode: response.status,
          errorPreview: errorText.substring(0, 200),
          attempt: attempt + 1
        })

        throw new Error(`${errorMessage}`)
      }

      const result = await response.json() as SiliconFlowResponse
      const content = result.choices?.[0]?.message?.content

      logger.info('VL模型响应数据', {
        responseId: result.id,
        hasContent: !!content,
        finishReason: result.choices?.[0]?.finish_reason,
        usage: result.usage
      })

      if (!content) {
        logger.warn('VL模型返回内容为空')
        throw new Error('API返回内容为空')
      }

      const parseResult = parseAIResponse(content, logger)

      const exercises: Omit<Exercise, 'id' | 'createdAt' | 'status' | 'hash'>[] = parseResult.exercises.map(ex => ({
        type: normalizeExerciseType(ex.type),
        questionNumber: ex.questionNumber,
        question: ex.question,
        options: ex.options,
        answer: ex.answer,
        hasImageReference: ex.hasImage
      }))

      const attemptDuration = Date.now() - attemptStartTime
      
      logger.logPhaseEnd('VL模型请求', {
        success: true,
        exerciseCount: exercises.length,
        attempt: attempt + 1,
        attemptDuration,
        totalDuration: logger.getElapsedTime()
      })

      return exercises
    } catch (error) {
      lastError = error as Error
      const attemptDuration = Date.now() - attemptStartTime

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          logger.error('VL模型请求超时', error, {
            attempt: attempt + 1,
            attemptDuration,
            timeout: visionConfig.timeout
          })
          throw new Error('识别超时，请稍后重试')
        }

        if (error.message.includes('API密钥无效') || error.message.includes('请求格式错误')) {
          throw error
        }
      }

      logger.warn('请求尝试失败', {
        attempt: attempt + 1,
        error: error instanceof Error ? error.message : String(error),
        attemptDuration
      })

      if (attempt < visionConfig.maxRetries) {
        const delay = Math.pow(2, attempt) * 1000
        logger.info(`等待 ${delay}ms 后重试`, {
          nextAttempt: attempt + 2,
          delayMs: delay
        })
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  logger.logFailure('VL模型请求最终失败', lastError!, {
    totalAttempts: visionConfig.maxRetries + 1,
    totalDuration: logger.getElapsedTime()
  })

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
