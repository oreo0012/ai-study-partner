import type { EmotionType, EmotionConfig } from './emotion'
import { EMOTION_KEYWORDS } from './emotion'

const EMOTION_TAG_PATTERN = /\[(happy|sad|angry|surprised|thinking|confused|excited|shy|worried|neutral)\]/gi
const EMOTION_XML_PATTERN = /<emotion>(happy|sad|angry|surprised|thinking|confused|excited|shy|worried|neutral)<\/emotion>/gi

export interface EmotionParseResult {
  emotion: EmotionType
  confidence: number
  matchedKeyword?: string
  matchedTag?: string
}

export class EmotionParser {
  private currentEmotion: EmotionType = 'neutral'
  private emotionHistory: Array<{ emotion: EmotionType; timestamp: number }> = []
  private readonly historyMaxSize = 10
  private readonly emotionStabilityThreshold = 3

  parseFromText(text: string): EmotionParseResult | null {
    const tagResult = this.parseFromTags(text)
    if (tagResult) {
      return tagResult
    }

    const keywordResult = this.parseFromKeywords(text)
    if (keywordResult) {
      return keywordResult
    }

    return null
  }

  private parseFromTags(text: string): EmotionParseResult | null {
    const bracketMatches = text.matchAll(EMOTION_TAG_PATTERN)
    for (const match of bracketMatches) {
      const emotion = match[1].toLowerCase() as EmotionType
      return {
        emotion,
        confidence: 1.0,
        matchedTag: match[0]
      }
    }

    const xmlMatches = text.matchAll(EMOTION_XML_PATTERN)
    for (const match of xmlMatches) {
      const emotion = match[1].toLowerCase() as EmotionType
      return {
        emotion,
        confidence: 1.0,
        matchedTag: match[0]
      }
    }

    return null
  }

  private parseFromKeywords(text: string): EmotionParseResult | null {
    const lowerText = text.toLowerCase()
    let bestMatch: EmotionParseResult | null = null
    let maxScore = 0

    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      if (emotion === 'neutral') continue

      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase()
        if (lowerText.includes(keywordLower)) {
          const score = this.calculateKeywordScore(keyword, text)
          if (score > maxScore) {
            maxScore = score
            bestMatch = {
              emotion: emotion as EmotionType,
              confidence: score,
              matchedKeyword: keyword
            }
          }
        }
      }
    }

    return bestMatch
  }

  private calculateKeywordScore(keyword: string, text: string): number {
    const lowerText = text.toLowerCase()
    const keywordLower = keyword.toLowerCase()
    
    let score = 0.5

    const exactMatchPattern = new RegExp(`\\b${keywordLower}\\b`, 'i')
    if (exactMatchPattern.test(text)) {
      score += 0.3
    }

    const position = lowerText.indexOf(keywordLower)
    if (position !== -1) {
      const relativePosition = position / text.length
      if (relativePosition < 0.3) {
        score += 0.2
      }
    }

    const punctuationAfter = new RegExp(`${keywordLower}[。！？.!?]`, 'i')
    if (punctuationAfter.test(text)) {
      score += 0.1
    }

    return Math.min(score, 1.0)
  }

  updateEmotion(newEmotion: EmotionType): EmotionType {
    const now = Date.now()
    this.emotionHistory.push({ emotion: newEmotion, timestamp: now })

    if (this.emotionHistory.length > this.historyMaxSize) {
      this.emotionHistory.shift()
    }

    const stableEmotion = this.getStableEmotion()
    if (stableEmotion) {
      this.currentEmotion = stableEmotion
    }

    return this.currentEmotion
  }

  private getStableEmotion(): EmotionType | null {
    if (this.emotionHistory.length < this.emotionStabilityThreshold) {
      return null
    }

    const recentEmotions = this.emotionHistory.slice(-this.emotionStabilityThreshold)
    const emotionCounts = new Map<EmotionType, number>()

    for (const { emotion } of recentEmotions) {
      emotionCounts.set(emotion, (emotionCounts.get(emotion) || 0) + 1)
    }

    let maxCount = 0
    let dominantEmotion: EmotionType | null = null

    for (const [emotion, count] of emotionCounts) {
      if (count > maxCount) {
        maxCount = count
        dominantEmotion = emotion
      }
    }

    if (maxCount >= Math.ceil(this.emotionStabilityThreshold / 2)) {
      return dominantEmotion
    }

    return null
  }

  getCurrentEmotion(): EmotionType {
    return this.currentEmotion
  }

  getEmotionHistory(): Array<{ emotion: EmotionType; timestamp: number }> {
    return [...this.emotionHistory]
  }

  reset(): void {
    this.currentEmotion = 'neutral'
    this.emotionHistory = []
  }
}

export function parseEmotionFromStream(
  text: string,
  parser: EmotionParser
): EmotionConfig | null {
  const result = parser.parseFromText(text)
  
  if (result) {
    const stableEmotion = parser.updateEmotion(result.emotion)
    return {
      type: stableEmotion,
      intensity: result.confidence
    }
  }

  return null
}

export function stripEmotionTags(text: string): string {
  return text
    .replace(EMOTION_TAG_PATTERN, '')
    .replace(EMOTION_XML_PATTERN, '')
    .trim()
}
