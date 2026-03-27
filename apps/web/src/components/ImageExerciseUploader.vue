<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  parseImageToExercises,
  validateImage,
  fileToBase64,
  compressImage
} from '@/services/image-exercise-parser'
import { saveImage, updateImageStatus } from '@/services/image-storage'
import { getConfig } from '@/config/loader'
import { createLogger, generateNewRequestId, type VisionLogger } from '@/services/vision-logger'
import type { Exercise, VisionModelConfig } from '@/config/types'

interface ImageUploadResult {
  exercises: Exercise[]
  imageId: string
}

const emit = defineEmits<{
  (e: 'upload', result: ImageUploadResult): void
  (e: 'cancel'): void
}>()

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_IMAGE_COUNT = 5
const COMPRESS_MAX_WIDTH = 1920

const DEFAULT_RECOGNITION_MODELS: Record<'fast' | 'precise', VisionModelConfig> = {
  fast: {
    model: 'Qwen/Qwen3-VL-32B-Instruct',
    name: '快速识别',
    description: '速度优先，适合简单试卷'
  },
  precise: {
    model: 'Qwen/Qwen3.5-397B-A17B',
    name: '精确识别',
    description: '精准优先，适合复杂试卷'
  }
}

const RECOGNITION_MODELS = ref<Record<'fast' | 'precise', VisionModelConfig>>({ ...DEFAULT_RECOGNITION_MODELS })

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const isCameraActive = ref(false)
const isCapturing = ref(false)
const isUploading = ref(false)
const isRecognizing = ref(false)
const selectedImages = ref<Array<{ file: File; preview: string }>>([])
const recognizedExercises = ref<Omit<Exercise, 'id' | 'createdAt' | 'status' | 'hash'>[]>([])
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const recognizingProgress = ref<string>('')
const visionApiKey = ref<string>('')
let currentLogger: VisionLogger | null = null

onMounted(() => {
  const config = getConfig()
  if (config?.vision?.apiKey) {
    visionApiKey.value = config.vision.apiKey
  }
  if (config?.vision?.models?.fast) {
    RECOGNITION_MODELS.value.fast = config.vision.models.fast
  }
  if (config?.vision?.models?.precise) {
    RECOGNITION_MODELS.value.precise = config.vision.models.precise
  }
})

const canAddMoreImages = computed(() => {
  return selectedImages.value.length < MAX_IMAGE_COUNT
})

const hasImages = computed(() => {
  return selectedImages.value.length > 0
})

const hasRecognizedExercises = computed(() => {
  return recognizedExercises.value.length > 0
})

function openFilePicker() {
  fileInputRef.value?.click()
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files

  if (!files) return

  await processSelectedFiles(Array.from(files))

  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

async function processSelectedFiles(files: File[]) {
  const logger = createLogger('ImageUploader', generateNewRequestId())
  currentLogger = logger
  
  errorMessage.value = null
  
  logger.logPhaseStart('图片选择上传', {
    fileCount: files.length,
    maxAllowed: MAX_IMAGE_COUNT
  })

  const remainingSlots = MAX_IMAGE_COUNT - selectedImages.value.length
  const filesToProcess = files.slice(0, remainingSlots)

  if (files.length > remainingSlots) {
    const warnMsg = `最多只能选择${MAX_IMAGE_COUNT}张图片，已选择前${remainingSlots}张`
    errorMessage.value = warnMsg
    logger.warn('超出图片数量限制', {
      requested: files.length,
      remaining: remainingSlots,
      processed: filesToProcess.length
    })
  }

  for (const file of filesToProcess) {
    const fileStartTime = Date.now()
    
    logger.info('开始处理图片文件', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      lastModified: new Date(file.lastModified).toISOString()
    })
    
    const validation = validateImage(file)
    if (!validation.valid) {
      errorMessage.value = validation.error || '图片验证失败'
      logger.error('图片验证失败', undefined, {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        error: validation.error
      })
      continue
    }

    try {
      const preview = await fileToBase64(file)
      selectedImages.value.push({ file, preview })
      
      const fileDuration = Date.now() - fileStartTime
      logger.logSuccess('图片上传成功', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        previewLength: preview.length,
        uploadDuration: fileDuration
      })
    } catch (error) {
      errorMessage.value = `图片读取失败: ${error instanceof Error ? error.message : '未知错误'}`
      logger.error('图片读取失败', error instanceof Error ? error : new Error(String(error)), {
        fileName: file.name,
        fileSize: file.size
      })
    }
  }
  
  logger.logPhaseEnd('图片选择上传', {
    totalProcessed: filesToProcess.length,
    successCount: selectedImages.value.length,
    finalImageCount: selectedImages.value.length
  })
}

function removeImage(index: number) {
  selectedImages.value.splice(index, 1)
}

