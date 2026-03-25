export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'ollama' | 'openai-compatible' | 'minimax'
  apiKey: string
  baseUrl: string
  model: string
  temperature?: number
  maxTokens?: number
}

export interface TTSConfig {
  provider: 'openai' | 'elevenlabs' | 'edge-tts' | 'openai-compatible' | 'minimax' | 'volcengine'
  apiKey: string
  baseUrl: string
  model: string
  voice: string
  speed?: number
  appId?: string
  resourceId?: string
}

export interface STTConfig {
  provider: 'openai' | 'whisper' | 'openai-compatible' | 'browser'
  apiKey: string
  baseUrl: string
  model: string
  language?: string
}

export interface CharacterConfig {
  name: string
  systemPrompt?: string
  personality?: string
  avatarUrl?: string
}

export interface SoulConfig {
  path: string
  enabled?: boolean
}

export interface Live2DConfig {
  modelPath: string
  scale: number
  positionX: number
  positionY: number
}

export interface VisionConfig {
  provider: 'siliconflow'
  apiKey: string
  baseUrl: string
  model: string
  timeout: number
  maxRetries: number
}

export interface AppConfig {
  llm: LLMConfig
  tts: TTSConfig
  stt: STTConfig
  character: CharacterConfig
  live2d?: Live2DConfig
  soul?: SoulConfig
  vision?: VisionConfig
}

export type TaskType = '学习' | '练习' | '阅读' | '其他'
export type TaskStatus = '未完成' | '已完成'

export interface Task {
  id: string
  name: string
  description?: string
  type: TaskType
  estimatedTime: number
  date: string
  status: TaskStatus
  createdAt: string
  completedAt?: string
  exerciseIds?: string[]
}

export interface TasksData {
  tasks: Task[]
  lastUpdated: string
}

export type ImageStatus = 'pending' | 'ready' | 'used'

export interface ExerciseImage {
  id: string
  exerciseIds: string[]
  base64: string
  thumbnail?: string
  createdAt: string
  status: ImageStatus
  size: number
}

export type ExerciseType = '选择题' | '填空题' | '简答题' | '口算题' | '竖式计算题' | '应用题'

export interface Exercise {
  id: string
  type: ExerciseType
  question: string
  options?: string[]
  answer: string
  chapter?: string
  subject?: string
  hash?: string
  createdAt?: string
  completedAt?: string
  status?: 'pending' | 'completed' | 'archived'
  userAnswer?: string
  isCorrect?: boolean
  images?: string[]
  hasImageReference?: boolean
}

export interface ExercisesData {
  exercises: Exercise[]
  lastUpdated: string
}

export interface ExerciseRecord {
  exerciseId?: string
  type?: ExerciseType
  question?: string
  userAnswer?: string
  correctAnswer?: string
  isCorrect?: boolean
  completedAt?: string
  status?: 'completed' | 'expired'
  date?: string
  subject?: string
  score?: number
  total?: number
  weakPoints?: string[]
}

export interface ConversationSummary {
  timestamp: string
  duration?: number
  topic: string
  keyPoints: string[]
  performance: '积极' | '需要改进'
  emotion: '开心' | '困惑' | '疲惫' | '平静'
  tasksCompleted?: string[]
  nextSuggestions?: string[]
}

export interface UserProfile {
  name: string
  age: number
  grade: string
}

export interface LearningProgress {
  totalTasks: number
  completedTasks: number
  completionRate: number
  totalStudyTime: number
  consecutiveDays: number
}

export interface UserPreferences {
  favoriteSubjects: string[]
  learningStyle: string
  bestStudyTime: string
}

export interface MemoryData {
  userId: string
  createdAt: string
  lastUpdated: string
  profile: UserProfile
  learningProgress: LearningProgress
  exerciseRecords: ExerciseRecord[]
  conversationSummaries: ConversationSummary[]
  preferences: UserPreferences
}

