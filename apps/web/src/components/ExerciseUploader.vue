<script setup lang="ts">
import { ref, computed } from 'vue'
import { parseExerciseDocument, getFormatExample, type ParsedExercise } from '@/services/exercise-parser'
import type { ExerciseType } from '@/config/types'
import ImageExerciseUploader from './ImageExerciseUploader.vue'

type UploadMode = 'text' | 'image'

interface UploadResult {
  exercises: ParsedExercise[]
  filename: string
}

interface ImageUploadResult {
  exercises: any[]
  imageId: string
}

const emit = defineEmits<{
  (e: 'upload', result: UploadResult): void
}>()

const uploadMode = ref<UploadMode>('text')
const isDragging = ref(false)
const isUploading = ref(false)
const selectedFile = ref<File | null>(null)
const parseResult = ref<ReturnType<typeof parseExerciseDocument> | null>(null)
const errorMessage = ref<string | null>(null)
const warningMessage = ref<string | null>(null)
const showFormatExample = ref(false)

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['.txt', '.md']

const fileInputRef = ref<HTMLInputElement | null>(null)

const hasValidResult = computed(() => {
  return parseResult.value && parseResult.value.success && parseResult.value.exercises.length > 0
})

const typeStats = computed(() => {
  if (!parseResult.value) return null
  return parseResult.value.stats.byType
})

function validateFile(file: File): string | null {
  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
  
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `不支持的文件格式: ${ext}。请上传 .txt 或 .md 文件`
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return `文件大小超过限制 (最大 5MB)。当前文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`
  }
  
  return null
}

async function handleFileSelect(file: File) {
  errorMessage.value = null
  warningMessage.value = null
  parseResult.value = null
  
  const validationError = validateFile(file)
  if (validationError) {
    errorMessage.value = validationError
    return
  }
  
  selectedFile.value = file
  
  try {
    const content = await readFileContent(file)
    parseResult.value = parseExerciseDocument(content, file.name)
    
    if (!parseResult.value.success) {
      errorMessage.value = parseResult.value.errors.join('\n')
    } else if (parseResult.value.warnings.length > 0) {
      warningMessage.value = parseResult.value.warnings.join('\n')
    }
  } catch (error) {
    errorMessage.value = `读取文件失败: ${error instanceof Error ? error.message : '未知错误'}`
  }
}

function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file, 'UTF-8')
  })
}

function handleInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    handleFileSelect(file)
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false
  
  const file = event.dataTransfer?.files[0]
  if (file) {
    handleFileSelect(file)
  }
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function confirmUpload() {
  if (!hasValidResult.value || !selectedFile.value) return
  
  isUploading.value = true
  
  setTimeout(() => {
    emit('upload', {
      exercises: parseResult.value!.exercises,
      filename: selectedFile.value!.name
    })
    
    resetUpload()
    isUploading.value = false
  }, 500)
}

