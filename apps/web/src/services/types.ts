export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
}

export interface ChatSession {
  id: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}
