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

export interface AppConfig {
  llm: LLMConfig
  tts: TTSConfig
  stt: STTConfig
  character: CharacterConfig
  live2d?: Live2DConfig
  soul?: SoulConfig
}

export type TaskType = '学习' | '练习' | '阅读' | '其他'
export type TaskStatus = '待完成' | '进行中' | '已完成'

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
}

export interface TasksData {
  tasks: Task[]
  lastUpdated: string
}

export type ExerciseType = '选择题' | '填空题' | '简答题'

export interface Exercise {
  id: string
  type: ExerciseType
  question: string
  options?: string[]
  answer: string
  chapter?: string
  subject?: string
}

export interface ExercisesData {
  exercises: Exercise[]
  lastUpdated: string
}

export interface ExerciseRecord {
  date: string
  subject?: string
  score: number
  total: number
  weakPoints: string[]
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
