import type { Exercise, PracticeSummary, PracticeQuestionResult, PracticeType } from '@/config/types'
import { loadExercises } from '@/services/data-service'
import { shortTermMemoryService } from '@/services/short-term-memory'
import { useChatStore } from '@/stores'

function generateSessionId(): string {
  return `practice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

function determinePracticeType(exercises: Exercise[]): PracticeType {
  const types = new Set(exercises.map(e => e.type))
  if (types.size === 1) {
    return exercises[0].type as PracticeType
  }
  return '混合练习'
}

function calculatePerformance(accuracy: number): '优秀' | '良好' | '一般' | '需加强' {
  if (accuracy >= 0.9) return '优秀'
  if (accuracy >= 0.7) return '良好'
  if (accuracy >= 0.5) return '一般'
  return '需加强'
}

function calculateSpeedRating(durationMinutes: number, questionCount: number): '快速' | '适中' | '较慢' {
  const avgTimePerQuestion = durationMinutes * 60 / questionCount
  if (avgTimePerQuestion < 30) return '快速'
  if (avgTimePerQuestion < 60) return '适中'
  return '较慢'
}

export interface PracticeSession {
  exercises: Exercise[]
  currentIndex: number
  answers: Map<string, string>
  results: Map<string, { isCorrect: boolean; feedback: string }>
  startTime: Date
  endTime?: Date
}

export class SelfPracticeSkill {
  private session: PracticeSession | null = null
  private chatStore = useChatStore()

  async startPractice(exerciseIds?: string[]): Promise<void> {
    const exercisesData = await loadExercises()
    let exercises = exercisesData.exercises
    
    if (exerciseIds && exerciseIds.length > 0) {
      exercises = exercises.filter(ex => exerciseIds.includes(ex.id))
    }
    
    if (exercises.length === 0) {
      const message = '抱歉，没有找到可练习的题目。请先让家长上传试卷哦！📚'
      this.chatStore.addAssistantMessage(message)
      await this.chatStore.speakText(message)
      return
    }
    
    this.session = {
      exercises,
      currentIndex: 0,
      answers: new Map(),
      results: new Map(),
      startTime: new Date()
    }
    
    const welcomeMessage = `你准备好了吗？我们现在开始了哦！🎉\n\n共有 ${exercises.length} 道题目。`
    
    this.chatStore.addAssistantMessage(welcomeMessage)
    
    await this.chatStore.speakText(welcomeMessage)
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    await this.showCurrentQuestion()
  }

  private async showCurrentQuestion(): Promise<void> {
    if (!this.session) return

    const exercise = this.session.exercises[this.session.currentIndex]
    const questionNumber = this.session.currentIndex + 1

    let questionText = `第 ${questionNumber} 题，`
    questionText += `(${exercise.type}) `
    questionText += `${exercise.question}`

    if (exercise.images && exercise.images.length > 0) {
      questionText += `\n\n[本题包含 ${exercise.images.length} 张图片，请查看屏幕下方图片区域]`
    }

    if (exercise.type === '选择题' && exercise.options) {
      questionText += '\n'
      exercise.options.forEach((option, index) => {
        questionText += `${String.fromCharCode(65 + index)}. ${option}  `
      })
    }

    this.chatStore.addAssistantMessage(questionText)

    await this.chatStore.speakText(questionText)
  }

  async submitAnswer(answer: string): Promise<void> {
    if (!this.session) return
    
    const exercise = this.session.exercises[this.session.currentIndex]
    
    this.session.answers.set(exercise.id, answer)
    
    this.chatStore.addUserMessage(answer)
    
    const result = await this.evaluateAnswer(exercise, answer)
    
    this.session.results.set(exercise.id, result)
    
    this.chatStore.addAssistantMessage(result.feedback)
    
    await this.chatStore.speakText(result.feedback)
    
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    this.session.currentIndex++
    
    if (this.session.currentIndex < this.session.exercises.length) {
      await this.showCurrentQuestion()
    } else {
      await this.finishPractice()
    }
  }

  private async evaluateAnswer(
    exercise: Exercise, 
    userAnswer: string
  ): Promise<{ isCorrect: boolean; feedback: string }> {
    const prompt = this.buildEvaluationPrompt(exercise, userAnswer)
    
    try {
      const response = await this.chatStore.generateResponse(prompt)
      
      const isCorrect = this.checkAnswerCorrectness(response)
      
      if (isCorrect) {
        const encouragements = [
          '太棒了！你算对了！',
          '完全正确！',
          '真厉害！答对了！',
          '非常好！正确！',
          '很棒！继续加油！'
        ]
        const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)]
        
        return {
          isCorrect: true,
          feedback: randomEncouragement
        }
      }
      
      return {
        isCorrect: false,
        feedback: response
      }
    } catch (error) {
      console.error('Failed to evaluate answer:', error)
      return {
        isCorrect: false,
        feedback: '抱歉，判断答案时出错了。让我们继续下一题吧！'
      }
    }
  }

  private checkAnswerCorrectness(response: string): boolean {
    const lowerResponse = response.toLowerCase()
    
    const correctIndicators = [
      '正确',
      '对了',
      '答对了',
      '算对了',
      '做对了',
      '完全正确',
      '完全对',
      '答得对',
      '✅',
      '✓',
      '√',
      '对的',
      '是对的'
    ]
    
    const wrongIndicators = [
      '有些问题',
      '不对',
      '差一点',
      '算错了',
      '不太对',
      '不正确',
      '❌',
      '✗',
      '有点问题'
    ]
    
    for (const indicator of wrongIndicators) {
      if (lowerResponse.includes(indicator.toLowerCase())) {
        return false
      }
    }
    
    for (const indicator of correctIndicators) {
      if (lowerResponse.includes(indicator.toLowerCase())) {
        return true
      }
    }
    
    return false
  }

  private buildEvaluationPrompt(exercise: Exercise, userAnswer: string): string {
    let prompt = `你是一位耐心的老师，正在批改学生的作业。\n\n`
    prompt += `题目类型：${exercise.type}\n`
    prompt += `题目内容：${exercise.question}\n`
    
    if (exercise.type === '选择题' && exercise.options) {
      prompt += `选项：\n`
      exercise.options.forEach((option, index) => {
        prompt += `${String.fromCharCode(65 + index)}. ${option}\n`
      })
    }
    
    prompt += `\n正确答案：${exercise.answer || '（需要计算）'}\n`
    prompt += `学生答案：${userAnswer}\n\n`
    
    prompt += `如果学生的答案错误，请：\n`
    prompt += `1. 温和地指出错误\n`
    prompt += `2. 给出正确答案\n`
    prompt += `3. 提供解题思路\n`
    prompt += `4. 反馈要简洁（不超过80字），适合小学生理解\n`
    prompt += `5. 使用中文回复\n\n`
    prompt += `请直接给出反馈，不要有其他内容。`
    
    return prompt
  }

  private async finishPractice(): Promise<void> {
    if (!this.session) return
    
    this.session.endTime = new Date()
    
    const totalQuestions = this.session.exercises.length
    const correctCount = Array.from(this.session.results.values())
      .filter(r => r.isCorrect).length
    const wrongCount = totalQuestions - correctCount
    
    await this.updateExerciseStatus()
    
    await this.updateRelatedTaskStatus()
    
    await this.savePracticeRecord(totalQuestions, correctCount, wrongCount)
    
    const practiceSummary = this.generatePracticeSummary(totalQuestions, correctCount, wrongCount)
    await this.savePracticeSummaryToMemory(practiceSummary)
    
    const summaryText = await this.generateSummaryWithLLM(totalQuestions, correctCount, wrongCount)
    
    const finalSummary = summaryText || this.generateFallbackSummary(totalQuestions, correctCount, wrongCount)
    
    this.chatStore.addAssistantMessage(finalSummary)
    
    await this.chatStore.speakText(finalSummary)
    
    this.session = null
  }

  private async updateExerciseStatus(): Promise<void> {
    if (!this.session) return
    
    const { loadExercises, saveExercises } = await import('@/services/data-service')
    const exercisesData = await loadExercises()
    
    for (const exercise of this.session.exercises) {
      const result = this.session.results.get(exercise.id)
      const userAnswer = this.session.answers.get(exercise.id)
      
      const exerciseIndex = exercisesData.exercises.findIndex(e => e.id === exercise.id)
      if (exerciseIndex !== -1) {
        exercisesData.exercises[exerciseIndex] = {
          ...exercisesData.exercises[exerciseIndex],
          status: 'completed',
          userAnswer: userAnswer || '',
          isCorrect: result?.isCorrect || false,
          completedAt: new Date().toISOString()
        }
      }
    }
    
    await saveExercises(exercisesData)
  }

  private async updateRelatedTaskStatus(): Promise<void> {
    if (!this.session) return
    
    const { useTaskStore } = await import('@/stores')
    const taskStore = useTaskStore()
    
    const exerciseIds = this.session.exercises.map(e => e.id)
    
    const relatedTask = taskStore.tasks.find(task => 
      task.exerciseIds && 
      task.exerciseIds.some(id => exerciseIds.includes(id)) &&
      task.status === '未完成'
    )
    
    if (relatedTask) {
      await taskStore.completeTask(relatedTask.id)
    }
  }

  private async savePracticeRecord(total: number, correct: number, wrong: number): Promise<void> {
    if (!this.session) return
    
    const { addExerciseRecord } = await import('@/services/data-service')
    
    const wrongExercises = this.session.exercises.filter((ex) => {
      const result = this.session.results.get(ex.id)
      return result && !result.isCorrect
    })
    
    await addExerciseRecord({
      date: new Date().toISOString().split('T')[0],
      score: correct,
      total: total,
      weakPoints: wrongExercises.map(ex => ex.type)
    })
  }

  private generatePracticeSummary(total: number, correct: number, wrong: number): PracticeSummary {
    if (!this.session || !this.session.endTime) {
      throw new Error('No active practice session')
    }

    const duration = Math.round((this.session.endTime.getTime() - this.session.startTime.getTime()) / 60000)
    const accuracy = total > 0 ? correct / total : 0
    
    const questionResults: PracticeQuestionResult[] = this.session.exercises.map(ex => {
      const result = this.session!.results.get(ex.id)
      const userAnswer = this.session!.answers.get(ex.id)
      
      return {
        exerciseId: ex.id,
        questionType: ex.type,
        question: ex.question,
        userAnswer: userAnswer || '',
        correctAnswer: ex.answer || '',
        isCorrect: result?.isCorrect || false,
        feedback: result?.feedback,
        relatedTopic: ex.chapter || ex.subject
      }
    })

    const wrongExercises = this.session.exercises.filter(ex => {
      const result = this.session!.results.get(ex.id)
      return result && !result.isCorrect
    })

    const correctExercises = this.session.exercises.filter(ex => {
      const result = this.session!.results.get(ex.id)
      return result && result.isCorrect
    })

    const weakTopics = [...new Set(wrongExercises.map(ex => ex.chapter || ex.subject).filter(Boolean) as string[])]
    const masteredTopics = [...new Set(correctExercises.map(ex => ex.chapter || ex.subject).filter(Boolean) as string[])]
    const relatedTopics = [...new Set(this.session.exercises.map(ex => ex.chapter || ex.subject).filter(Boolean) as string[])]

    return {
      sessionId: generateSessionId(),
      practiceType: determinePracticeType(this.session.exercises),
      startTime: this.session.startTime.toISOString(),
      endTime: this.session.endTime.toISOString(),
      duration,
      totalQuestions: total,
      completedQuestions: total,
      correctCount: correct,
      wrongCount: wrong,
      accuracy,
      performance: calculatePerformance(accuracy),
      speedRating: calculateSpeedRating(duration, total),
      questionResults,
      relatedTopics,
      masteredTopics,
      weakTopics,
      keyFindings: [],
      improvementSuggestions: [],
      nextSteps: []
    }
  }

  private async savePracticeSummaryToMemory(summary: PracticeSummary): Promise<void> {
    try {
      await shortTermMemoryService.savePracticeSummary(summary)
      console.log(`[自主练习] 练习总结已保存到短期记忆: ${summary.sessionId}`)
    } catch (error) {
      console.error('[自主练习] 保存练习总结失败:', error)
    }
  }

  private generateFallbackSummary(total: number, correct: number, wrong: number): string {
    let summary = `你真棒，全部题目都完成啦！🎉\n\n`
    summary += `**成绩单**\n`
    summary += `- 总题数：${total}\n`
    summary += `- 正确数：${correct}\n`
    summary += `- 错误数：${wrong}\n\n`
    
    if (wrong > 0) {
      summary += `这次你有 ${wrong} 题做错了，加油！💪\n`
      summary += `是否要我帮你找一些类似的题目来巩固一下呀？`
    } else {
      summary += `太棒了！你全部答对了！🌟\n`
      summary += `继续保持，你真是一个学习小能手！`
    }
    
    return summary
  }

  private async generateSummaryWithLLM(
    totalQuestions: number,
    correctCount: number,
    wrongCount: number
  ): Promise<string> {
    const wrongExercises = this.session.exercises.filter((ex) => {
      const result = this.session.results.get(ex.id)
      return result && !result.isCorrect
    })
    
    const correctExercises = this.session.exercises.filter((ex) => {
      const result = this.session.results.get(ex.id)
      return result && result.isCorrect
    })
    
    const { loadMemory } = await import('@/services/data-service')
    const memoryData = await loadMemory()
    const userName = memoryData?.profile?.name || '宝贝'
    
    let prompt = `你是一位品学兼优且极具耐心的好学生，你正在辅导你最好的朋友${userName}学习，你们刚刚完成了一次练习。

【重要规则】
- 必须使用"${userName}"称呼用户，绝对不要使用其他名字如"小明"、"小红"等
- 对于答对的题目，只需要说"真棒"或"继续保持"等简单鼓励，不要讲解解题过程
- 只对答错的题目进行讲解

练习情况：
- 总题数：${totalQuestions}
- 正确数：${correctCount}
- 错误数：${wrongCount}
`
    
    if (correctExercises.length > 0) {
      prompt += `\n答对的题目（共${correctExercises.length}题，只需简单鼓励，不要讲解）：\n`
      correctExercises.forEach((ex, index) => {
        prompt += `${index + 1}. ${ex.question}\n`
      })
    }
    
    if (wrongExercises.length > 0) {
      prompt += `\n做错的题目（共${wrongExercises.length}题，需要讲解）：\n`
      wrongExercises.forEach((ex, index) => {
        const userAnswer = this.session.answers.get(ex.id)
        prompt += `${index + 1}. ${ex.question}\n`
        prompt += `   学生答案：${userAnswer}\n`
        prompt += `   正确答案：${ex.answer}\n\n`
      })
    }
    
    prompt += `\n请生成一段总结报告，要求：
1. 首先表扬${userName}完成了所有题目
2. 对于答对的题目，只说"${userName}真棒，这些题都对了！"之类的话，不要讲解
3. 只对做错的题目进行讲解，给出正确答案和解题思路
4. 语气要友好、亲切，像朋友一样
5. 不超过100字`  
    
    try {
      const response = await this.chatStore.generateResponse(prompt)
      return response
    } catch (error) {
      console.error('Failed to generate summary:', error)
      
      let summaryText = `${userName}，你真棒，全部题目都完成啦！🎉\n\n`
      summaryText += `**成绩单**\n`
      summaryText += `- 总题数：${totalQuestions}\n`
      summaryText += `- 正确数：${correctCount}\n`
      summaryText += `- 错误数：${wrongCount}\n\n`
      
      if (wrongCount > 0) {
        summaryText += `这次你有 ${wrongCount} 题做错了，加油！💪\n`
        summaryText += `是否要我帮你找一些类似的题目来巩固一下呀？`
      } else {
        summaryText += `太棒了！你全部答对了！🌟\n`
        summaryText += `继续保持，你真是一个学习小能手！`
      }
      
      return summaryText
    }
  }

  getCurrentProgress(): { current: number; total: number } | null {
    if (!this.session) return null
    
    return {
      current: this.session.currentIndex + 1,
      total: this.session.exercises.length
    }
  }

  isActive(): boolean {
    return this.session !== null
  }

  stopPractice(): void {
    this.session = null
  }
}

export const selfPracticeSkill = new SelfPracticeSkill()