function clearAllImages() {
  selectedImages.value = []
  recognizedExercises.value = []
  errorMessage.value = null
  successMessage.value = null
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    })

    if (videoRef.value) {
      videoRef.value.srcObject = stream
      videoRef.value.play()
      isCameraActive.value = true
    }
  } catch (error) {
    errorMessage.value = '无法访问摄像头，请确保已授予摄像头权限'
    console.error('Camera error:', error)
  }
}

function stopCamera() {
  if (videoRef.value && videoRef.value.srcObject) {
    const stream = videoRef.value.srcObject as MediaStream
    stream.getTracks().forEach(track => track.stop())
    videoRef.value.srcObject = null
  }
  isCameraActive.value = false
}

async function capturePhoto() {
  if (!videoRef.value || !canvasRef.value || isCapturing.value) return

  isCapturing.value = true

  try {
    const video = videoRef.value
    const canvas = canvasRef.value

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('无法获取画布上下文')
    }

    ctx.drawImage(video, 0, 0)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)

    const byteString = atob(dataUrl.split(',')[1])
    const mimeType = 'image/jpeg'
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i)
    }
    const blob = new Blob([ab], { type: mimeType })
    const file = new File([blob], `capture_${Date.now()}.jpg`, { type: mimeType })

    if (!canAddMoreImages.value) {
      errorMessage.value = `最多只能选择${MAX_IMAGE_COUNT}张图片`
      return
    }

    selectedImages.value.push({ file, preview: dataUrl })

    stopCamera()
  } catch (error) {
    errorMessage.value = `拍照失败: ${error instanceof Error ? error.message : '未知错误'}`
  } finally {
    isCapturing.value = false
  }
}