export interface TaskIntent {
  type: 'complete_task' | 'start_task' | 'query_progress' | 'none'
  taskName?: string
  confidence: number
}

export interface AgentContext {
  memory: MemoryData | null
  todayTasks: Task[]
  currentTask?: Task
  userMessage: string
}

// ==================== 短期记忆与长期记忆系统类型定义 ====================

export type MessageType = 'text' | 'voice' | 'emotion'
export type MasteryLevel = '未掌握' | '初步理解' | '基本掌握' | '熟练掌握'

export interface MessageContext {
  currentTask?: string
  emotion?: string
  intent?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  messageType: MessageType
  context: MessageContext
}

export interface ShortTermMemoryMetadata {
  totalMessages: number
  sessionCount: number
  lastSessionTime: string
}

export type MemoryStatus = 'pending' | 'summarized'

export interface ShortTermMemoryData {
  date: string
  userId: string
  messages: ChatMessage[]
  metadata: ShortTermMemoryMetadata
  practiceSummaries?: PracticeSummary[]
  status: MemoryStatus
  summaryDate?: string
  summarizedMessageCount?: number
  summarizedPracticeCount?: number
  createdAt: string
  lastUpdated: string
}

export interface EmotionStats {
  primary: string
  distribution: Record<string, number>
}

export interface LearnedTopic {
  topic: string
  masteryLevel: MasteryLevel
  practiceCount: number
  correctRate: number
}

export type PracticeType = '选择题' | '填空题' | '简答题' | '口算题' | '竖式计算题' | '应用题' | '混合练习'

export interface PracticeQuestionResult {
  exerciseId: string
  questionType: ExerciseType
  question: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  feedback?: string
  relatedTopic?: string
  timeSpent?: number
}

export interface PracticeSummary {
  sessionId: string
  practiceType: PracticeType
  startTime: string
  endTime: string
  duration: number
  totalQuestions: number
  completedQuestions: number
  correctCount: number
  wrongCount: number
  accuracy: number
  performance: '优秀' | '良好' | '一般' | '需加强'
  speedRating: '快速' | '适中' | '较慢'
  questionResults: PracticeQuestionResult[]
  relatedTopics: string[]
  masteredTopics: string[]
  weakTopics: string[]
  keyFindings: string[]
  improvementSuggestions: string[]
  nextSteps: string[]
}

export interface PracticeAnalysis {
  overallPerformance: '优秀' | '良好' | '一般' | '需加强'
  practiceHighlights: string[]
  areasToImprove: string[]
  practiceSuggestions: string[]
}

export interface DailySummary {
  date: string
  summary: string
  keyPoints: string[]
  emotion: EmotionStats
  tasksCompleted: string[]
  studyDuration: number
  weakPoints: string[]
  achievements: string[]
  learnedTopics: LearnedTopic[]
  practiceSummaries?: PracticeSummary[]
  totalPracticeCount?: number
  totalPracticeTime?: number
  overallPracticeAccuracy?: number
  practiceAnalysis?: PracticeAnalysis
}

export interface TopicRecord {
  topic: string
  firstLearnedDate: string
  lastReviewDate: string
  masteryLevel: MasteryLevel
  practiceCount: number
  correctRate: number
  relatedQuestions: string[]
  notes: string
  weakSubTopics?: string[]
}

export interface AccumulatedKnowledge {
  masteredTopics: string[]
  weakTopics: string[]
  totalStudyDays: number
  totalStudyHours: number
}

export interface LongTermMemoryData {
  userId: string
  dailySummaries: DailySummary[]
  topicRecords: Record<string, TopicRecord>
  accumulatedKnowledge: AccumulatedKnowledge
  createdAt: string
  lastUpdated: string
}

export interface ArchiveResult {
  archived: boolean
  summary?: DailySummary
  error?: string
}

export interface TopicSearchResult {
  found: boolean
  record?: TopicRecord
  relatedSummaries: DailySummary[]
  suggestions: string[]
}
