<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { longTermMemoryService } from '@/services/long-term-memory'
import { shortTermMemoryService } from '@/services/short-term-memory'
import { memoryArchiveService, isValidSummary } from '@/services/memory-archive'
import { memoryLogger } from '@/services/memory-logger'
import { useConfigStore } from '@/stores/config'
import { createChatProvider, streamChat } from '@/services'
import { getTasksByDate } from '@/services/data-service'
import type { DailySummary, PracticeSummary, Task } from '@/config/types'

const configStore = useConfigStore()

const dailySummaries = ref<DailySummary[]>([])
const isLoading = ref(false)
const isSummarizing = ref(false)
const summaryMessage = ref('')
const summaryStatus = ref<'success' | 'error' | ''>('')
const todayMessageCount = ref(0)
const todayPracticeCount = ref(0)
const todayTaskCount = ref(0)
const todayCompletedTaskCount = ref(0)
const hasTodaySummary = ref(false)
const memoryStatus = ref<'pending' | 'summarized'>('pending')
const newContentCount = ref({ messages: 0, practices: 0 })
const summarizedMessageCount = ref(0)
const summarizedPracticeCount = ref(0)

const today = new Date().toISOString().split('T')[0]

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`
}

const getMasteryColor = (level: string): string => {
  switch (level) {
    case '熟练掌握': return 'text-green-600 bg-green-100'
    case '基本掌握': return 'text-blue-600 bg-blue-100'
    case '初步理解': return 'text-yellow-600 bg-yellow-100'
    default: return 'text-gray-600 bg-gray-100'
  }
}

const getEmotionIcon = (emotion: string): string => {
  const icons: Record<string, string> = {
    '开心': '😊',
    '兴奋': '🤩',
    '平静': '😌',
    '好奇': '🤔',
    '困惑': '😕',
    '沮丧': '😔',
    '自信': '💪'
  }
  return icons[emotion] || '😐'
}

const loadDailySummaries = async () => {
  isLoading.value = true
  try {
    const summaries = await longTermMemoryService.getRecentSummaries(30)
    dailySummaries.value = summaries.reverse()
    
    const todaySummary = summaries.find(s => s.date === today)
    hasTodaySummary.value = !!todaySummary
    
    console.log(`[每日学习汇报] 加载了 ${summaries.length} 条日总结`)
  } catch (error) {
    console.error('Failed to load daily summaries:', error)
  } finally {
    isLoading.value = false
  }
}

const loadTodayMessages = async () => {
  try {
    const memoryDate = await shortTermMemoryService.getDate()
    if (memoryDate === today) {
      const messages = await shortTermMemoryService.getMessages()
      todayMessageCount.value = messages.length
      
      const practiceSummaries = await shortTermMemoryService.getPracticeSummaries()
      todayPracticeCount.value = practiceSummaries.length
      
      const tasks = await getTasksByDate(today)
      todayTaskCount.value = tasks.length
      todayCompletedTaskCount.value = tasks.filter(t => t.status === '已完成').length
      
      memoryStatus.value = await shortTermMemoryService.getStatus()
      summarizedMessageCount.value = await shortTermMemoryService.getSummarizedMessageCount()
      summarizedPracticeCount.value = await shortTermMemoryService.getSummarizedPracticeCount()
      
      const newContent = await shortTermMemoryService.getNewContentCountAfterSummary()
      newContentCount.value = newContent
    } else {
      todayMessageCount.value = 0
      todayPracticeCount.value = 0
      todayTaskCount.value = 0
      todayCompletedTaskCount.value = 0
      newContentCount.value = { messages: 0, practices: 0 }
    }
  } catch (error) {
    console.error('Failed to load today messages:', error)
  }
}

const hasNewContent = computed(() => {
  return newContentCount.value.messages > 0 || newContentCount.value.practices > 0
})

const buttonState = computed(() => {
  if (isSummarizing.value) {
    return { text: '总结中...', disabled: true, icon: '⏳' }
  }
  if (todayMessageCount.value === 0 && todayPracticeCount.value === 0) {
    return { text: '暂无内容', disabled: true, icon: '📭' }
  }
  if (memoryStatus.value === 'summarized') {
    if (hasNewContent.value) {
      return { text: '更新总结', disabled: false, icon: '🔄' }
    }
    return { text: '今日已总结', disabled: true, icon: '✅' }
  }
  return { text: '总结当日', disabled: false, icon: '✨' }
})

const callLLM = async (systemPrompt: string, userPrompt: string): Promise<string> => {
  const llmConfig = configStore.llmConfig
  
  if (!llmConfig?.apiKey) {
    throw new Error('LLM配置未设置，请在设置页面配置API密钥')
  }
  
  const provider = createChatProvider(llmConfig)
  
  return new Promise((resolve, reject) => {
    let result = ''
    let abortController: AbortController | null = null
    
    try {
      abortController = new AbortController()
      
      streamChat({
        model: llmConfig.model,
        provider,
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.7,
        maxTokens: 2048
      }, {
        signal: abortController.signal,
        onToken: (token) => { result += token },
        onComplete: () => resolve(result),
        onError: (err) => reject(err)
      })
    } catch (error) {
      reject(error)
    }
  })
}

const handleSummarizeToday = async () => {
  if (isSummarizing.value) return
  
  isSummarizing.value = true
  summaryMessage.value = memoryStatus.value === 'summarized' ? '正在更新总结...' : '正在总结今日学习...'
  summaryStatus.value = ''
  
  const startTime = Date.now()
  
  try {
    console.log('[每日学习汇报] 开始总结当日学习')
    
    const messages = await shortTermMemoryService.getMessages()
    const practiceSummaries = await shortTermMemoryService.getPracticeSummaries()
    const tasks = await getTasksByDate(today)
    
    if (messages.length === 0 && practiceSummaries.length === 0 && tasks.length === 0) {
      summaryMessage.value = '今日暂无学习记录，无法生成总结'
      summaryStatus.value = 'error'
      return
    }
    
    memoryLogger.logArchiveStart(messages.length)
    
    let summary: DailySummary
    
    if (memoryStatus.value === 'summarized' && hasNewContent.value) {
      console.log('[每日学习汇报] 增量更新模式')
      
      const existingSummary = await longTermMemoryService.getSummaryByDate(today)
      const newMessages = await shortTermMemoryService.getNewMessagesAfterSummary()
      const newPractices = await shortTermMemoryService.getNewPracticesAfterSummary()
      
      if (existingSummary) {
        summary = await memoryArchiveService.generateIncrementalSummary(
          existingSummary,
          newMessages,
          newPractices,
          callLLM,
          tasks
        )
      } else {
        summary = await memoryArchiveService.generateSummary(messages, callLLM, practiceSummaries, tasks)
      }
    } else {
      console.log('[每日学习汇报] 首次总结模式')
      summary = await memoryArchiveService.generateSummary(messages, callLLM, practiceSummaries, tasks)
    }
    
    summary.date = today
    
    if (practiceSummaries.length > 0) {
      summary.practiceSummaries = practiceSummaries
      summary.totalPracticeCount = practiceSummaries.length
      summary.totalPracticeTime = practiceSummaries.reduce((sum, p) => sum + p.duration, 0)
      summary.overallPracticeAccuracy = practiceSummaries.reduce((sum, p) => sum + p.accuracy, 0) / practiceSummaries.length
    }
    
    if (!isValidSummary(summary)) {
      console.error('[每日学习汇报] 生成的总结无效，拒绝保存空数据')
      summaryMessage.value = '总结生成失败，已保留原有数据。请稍后重试。'
      summaryStatus.value = 'error'
      return
    }
    
    await longTermMemoryService.addDailySummary(summary)
    console.log('[每日学习汇报] 日总结已保存')
    
    await shortTermMemoryService.markAsSummarized()
    console.log('[每日学习汇报] 短期记忆已标记为已总结')
    
    const duration = Date.now() - startTime
    memoryLogger.logArchiveComplete(today)
    
    summaryMessage.value = `总结完成！耗时 ${duration}ms，共总结 ${summary.keyPoints.length} 个知识点`
    summaryStatus.value = 'success'
    hasTodaySummary.value = true
    
    await loadDailySummaries()
    await loadTodayMessages()
    
  } catch (error) {
    const duration = Date.now() - startTime
    memoryLogger.logArchiveFailed(String(error))
    
    summaryMessage.value = `总结失败: ${error}`
    summaryStatus.value = 'error'
    console.error('[每日学习汇报] 总结失败:', error)
  } finally {
    isSummarizing.value = false
  }
}

const totalStudyDays = computed(() => dailySummaries.value.length)
const totalKeyPoints = computed(() => {
  return dailySummaries.value.reduce((sum, s) => sum + s.keyPoints.length, 0)
})
const totalStudyHours = computed(() => {
  const minutes = dailySummaries.value.reduce((sum, s) => sum + s.studyDuration, 0)
  return (minutes / 60).toFixed(1)
})
const totalTasksCompleted = computed(() => {
  return dailySummaries.value.reduce((sum, s) => sum + (s.tasksCompleted?.length || 0), 0)
})

onMounted(async () => {
  await configStore.load()
  await loadDailySummaries()
  await loadTodayMessages()
})
</script>

<template>
  <div class="daily-learning-report">
    <div class="report-header">
      <div class="header-title">
        <span class="title-icon">📊</span>
        <h3>每日学习汇报</h3>
      </div>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-value">{{ totalStudyDays }}</span>
          <span class="stat-label">学习天数</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ totalKeyPoints }}</span>
          <span class="stat-label">知识点</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ totalTasksCompleted }}</span>
          <span class="stat-label">完成任务</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ totalStudyHours }}</span>
          <span class="stat-label">学习小时</span>
        </div>
      </div>
    </div>

    <div class="summarize-section">
      <div class="today-status">
        <div class="status-info">
          <span class="status-icon">📅</span>
          <span class="status-text">
            今日已有 <strong>{{ todayMessageCount }}</strong> 条对话记录
            <span v-if="todayTaskCount > 0" class="task-badge">
              , <strong>{{ todayCompletedTaskCount }}</strong>/{{ todayTaskCount }} 个任务完成
            </span>
            <span v-if="memoryStatus === 'summarized' && hasNewContent" class="new-content-badge">
              (新增 {{ newContentCount.messages }} 条对话, {{ newContentCount.practices }} 个练习)
            </span>
          </span>
        </div>
        <button
          class="summarize-btn"
          :class="{ 'disabled': buttonState.disabled }"
          :disabled="buttonState.disabled"
          @click="handleSummarizeToday"
        >
          <span v-if="isSummarizing" class="loading-spinner"></span>
          <span v-else class="btn-icon">{{ buttonState.icon }}</span>
          <span>{{ buttonState.text }}</span>
        </button>
      </div>
      
      <Transition name="fade">
        <div v-if="summaryMessage" class="summary-message" :class="summaryStatus">
          <span class="message-icon">{{ summaryStatus === 'success' ? '✅' : summaryStatus === 'error' ? '❌' : '⏳' }}</span>
          <span>{{ summaryMessage }}</span>
        </div>
      </Transition>
    </div>

    <div class="summaries-list">
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner large"></div>
        <span>加载中...</span>
      </div>
      
      <div v-else-if="dailySummaries.length === 0" class="empty-state">
        <span class="empty-icon">📝</span>
        <p>暂无学习记录</p>
        <p class="empty-hint">开始学习后，点击"总结当日"按钮生成学习汇报</p>
      </div>
      
      <div v-else class="timeline">
        <div
          v-for="summary in dailySummaries"
          :key="summary.date"
          class="timeline-item"
        >
          <div class="timeline-date">
            <span class="date-text">{{ formatDate(summary.date) }}</span>
            <span v-if="summary.date === today" class="today-badge">今日</span>
          </div>
          
          <div class="timeline-content">
            <div class="summary-text">{{ summary.summary }}</div>
            
            <div class="summary-meta">
              <div class="meta-item">
                <span class="meta-icon">⏱️</span>
                <span>学习时长: {{ summary.studyDuration }}分钟</span>
              </div>
              <div class="meta-item">
                <span class="meta-icon">{{ getEmotionIcon(summary.emotion.primary) }}</span>
                <span>情绪: {{ summary.emotion.primary }}</span>
              </div>
            </div>
            
            <div v-if="summary.tasksCompleted && summary.tasksCompleted.length > 0" class="tasks-completed">
              <div class="tasks-title">
                <span>✅</span>
                <span>完成任务</span>
              </div>
              <div class="tasks-list">
                <span
                  v-for="(task, index) in summary.tasksCompleted"
                  :key="index"
                  class="task-item"
                >
                  {{ task }}
                </span>
              </div>
            </div>
            
            <div v-if="summary.keyPoints.length > 0" class="key-points">
              <div class="points-title">
                <span>📚</span>
                <span>学习知识点</span>
              </div>
              <div class="points-tags">
                <span
                  v-for="(point, index) in summary.keyPoints.slice(0, 5)"
                  :key="index"
                  class="point-tag"
                >
                  {{ point }}
                </span>
                <span v-if="summary.keyPoints.length > 5" class="more-tag">
                  +{{ summary.keyPoints.length - 5 }}
                </span>
              </div>
            </div>
            
            <div v-if="summary.learnedTopics && summary.learnedTopics.length > 0" class="learned-topics">
              <div class="topics-title">
                <span>🎯</span>
                <span>掌握情况</span>
              </div>
              <div class="topics-list">
                <div
                  v-for="topic in summary.learnedTopics.slice(0, 3)"
                  :key="topic.topic"
                  class="topic-item"
                >
                  <span class="topic-name">{{ topic.topic }}</span>
                  <span class="topic-mastery" :class="getMasteryColor(topic.masteryLevel)">
                    {{ topic.masteryLevel }}
                  </span>
                </div>
              </div>
            </div>
            
            <div v-if="summary.weakPoints && summary.weakPoints.length > 0" class="weak-points">
              <div class="weak-title">
                <span>⚠️</span>
                <span>薄弱知识点</span>
              </div>
              <div class="weak-tags">
                <span
                  v-for="(point, index) in summary.weakPoints"
                  :key="index"
                  class="weak-tag"
                >
                  {{ point }}
                </span>
              </div>
            </div>
            
            <div v-if="summary.achievements && summary.achievements.length > 0" class="achievements">
              <div class="achievements-title">
                <span>🏆</span>
                <span>今日成就</span>
              </div>
              <div class="achievements-list">
                <span
                  v-for="(achievement, index) in summary.achievements"
                  :key="index"
                  class="achievement-item"
                >
                  {{ achievement }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.daily-learning-report {
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.report-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1.25rem;
  color: white;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.title-icon {
  font-size: 1.5rem;
}

.header-title h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.header-stats {
  display: flex;
  gap: 1.5rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.stat-label {
  font-size: 0.75rem;
  opacity: 0.9;
}

.summarize-section {
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.today-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-icon {
  font-size: 1.25rem;
}

.status-text {
  color: #475569;
  font-size: 0.875rem;
}

.status-text strong {
  color: #667eea;
  font-weight: 600;
}

.summarize-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.summarize-btn:hover:not(.disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.summarize-btn.disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 1rem;
}

.loading-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-spinner.large {
  width: 2rem;
  height: 2rem;
  border-width: 3px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.summary-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}

.summary-message.success {
  background: #dcfce7;
  color: #166534;
}

.summary-message.error {
  background: #fee2e2;
  color: #991b1b;
}

.summaries-list {
  padding: 1rem;
  max-height: 500px;
  overflow-y: auto;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: #64748b;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-hint {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.5rem;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.timeline-item {
  background: #f8fafc;
  border-radius: 0.75rem;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.timeline-date {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
}

.date-text {
  font-weight: 600;
  color: #334155;
}

.today-badge {
  padding: 0.125rem 0.5rem;
  background: #667eea;
  color: white;
  font-size: 0.625rem;
  font-weight: 600;
  border-radius: 1rem;
}

.timeline-content {
  padding: 1rem;
}

.summary-text {
  color: #475569;
  font-size: 0.875rem;
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

.summary-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #64748b;
}

.meta-icon {
  font-size: 0.875rem;
}

.key-points,
.learned-topics,
.weak-points,
.achievements,
.tasks-completed {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed #e2e8f0;
}

.points-title,
.topics-title,
.weak-title,
.achievements-title,
.tasks-title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.5rem;
}

.points-tags,
.weak-tags,
.tasks-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.point-tag,
.task-item {
  padding: 0.25rem 0.625rem;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 0.6875rem;
  border-radius: 1rem;
}

.task-item {
  background: #dcfce7;
  color: #166534;
}

.more-tag {
  padding: 0.25rem 0.5rem;
  background: #f1f5f9;
  color: #64748b;
  font-size: 0.6875rem;
  border-radius: 1rem;
}

.topics-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.topic-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.5rem;
  background: white;
  border-radius: 0.375rem;
  font-size: 0.75rem;
}

.topic-name {
  color: #475569;
}

.topic-mastery {
  padding: 0.125rem 0.5rem;
  font-size: 0.625rem;
  font-weight: 500;
  border-radius: 1rem;
}

.weak-tag {
  padding: 0.25rem 0.625rem;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.6875rem;
  border-radius: 1rem;
}

.achievements-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.achievement-item {
  padding: 0.25rem 0.625rem;
  background: #dcfce7;
  color: #166534;
  font-size: 0.6875rem;
  border-radius: 1rem;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .header-stats {
    gap: 1rem;
  }
  
  .stat-value {
    font-size: 1.25rem;
  }
  
  .today-status {
    flex-direction: column;
    align-items: stretch;
  }
  
  .summarize-btn {
    justify-content: center;
  }
}
</style>
