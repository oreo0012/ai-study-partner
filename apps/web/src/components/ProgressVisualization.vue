<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  completedTasks: number
  totalTasks: number
  studyTime: number
  consecutiveDays: number
}>()

const completionRate = computed(() => {
  if (props.totalTasks === 0) return 0
  return Math.round((props.completedTasks / props.totalTasks) * 100)
})

const encouragementText = computed(() => {
  const rate = completionRate.value
  if (props.totalTasks === 0) return '今天还没有任务哦，快去添加吧！'
  if (rate === 0) return '加油！开始你的学习之旅吧！'
  if (rate < 30) return '不错的开始！继续加油哦！'
  if (rate < 60) return '你已经完成了一半，太棒了！'
  if (rate < 100) return '太厉害了！马上就要完成了！'
  return '完美！今天的任务全部完成啦！'
})

const studyTimeDisplay = computed(() => {
  const minutes = props.studyTime
  if (minutes < 60) {
    return `${minutes}分钟`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
})

const progressColor = computed(() => {
  const rate = completionRate.value
  if (rate < 30) return 'from-red-400 to-orange-400'
  if (rate < 60) return 'from-orange-400 to-yellow-400'
  if (rate < 100) return 'from-yellow-400 to-green-400'
  return 'from-green-400 to-emerald-500'
})
</script>

<template>
  <div class="progress-visualization">
    <div class="progress-header">
      <span class="header-icon">📊</span>
      <span class="header-title">今日进度</span>
    </div>

    <div class="progress-bar-container">
      <div class="progress-info">
        <span class="progress-text">{{ completedTasks }} / {{ totalTasks }}</span>
        <span class="progress-percent">{{ completionRate }}%</span>
      </div>
      <div class="progress-bar-bg">
        <div 
          class="progress-bar-fill"
          :class="progressColor"
          :style="{ width: `${completionRate}%` }"
        ></div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">⏰</div>
        <div class="stat-content">
          <div class="stat-value">{{ studyTimeDisplay }}</div>
          <div class="stat-label">学习时长</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🔥</div>
        <div class="stat-content">
          <div class="stat-value">{{ consecutiveDays }}天</div>
          <div class="stat-label">连续学习</div>
        </div>
      </div>
    </div>

    <div class="encouragement">
      <div class="encouragement-icon">✨</div>
      <div class="encouragement-text">{{ encouragementText }}</div>
    </div>
  </div>
</template>

<style scoped>
.progress-visualization {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 1.5rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.header-icon {
  font-size: 1.5rem;
}

.header-title {
  font-size: 1.25rem;
  font-weight: bold;
  color: #1e40af;
}

.progress-bar-container {
  margin-bottom: 1.5rem;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.progress-text {
  font-size: 1rem;
  color: #4b5563;
}

.progress-percent {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1e40af;
}

.progress-bar-bg {
  height: 1.5rem;
  background: #e5e7eb;
  border-radius: 9999px;
  overflow: hidden;
  position: relative;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 9999px;
  background: linear-gradient(90deg, var(--tw-gradient-stops));
  transition: width 0.5s ease-in-out;
  position: relative;
}

.progress-bar-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat-card {
  background: white;
  border-radius: 1rem;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-icon {
  font-size: 2rem;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: bold;
  color: #1f2937;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.encouragement {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 1rem;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.encouragement-icon {
  font-size: 1.5rem;
  animation: sparkle 1.5s ease-in-out infinite;
}

@keyframes sparkle {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.2) rotate(10deg); }
}

.encouragement-text {
  font-size: 1rem;
  color: #92400e;
  font-weight: 500;
}
</style>