function resetUpload() {
  selectedFile.value = null
  parseResult.value = null
  errorMessage.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function toggleFormatExample() {
  showFormatExample.value = !showFormatExample.value
}

const formatExampleText = getFormatExample()

function handleImageUpload(result: ImageUploadResult) {
  emit('upload', {
    exercises: result.exercises,
    filename: `图片识别_${Date.now()}`
  })
}
</script>

<template>
  <div class="exercise-uploader">
    <div class="upload-mode-tabs flex gap-2 mb-4">
      <button
        class="tab-btn flex-1 py-2 px-4 rounded-lg font-medium transition-colors"
        :class="uploadMode === 'text' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        @click="uploadMode = 'text'"
      >
        📝 文本上传
      </button>
      <button
        class="tab-btn flex-1 py-2 px-4 rounded-lg font-medium transition-colors"
        :class="uploadMode === 'image' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        @click="uploadMode = 'image'"
      >
        📷 拍照上传
      </button>
    </div>

    <div v-if="uploadMode === 'image'">
      <ImageExerciseUploader
        @upload="handleImageUpload"
        @cancel="uploadMode = 'text'"
      />
    </div>

    <div v-else class="text-upload-area">
    <div
      class="upload-area border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer"
      :class="[
        isDragging
          ? 'border-indigo-500 bg-indigo-50'
          : errorMessage
            ? 'border-red-300 bg-red-50'
            : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
      ]"
      @click="triggerFileInput"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <input
        ref="fileInputRef"
        type="file"
        accept=".txt,.md"
        class="hidden"
        @change="handleInputChange"
      >
      
      <div v-if="!selectedFile" class="upload-prompt">
        <div class="upload-icon text-5xl mb-3">📤</div>
        <p class="text-gray-700 font-medium mb-1">点击或拖拽上传习题文件</p>
        <p class="text-gray-400 text-sm">支持 .txt 和 .md 格式，最大 5MB</p>
      </div>
      
      <div v-else class="file-info">
        <div class="file-icon text-4xl mb-2">📄</div>
        <p class="text-gray-700 font-medium">{{ selectedFile.name }}</p>
        <p class="text-gray-400 text-sm">{{ (selectedFile.size / 1024).toFixed(1) }} KB</p>
      </div>
    </div>
    
    <div v-if="errorMessage" class="error-message mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
      <div class="flex items-start gap-3">
        <span class="text-xl">⚠️</span>
        <div>
          <p class="text-red-700 font-medium">解析失败</p>
          <p class="text-red-600 text-sm mt-1 whitespace-pre-line">{{ errorMessage }}</p>
        </div>
      </div>
    </div>
    
    <div v-if="warningMessage" class="warning-message mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <div class="flex items-start gap-3">
        <span class="text-xl">⚠️</span>
        <div>
          <p class="text-amber-700 font-medium">解析警告</p>
          <p class="text-amber-600 text-sm mt-1 whitespace-pre-line">{{ warningMessage }}</p>
        </div>
      </div>
    </div>
    
    <div v-if="hasValidResult" class="parse-result mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
      <div class="flex items-start gap-3">
        <span class="text-xl">✅</span>
        <div class="flex-1">
          <p class="text-green-700 font-medium">解析成功</p>
          <p class="text-green-600 text-sm mt-1">
            共识别到 <span class="font-bold">{{ parseResult!.stats.total }}</span> 道题目
          </p>
          
          <div class="type-stats mt-3 flex flex-wrap gap-2">
            <span
              v-for="(count, type) in typeStats"
              :key="type"
              v-show="count > 0"
              class="stat-badge px-3 py-1 rounded-full text-sm"
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
          
          <div class="preview-list mt-4 max-h-40 overflow-y-auto">
            <div
              v-for="(exercise, index) in parseResult!.exercises.slice(0, 5)"
              :key="index"
              class="preview-item py-2 border-b border-green-200 last:border-0"
            >
              <p class="text-sm text-gray-600">
                <span class="font-medium text-gray-700">{{ index + 1 }}. [{{ exercise.type }}]</span>
                {{ exercise.question.substring(0, 50) }}{{ exercise.question.length > 50 ? '...' : '' }}
              </p>
            </div>
            <p v-if="parseResult!.exercises.length > 5" class="text-sm text-gray-400 mt-2">
              还有 {{ parseResult!.exercises.length - 5 }} 道题目...
            </p>
          </div>
        </div>
      </div>
      
      <div class="confirm-actions mt-4 flex gap-3">
        <button
          class="cancel-btn flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-lg transition-colors"
          @click.stop="resetUpload"
        >
          重新选择
        </button>
        <button
          class="confirm-btn flex-1 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          :disabled="isUploading"
          @click.stop="confirmUpload"
        >
          <div v-if="isUploading" class="i-carbon-circle-dash animate-spin" />
          <span>{{ isUploading ? '上传中...' : '确认上传' }}</span>
        </button>
      </div>
    </div>
    
    <div class="upload-tips mt-4 p-4 bg-blue-50 rounded-xl">
      <button
        class="tips-header w-full flex items-center justify-between text-left"
        @click="toggleFormatExample"
      >
        <h3 class="font-medium text-blue-800 flex items-center gap-2">
          <span>💡</span>
          格式说明
        </h3>
        <div
          class="i-carbon-chevron-down text-blue-600 transition-transform"
          :class="{ 'rotate-180': showFormatExample }"
        />
      </button>
      
      <Transition name="expand">
        <div v-show="showFormatExample" class="tips-content mt-3">
          <p class="text-sm text-blue-600 mb-2">支持的题目格式示例：</p>
          <pre class="text-xs text-blue-700 bg-blue-100 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">{{ formatExampleText }}</pre>
          
          <ul class="text-sm text-blue-600 mt-3 space-y-1">
            <li>• 题型标识：选择题、填空题、简答题、口算题、竖式计算题、应用题</li>
            <li>• 题目编号：1. 或 一、 或 （1）</li>
            <li>• 选择题选项：A. B. C. D.</li>
            <li>• 答案格式：答案：xxx 或 答：xxx</li>
            <li>• 支持中文数字标题：一、二、三、四</li>
          </ul>
        </div>
      </Transition>
    </div>
    </div>
  </div>
</template>

<style scoped>
.upload-area {
  min-height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
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

.preview-list::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>
