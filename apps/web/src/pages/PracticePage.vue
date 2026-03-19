<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores'
import ExercisePractice from '@/components/ExercisePractice.vue'
import type { Exercise } from '@/config/types'

const router = useRouter()
const taskStore = useTaskStore()

const isLoading = ref(true)
const exercises = ref<Exercise[]>([])
const currentIndex = ref(0)
const isPracticeActive = ref(false)
const practiceResult = ref<{
  score: number
  total: number
  wrongAnswers: Array<{ question: string; userAnswer: string; correctAnswer: string }>
  suggestions: string[]
} | null>(null)

const currentExercise = computed(() => {
  if (exercises.value.length === 0) return null
  return exercises.value[currentIndex.value]
})

const progress = computed(() => {
  if (exercises.value.length === 0) return 0
  return Math.round(((currentIndex.value) / exercises.value.length) * 100)
})

const totalCount = computed(() => exercises.value.length)
const currentNumber = computed(() => currentIndex.value + 1)

onMounted(async () => {
  isLoading.value = true
  try {
    const data = await fetch('/data/exercises.json')
    const json = await data.json()
    exercises.value = json.exercises || []
    await taskStore.loadTodayTasks()
    const practiceTask = taskStore.todayTasks.find(t => t.type === '练习')
    if (practiceTask) {
      await taskStore.completeTask(practiceTask.id)
    }
  } catch (error) {
    console.error('Failed to load exercises:', error)
  } finally {
    isLoading.value = false
  }
})

function startPractice() {
  if (exercises.value.length > 0) {
    isPracticeActive.value = true
    currentIndex.value = 0
    practiceResult.value = null
  }
}

function handleAnswer(answer: string, isCorrect: boolean) {
  console.log('Answer:', answer, 'Correct:', isCorrect)
}

function handleComplete(result: typeof practiceResult.value) {
  practiceResult.value = result
  isPracticeActive.value = false
}

function nextExercise() {
  if (currentIndex.value < exercises.value.length - 1) {
    currentIndex.value++
  }
}

function previousExercise() {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

function goBack() {
  router.push('/tasks')
}

function retryPractice() {
  currentIndex.value = 0
  practiceResult.value = null
  isPracticeActive.value = true
}
</script>

<template>
  <div class="practice-page">
    <header class="page-header">
      <button class="back-button" @click="goBack">
        <span class="i-carbon-arrow-left"></span>
      </button>
      <h1 class="page-title">习题练习</h1>
      <div class="header-spacer"></div>
    </header>

    <main class="page-content">
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <div class="loading-text">加载习题中...</div>
      </div>

      <template v-else-if="!isPracticeActive && !practiceResult">
        <div class="practice-overview">
          <div class="overview-icon">📝</div>
          <h2 class="overview-title">准备开始练习</h2>
          <div class="overview-stats">
            <div class="stat-item">
              <span class="stat-value">{{ totalCount }}</span>
              <span class="stat-label">总题数</span>
            </div>
          </div>
          <button 
            class="start-button" 
            @click="startPractice"
            :disabled="exercises.length === 0"
          >
            {{ exercises.length > 0 ? '开始练习' : '暂无习题' }}
          </button>
        </div>
      </template>

      <template v-else-if="isPracticeActive && currentExercise">
        <div class="practice-header">
          <div class="progress-info">
            <span class="progress-text">{{ currentNumber }} / {{ totalCount }}</span>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" :style="{ width: `${progress}%` }"></div>
            </div>
          </div>
        </div>

        <ExercisePractice
          :exercise="currentExercise"
          :exercise-number="currentNumber"
          @answer="handleAnswer"
          @complete="handleComplete"
          @next="nextExercise"
          @previous="previousExercise"
        />
      </template>

      <template v-else-if="practiceResult">
        <div class="practice-result">
          <div class="result-icon">🎉</div>
          <h2 class="result-title">练习完成！</h2>
          
          <div class="score-card">
            <div class="score-value">{{ practiceResult.score }}</div>
            <div class="score-divider">/</div>
            <div class="score-total">{{ practiceResult.total }}</div>
            <div class="score-label">得分</div>
          </div>

          <div v-if="practiceResult.wrongAnswers.length > 0" class="wrong-answers">
            <h3 class="section-title">错题回顾</h3>
            <div 
              v-for="(item, index) in practiceResult.wrongAnswers" 
              :key="index"
              class="wrong-item"
            >
              <div class="wrong-question">{{ item.question }}</div>
              <div class="wrong-detail">
                <span class="wrong-user">你的答案：{{ item.userAnswer }}</span>
                <span class="wrong-correct">正确答案：{{ item.correctAnswer }}</span>
              </div>
            </div>
          </div>

          <div v-if="practiceResult.suggestions.length > 0" class="suggestions">
            <h3 class="section-title">学习建议</h3>
            <div 
              v-for="(suggestion, index) in practiceResult.suggestions" 
              :key="index"
              class="suggestion-item"
            >
              {{ suggestion }}
            </div>
          </div>

          <div class="result-actions">
            <button class="retry-button" @click="retryPractice">
              再练一次
            </button>
            <button class="back-button-result" @click="goBack">
              返回任务列表
            </button>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.practice-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 10;
}