async function recognizeImages(mode: 'fast' | 'precise') {
  const logger = currentLogger || createLogger('ImageRecognizer', generateNewRequestId())
  
  if (!hasImages.value) {
    errorMessage.value = '请先选择图片'
    logger.warn('识别失败：未选择图片')
    return
  }

  if (!visionApiKey.value) {
    errorMessage.value = '请先配置视觉识别API密钥'
    logger.warn('识别失败：未配置API密钥')
    return
  }

  const selectedModel = RECOGNITION_MODELS.value[mode]
  
  errorMessage.value = null
  successMessage.value = null
  isRecognizing.value = true
  recognizedExercises.value = []

  logger.logPhaseStart('图片内容识别', {
    imageCount: selectedImages.value.length,
    hasApiKey: !!visionApiKey.value,
    mode: selectedModel.name,
    model: selectedModel.model
  })

  try {
    const allExercises: Omit<Exercise, 'id' | 'createdAt' | 'status' | 'hash'>[] = []
    const config = getConfig()

    for (let i = 0; i < selectedImages.value.length; i++) {
      const imageStartTime = Date.now()
      recognizingProgress.value = `正在识别第 ${i + 1} / ${selectedImages.value.length} 张图片...`

      const { preview, file } = selectedImages.value[i]
      
      logger.info('开始识别单张图片', {
        imageIndex: i + 1,
        totalImages: selectedImages.value.length,
        originalSize: preview.length,
        fileName: file.name
      })

      let imageBase64 = preview
      let compressed = false
      
      if (preview.length > 100000) {
        recognizingProgress.value = `正在压缩第 ${i + 1} 张图片...`
        logger.info('图片需要压缩', {
          originalSize: preview.length,
          threshold: 100000
        })
        
        imageBase64 = await compressImage(preview, COMPRESS_MAX_WIDTH, 0.8)
        compressed = true
        
        logger.info('图片压缩完成', {
          compressedSize: imageBase64.length,
          compressionRatio: ((preview.length - imageBase64.length) / preview.length * 100).toFixed(2) + '%'
        })
      }

      logger.logPhaseStart('VL模型请求', {
        imageIndex: i + 1,
        imageSize: imageBase64.length,
        compressed,
        model: selectedModel.model
      })

      const exercises = await parseImageToExercises(
        imageBase64,
        visionApiKey.value,
        {
          ...config?.vision,
          model: selectedModel.model
        }
      )
      
      const imageDuration = Date.now() - imageStartTime
      
      logger.logPhaseEnd('VL模型请求', {
        imageIndex: i + 1,
        recognizedCount: exercises.length,
        requestDuration: imageDuration
      })
      
      logger.info('单张图片识别完成', {
        imageIndex: i + 1,
        exerciseCount: exercises.length,
        duration: imageDuration
      })
      
      allExercises.push(...exercises)
    }

    recognizedExercises.value = allExercises
    recognizingProgress.value = ''

    logger.logPhaseEnd('图片内容识别', {
      totalExercises: allExercises.length,
      totalImages: selectedImages.value.length
    })

    if (allExercises.length === 0) {
      errorMessage.value = '未能识别到习题内容，请上传更清晰的图片'
      logger.warn('识别结果为空', { totalImages: selectedImages.value.length })
    } else {
      successMessage.value = `成功识别到 ${allExercises.length} 道习题`
      
      const typeDistribution: Record<string, number> = {}
      allExercises.forEach(ex => {
        typeDistribution[ex.type] = (typeDistribution[ex.type] || 0) + 1
      })
      
      logger.logSuccess('图片识别全部完成', {
        totalExercises: allExercises.length,
        typeDistribution,
        totalDuration: logger.getElapsedTime()
      })
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    errorMessage.value = `识别失败: ${err.message}`
    recognizedExercises.value = []
    
    logger.logFailure('图片识别失败', err, {
      totalImages: selectedImages.value.length
    })
  } finally {
    isRecognizing.value = false
    recognizingProgress.value = ''
  }
}

async function confirmUpload() {
  const logger = currentLogger || createLogger('ExerciseUploader', generateNewRequestId())
  
  if (!hasRecognizedExercises.value) {
    errorMessage.value = '请先识别图片中的习题'
    logger.warn('上传失败：未识别习题')
    return
  }

  isUploading.value = true
  errorMessage.value = null
  
  logger.logPhaseStart('习题确认上传', {
    exerciseCount: recognizedExercises.value.length
  })

  try {
    let imageId = ''
    const imageSaveStartTime = Date.now()
    
    for (const { preview, file } of selectedImages.value) {
      try {
        const id = await saveImage(preview, [], file.size)
        imageId = id
        
        logger.info('图片数据保存完成', {
          imageId: id,
          imageSize: file.size
        })
      } catch (error) {
        logger.error('图片保存失败', error instanceof Error ? error : new Error(String(error)), {
          fileName: file.name
        })
      }
    }

    logger.logPhaseEnd('习题确认上传', {
      totalImages: selectedImages.value.length,
      imageSaveDuration: Date.now() - imageSaveStartTime,
      totalDuration: logger.getElapsedTime()
    })

    emit('upload', {
      exercises: recognizedExercises.value as Exercise[],
      imageId
    })

    resetState()
    successMessage.value = `正在处理 ${recognizedExercises.value.length} 道习题...`
    
    logger.logSuccess('习题确认上传完成', {
      exerciseCount: recognizedExercises.value.length,
      totalDuration: logger.getElapsedTime()
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    errorMessage.value = `上传失败: ${err.message}`
    
    logger.logFailure('习题上传失败', err, {
      exerciseCount: recognizedExercises.value.length
    })
  } finally {
    isUploading.value = false
  }
}

function resetState() {
  selectedImages.value = []
  recognizedExercises.value = []
  errorMessage.value = null
}

function cancel() {
  stopCamera()
  resetState()
  emit('cancel')
}

const typeStats = computed(() => {
  const stats: Record<string, number> = {}
  for (const ex of recognizedExercises.value) {
    stats[ex.type] = (stats[ex.type] || 0) + 1
  }
  return stats
})
</script>

<template>
  <div class="image-exercise-uploader">
    <div class="camera-section mb-4" v-if="isCameraActive">
      <div class="camera-preview relative bg-black rounded-xl overflow-hidden">
        <video
          ref="videoRef"
          class="w-full h-auto max-h-64 object-contain"
          playsinline
        />
        <canvas ref="canvasRef" class="hidden" />
      </div>
      <div class="camera-controls mt-3 flex gap-3 justify-center">
        <button
          class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
          @click="stopCamera"
        >
          取消
        </button>
        <button
          class="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          :disabled="isCapturing"
          @click="capturePhoto"
        >
          <div v-if="isCapturing" class="i-carbon-circle-dash animate-spin" />
          {{ isCapturing ? '拍摄中...' : '拍照' }}
        </button>
      </div>
    </div>

    <div class="upload-section" v-else>
      <div class="action-buttons flex gap-3 mb-4">
        <button
          class="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          @click="startCamera"
          :disabled="!canAddMoreImages"
        >
          <span class="text-xl">📷</span>
          拍照
        </button>
        <button
          class="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          @click="openFilePicker"
          :disabled="!canAddMoreImages"
        >
          <span class="text-xl">🖼️</span>
          相册选择
        </button>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          class="hidden"
          @change="handleFileSelect"
        >
      </div>

      <div v-if="!canAddMoreImages" class="limit-warning mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p class="text-amber-700 text-sm">已达到最大图片数量限制（{{ MAX_IMAGE_COUNT }}张）</p>
      </div>

      <div v-if="hasImages" class="selected-images mb-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-medium text-gray-700">
            已选择 {{ selectedImages.length }} / {{ MAX_IMAGE_COUNT }} 张图片
          </h3>
          <button
            class="text-sm text-gray-500 hover:text-gray-700"
            @click="clearAllImages"
          >
            清空
          </button>
        </div>
        <div class="image-grid grid grid-cols-5 gap-2">
          <div
            v-for="(img, index) in selectedImages"
            :key="index"
            class="image-item relative aspect-square bg-gray-100 rounded-lg overflow-hidden"
          >
            <img
              :src="img.preview"
              class="w-full h-full object-cover"
              alt="Selected image"
            />
            <button
              class="remove-btn absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center"
              @click="removeImage(index)"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <div v-if="hasImages && !hasRecognizedExercises" class="recognize-section">
        <p class="text-sm text-gray-500 mb-3 text-center">请选择识别模式</p>
        <div class="recognize-buttons flex gap-3">
          <button
            class="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex flex-col items-center justify-center gap-1"
            :disabled="isRecognizing"
            @click="recognizeImages('fast')"
          >
            <span class="text-2xl">⚡</span>
            <span class="font-bold">{{ RECOGNITION_MODELS.fast.name }}</span>
            <span class="text-xs opacity-80">{{ RECOGNITION_MODELS.fast.description }}</span>
          </button>
          <button
            class="flex-1 py-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex flex-col items-center justify-center gap-1"
            :disabled="isRecognizing"
            @click="recognizeImages('precise')"
          >
            <span class="text-2xl">🎯</span>
            <span class="font-bold">{{ RECOGNITION_MODELS.precise.name }}</span>
            <span class="text-xs opacity-80">{{ RECOGNITION_MODELS.precise.description }}</span>
          </button>
        </div>
        <div v-if="isRecognizing" class="recognizing-progress mt-3 p-3 bg-blue-50 rounded-lg text-center">
          <div class="flex items-center justify-center gap-2 text-blue-600">
            <div class="i-carbon-circle-dash animate-spin" />
            <span>{{ recognizingProgress }}</span>
          </div>
        </div>
      </div>

      <div v-if="hasRecognizedExercises" class="recognized-section mt-4">
        <div class="result-header p-4 bg-green-50 border border-green-200 rounded-xl mb-4">
          <div class="flex items-center gap-2">
            <span class="text-xl">✅</span>
            <div>
              <p class="text-green-700 font-medium">{{ successMessage || '识别成功' }}</p>
              <p class="text-green-600 text-sm mt-1">
                共识别到 <span class="font-bold">{{ recognizedExercises.length }}</span> 道习题
              </p>
            </div>
          </div>
          <div class="type-stats mt-3 flex flex-wrap gap-2">
            <span
              v-for="(count, type) in typeStats"
              :key="type"
              class="px-3 py-1 rounded-full text-sm"
              :class="{
                'bg-blue-100 text-blue-700': type === '选择题',
                'bg-purple-100 text-purple-700': type === '填空题',
                'bg-amber-100 text-amber-700': type === '简答题',
                'bg-cyan-100 text-cyan-700': type === '口算题',
                'bg-orange-100 text-orange-700': type === '竖式计算题',
                'bg-pink-100 text-pink-700': type === '应用题'
              }"
            >
              {{ type }}: {{ count }}
            </span>
          </div>
        </div>

        <div class="preview-list max-h-48 overflow-y-auto mb-4">
          <div
            v-for="(exercise, index) in recognizedExercises.slice(0, 10)"
            :key="index"
            class="preview-item py-3 px-4 bg-white border-b border-gray-100 last:border-0"
          >
            <p class="text-sm text-gray-600">
              <span class="font-medium text-gray-700">{{ exercise.questionNumber || index + 1 }}. [{{ exercise.type }}]</span>
              {{ exercise.question.substring(0, 60) }}{{ exercise.question.length > 60 ? '...' : '' }}
            </p>
          </div>
          <p v-if="recognizedExercises.length > 10" class="text-sm text-gray-400 py-2 px-4">
            还有 {{ recognizedExercises.length - 10 }} 道题目...
          </p>
        </div>

        <div class="action-buttons flex gap-3">
          <button
            class="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
            @click="clearAllImages"
          >
            重新选择
          </button>
          <button
            class="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            :disabled="isUploading"
            @click="confirmUpload"
          >
            <div v-if="isUploading" class="i-carbon-circle-dash animate-spin" />
            {{ isUploading ? '上传中...' : '确认上传' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="errorMessage" class="error-message mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
      <div class="flex items-start gap-3">
        <span class="text-xl">⚠️</span>
        <p class="text-red-700">{{ errorMessage }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-grid::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.image-grid::-webkit-scrollbar-track {
  background: transparent;
}

.image-grid::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 2px;
}

.preview-list::-webkit-scrollbar {
  width: 4px;
}

.preview-list::-webkit-scrollbar-track {
  background: transparent;
}

.preview-list::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 2px;
}
</style>
