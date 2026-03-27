import { describe, it, expect } from 'vitest'
import { isValidSummary } from '../services/memory-archive'
import type { DailySummary } from '@/config/types'

describe('isValidSummary', () => {
  it('应拒绝 null', () => {
    expect(isValidSummary(null)).toBe(false)
  })

  it('应拒绝空 summary', () => {
    const summary: DailySummary = {
      date: '2026-03-23',
      summary: '',
      keyPoints: [],
      emotion: { primary: '平静', distribution: { '平静': 1 } },
      tasksCompleted: [],
      studyDuration: 0,
      weakPoints: [],
      achievements: [],
      learnedTopics: [],
      practiceSummaries: [],
      totalPracticeCount: 0,
      totalPracticeTime: 0,
      overallPracticeAccuracy: 0
    }
    expect(isValidSummary(summary)).toBe(false)
  })

  it('应拒绝仅有空白字符的 summary', () => {
    const summary: DailySummary = {
      date: '2026-03-23',
      summary: '   ',
      keyPoints: [],
      emotion: { primary: '平静', distribution: { '平静': 1 } },
      tasksCompleted: [],
      studyDuration: 0,
      weakPoints: [],
      achievements: [],
      learnedTopics: [],
      practiceSummaries: [],
      totalPracticeCount: 0,
      totalPracticeTime: 0,
      overallPracticeAccuracy: 0
    }
    expect(isValidSummary(summary)).toBe(false)
  })

  it('应拒绝无数据字段', () => {
    const summary: DailySummary = {
      date: '2026-03-23',
      summary: '',
      keyPoints: [],
      emotion: { primary: '平静', distribution: { '平静': 1 } },
      tasksCompleted: [],
      studyDuration: 0,
      weakPoints: [],
      achievements: [],
      learnedTopics: [],
      practiceSummaries: [],
      totalPracticeCount: 0,
      totalPracticeTime: 0,
      overallPracticeAccuracy: 0
    }
    expect(isValidSummary(summary)).toBe(false)
  })

  it('应接受有效的 summary (有 summary 字段)', () => {
    const summary: DailySummary = {
      date: '2026-03-23',
      summary: '今天学习了除法运算',
      keyPoints: [],
      emotion: { primary: '平静', distribution: { '平静': 1 } },
      tasksCompleted: [],
      studyDuration: 0,
      weakPoints: [],
      achievements: [],
      learnedTopics: [],
      practiceSummaries: [],
      totalPracticeCount: 0,
      totalPracticeTime: 0,
      overallPracticeAccuracy: 0
    }
    expect(isValidSummary(summary)).toBe(true)
  })

  it('应接受有效的 summary (有 studyDuration)', () => {
    const summary: DailySummary = {
      date: '2026-03-23',
      summary: '',
      keyPoints: [],
      emotion: { primary: '平静', distribution: { '平静': 1 } },
      tasksCompleted: [],
      studyDuration: 30,
      weakPoints: [],
      achievements: [],
      learnedTopics: [],
      practiceSummaries: [],
      totalPracticeCount: 0,
      totalPracticeTime: 0,
      overallPracticeAccuracy: 0
    }
    expect(isValidSummary(summary)).toBe(true)
  })

  it('应接受有效的 summary (有 keyPoints)', () => {
    const summary: DailySummary = {
      date: '2026-03-23',
      summary: '',
      keyPoints: ['除法', '乘法'],
      emotion: { primary: '平静', distribution: { '平静': 1 } },
      tasksCompleted: [],
      studyDuration: 0,
      weakPoints: [],
      achievements: [],
      learnedTopics: [],
      practiceSummaries: [],
      totalPracticeCount: 0,
      totalPracticeTime: 0,
      overallPracticeAccuracy: 0
    }
    expect(isValidSummary(summary)).toBe(true)
  })

  it('应接受完整的有效 summary', () => {
    const summary: DailySummary = {
      date: '2026-03-23',
      summary: '今天学习了除法运算，掌握了基本的除法技巧',
      keyPoints: ['除法', '数学运算'],
      emotion: { primary: '开心', distribution: { '开心': 0.8, '平静': 0.2 } },
      tasksCompleted: ['完成练习册第5页'],
      studyDuration: 45,
      weakPoints: [],
      achievements: ['今日学习之星'],
      learnedTopics: [
        { topic: '除法基础', masteryLevel: '熟练掌握', practiceCount: 10, correctRate: 0.9 }
      ],
      practiceSummaries: [],
      totalPracticeCount: 2,
      totalPracticeTime: 30,
      overallPracticeAccuracy: 0.85
    }
    expect(isValidSummary(summary)).toBe(true)
  })
})
