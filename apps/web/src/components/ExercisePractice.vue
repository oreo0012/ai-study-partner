<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Exercise, ExerciseType } from '@/config/types'

const props = defineProps<{
  exercise: Exercise
  exerciseNumber: number
}>()

const emit = defineEmits<{
  (e: 'answer', answer: string, isCorrect: boolean): void
  (e: 'complete', result: {
    score: number
    total: number
    wrongAnswers: Array<{ question: string; userAnswer: string; correctAnswer: string }>
    suggestions: string[]
  }): void
  (e: 'next'): void
  (e: 'previous'): void
}>()

const userAnswer = ref('')
const isAnswered = ref(false)
const isCorrect = ref(false)
const allResults = ref<Array<{ question: string; userAnswer: string; correctAnswer: string; isCorrect: boolean }>>([])

const typeLabel = computed(() => {
  const labels: Record<ExerciseType, string> = {
    '选择题': '单选题',
    '填空题': '填空题',
    '简答题': '简答题',
    '口算题': '口算题',
    '竖式计算题': '竖式计算题',
    '应用题': '应用题'
  }
  return labels[props.exercise.type] || props.exercise.type
})

const typeIcon = computed(() => {
  const icons: Record<ExerciseType, string> = {
    '选择题': '🔘',
    '填空题': '✏️',
    '简答题': '📝',
    '口算题': '🔢',
    '竖式计算题': '📐',
    '应用题': '📖'
  }
  return icons[props.exercise.type] || '📝'
})

function selectOption(option: string) {
  if (isAnswered.value) return
  
  userAnswer.value = option
  checkAnswer()
}

function submitFillIn() {
  if (isAnswered.value || !userAnswer.value.trim()) return
  checkAnswer()
}

function checkAnswer() {
  isAnswered.value = true
  const correctAnswer = props.exercise.answer.trim()
  const userAns = userAnswer.value.trim()
  
  if (props.exercise.type === '选择题') {
    isCorrect.value = userAns === correctAnswer
  } else {
    isCorrect.value = userAns === correctAnswer
  }

  allResults.value.push({
    question: props.exercise.question,
    userAnswer: userAns,
    correctAnswer: correctAnswer,
    isCorrect: isCorrect.value
  })

  emit('answer', userAns, isCorrect.value)
}

function next() {
  userAnswer.value = ''
  isAnswered.value = false
  isCorrect.value = false
  emit('next')
}

function previous() {
  userAnswer.value = ''
  isAnswered.value = false
  isCorrect.value = false
  emit('previous')
}

function complete() {
  const correctCount = allResults.value.filter(r => r.isCorrect).length
  const wrongAnswers = allResults.value
    .filter(r => !r.isCorrect)
    .map(r => ({
      question: r.question,
      userAnswer: r.userAnswer || '(未作答)',
      correctAnswer: r.correctAnswer
    }))
  
  const suggestions = generateSuggestions(correctCount, allResults.value.length, wrongAnswers)
  
  emit('complete', {
    score: correctCount,
    total: allResults.value.length,
    wrongAnswers,
    suggestions
  })
}

function generateSuggestions(
  score: number,
  total: number,
  wrongAnswers: Array<{ question: string; userAnswer: string; correctAnswer: string }>
): string[] {
  const suggestions: string[] = []
  const rate = score / total

  if (rate < 0.6) {
    suggestions.push('需要多加练习哦～建议先复习相关知识点，再来做题！')
  } else if (rate < 0.8) {
    suggestions.push('做得不错！再仔细一点就更棒了～')
  } else if (rate < 1) {
    suggestions.push('太厉害了！只差一点点就全对了，继续加油！')
  } else {
    suggestions.push('完美！你真是一个学习小能手！🌟')
  }

  if (wrongAnswers.length > 0) {
    suggestions.push(`建议复习「${wrongAnswers[0].question.substring(0, 10)}...」相关的知识点哦！`)
  }

  return suggestions
}
</script>