.back-button {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.back-button:hover {
  transform: scale(1.1);
}

.page-title {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
}

.header-spacer {
  width: 3rem;
}

.page-content {
  padding: 1.5rem;
  max-width: 800px;
  margin: 0 auto;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
}

.loading-spinner {
  width: 3rem;
  height: 3rem;
  border: 4px solid #a7f3d0;
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 1rem;
  font-size: 1.125rem;
  color: #065f46;
}

.practice-overview {
  background: white;
  border-radius: 1.5rem;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.overview-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.overview-title {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 1.5rem;
}

.overview-stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #10b981;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.start-button {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 9999px;
  padding: 1rem 3rem;
  font-size: 1.125rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.start-button:hover:not(:disabled) {
  transform: scale(1.05);
}

.start-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  box-shadow: none;
}

.practice-header {
  margin-bottom: 1.5rem;
}

.progress-info {
  background: white;
  border-radius: 1rem;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.progress-text {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
  display: block;
}

.progress-bar-bg {
  height: 0.5rem;
  background: #e5e7eb;
  border-radius: 9999px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 9999px;
  transition: width 0.3s ease;
}

.practice-result {
  background: white;
  border-radius: 1.5rem;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.result-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.result-title {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 1.5rem;
}

.score-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.score-value {
  font-size: 3rem;
  font-weight: bold;
  color: #10b981;
}

.score-divider {
  font-size: 2rem;
  color: #9ca3af;
}

.score-total {
  font-size: 2rem;
  font-weight: bold;
  color: #6b7280;
}

.score-label {
  font-size: 0.875rem;
  color: #9ca3af;
  margin-left: 0.5rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 1rem;
  text-align: left;
}

.wrong-answers,
.suggestions {
  margin-bottom: 1.5rem;
  text-align: left;
}

.wrong-item {
  background: #fef2f2;
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 0.75rem;
}

.wrong-question {
  font-weight: 500;
  color: #991b1b;
  margin-bottom: 0.5rem;
}

.wrong-detail {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
}

.wrong-user {
  color: #dc2626;
}

.wrong-correct {
  color: #10b981;
}

.suggestion-item {
  background: #f0fdf4;
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 0.75rem;
  color: #065f46;
  text-align: left;
}

.result-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.retry-button {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 9999px;
  padding: 1rem 2rem;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-button:hover {
  transform: scale(1.02);
}

.back-button-result {
  background: white;
  color: #10b981;
  border: 2px solid #10b981;
  border-radius: 9999px;
  padding: 1rem 2rem;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-button-result:hover {
  background: #f0fdf4;
}
</style>