<template>
  <div class="exercise-practice">
    <div class="exercise-card">
      <div class="exercise-header">
        <span class="exercise-icon">{{ typeIcon }}</span>
        <span class="exercise-type">{{ typeLabel }}</span>
      </div>

      <div class="question-section">
        <div class="question-text">{{ exercise.question }}</div>
      </div>

      <div v-if="exercise.type === '选择题' && exercise.options" class="options-section">
        <button
          v-for="(option, index) in exercise.options"
          :key="index"
          class="option-button"
          :class="{
            'selected': userAnswer === option,
            'correct': isAnswered && option === exercise.answer,
            'incorrect': isAnswered && userAnswer === option && option !== exercise.answer
          }"
          :disabled="isAnswered"
          @click="selectOption(option)"
        >
          <span class="option-letter">{{ String.fromCharCode(65 + index) }}.</span>
          <span class="option-text">{{ option }}</span>
        </button>
      </div>

      <div v-else-if="exercise.type === '填空题'" class="fillin-section">
        <input
          v-model="userAnswer"
          type="text"
          class="fillin-input"
          :class="{ 'answered': isAnswered }"
          :disabled="isAnswered"
          placeholder="请输入答案..."
          @keyup.enter="submitFillIn"
        />
        <button
          v-if="!isAnswered"
          class="submit-button"
          :disabled="!userAnswer.trim()"
          @click="submitFillIn"
        >
          提交答案
        </button>
      </div>

      <div v-else-if="exercise.type === '口算题'" class="fillin-section">
        <input
          v-model="userAnswer"
          type="text"
          class="fillin-input"
          :class="{ 'answered': isAnswered }"
          :disabled="isAnswered"
          placeholder="请输入计算结果..."
          @keyup.enter="submitFillIn"
        />
        <button
          v-if="!isAnswered"
          class="submit-button"
          :disabled="!userAnswer.trim()"
          @click="submitFillIn"
        >
          提交答案
        </button>
      </div>

      <div v-else-if="exercise.type === '竖式计算题'" class="fillin-section">
        <textarea
          v-model="userAnswer"
          class="fillin-textarea"
          :class="{ 'answered': isAnswered }"
          :disabled="isAnswered"
          placeholder="请输入计算过程和结果..."
          rows="4"
        ></textarea>
        <button
          v-if="!isAnswered"
          class="submit-button"
          :disabled="!userAnswer.trim()"
          @click="submitFillIn"
        >
          提交答案
        </button>
      </div>

      <div v-else-if="exercise.type === '应用题'" class="fillin-section">
        <textarea
          v-model="userAnswer"
          class="fillin-textarea"
          :class="{ 'answered': isAnswered }"
          :disabled="isAnswered"
          placeholder="请写出解题步骤和答案..."
          rows="6"
        ></textarea>
        <button
          v-if="!isAnswered"
          class="submit-button"
          :disabled="!userAnswer.trim()"
          @click="submitFillIn"
        >
          提交答案
        </button>
      </div>

      <div v-else-if="exercise.type === '简答题'" class="fillin-section">
        <textarea
          v-model="userAnswer"
          class="fillin-textarea"
          :class="{ 'answered': isAnswered }"
          :disabled="isAnswered"
          placeholder="请输入你的答案..."
          rows="4"
        ></textarea>
        <button
          v-if="!isAnswered"
          class="submit-button"
          :disabled="!userAnswer.trim()"
          @click="submitFillIn"
        >
          提交答案
        </button>
      </div>

      <div v-if="isAnswered" class="feedback-section">
        <div class="feedback-icon">{{ isCorrect ? '🎉' : '🤔' }}</div>
        <div class="feedback-text">
          {{ isCorrect ? '回答正确！你真棒！' : `正确答案是：${exercise.answer}` }}
        </div>
        <div v-if="!isCorrect" class="feedback-explanation">
          没关系哦，错了也没关系，继续加油！
        </div>
      </div>

      <div class="action-section">
        <button 
          v-if="isAnswered" 
          class="action-button primary"
          @click="next"
        >
          下一题
        </button>
        <button 
          v-if="isAnswered" 
          class="action-button secondary"
          @click="complete"
        >
          完成练习
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exercise-practice {
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.exercise-card {
  background: white;
  border-radius: 1.5rem;
  padding: 1.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.exercise-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f3f4f6;
}

.exercise-icon {
  font-size: 1.5rem;
}

.exercise-type {
  font-size: 1rem;
  font-weight: 600;
  color: #10b981;
  background: #ecfdf5;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
}

.question-section {
  margin-bottom: 1.5rem;
}

.question-text {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.6;
}

.options-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.option-button {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.option-button:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #10b981;
}

.option-button.selected {
  background: #ecfdf5;
  border-color: #10b981;
}

.option-button.correct {
  background: #d1fae5;
  border-color: #10b981;
}

.option-button.incorrect {
  background: #fef2f2;
  border-color: #ef4444;
}

.option-button:disabled {
  cursor: default;
}

.option-letter {
  font-weight: bold;
  color: #10b981;
  width: 1.5rem;
}

.option-text {
  font-size: 1rem;
  color: #374151;
  flex: 1;
}

.fillin-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.fillin-input,
.fillin-textarea {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 1rem;
  font-size: 1rem;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.fillin-input:focus,
.fillin-textarea:focus {
  outline: none;
  border-color: #10b981;
}

.fillin-input.answered,
.fillin-textarea.answered {
  background: #f9fafb;
}

.fillin-textarea {
  resize: vertical;
  min-height: 100px;
}

.submit-button {
  align-self: flex-end;
  padding: 0.75rem 2rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 9999px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-button:hover:not(:disabled) {
  transform: scale(1.02);
}

.submit-button:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.feedback-section {
  text-align: center;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 1rem;
  margin-bottom: 1.5rem;
}

.feedback-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.feedback-text {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.feedback-explanation {
  font-size: 0.875rem;
  color: #6b7280;
}

.action-section {
  display: flex;
  gap: 1rem;
}

.action-button {
  flex: 1;
  padding: 1rem;
  border: none;
  border-radius: 1rem;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button.primary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.action-button.primary:hover {
  transform: scale(1.02);
}

.action-button.secondary {
  background: #f3f4f6;
  color: #374151;
}

.action-button.secondary:hover {
  background: #e5e7eb;
}
</style>
