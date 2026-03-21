import type { Exercise } from '@/config/types'
import { loadExercises } from '@/services/data-service'
import { useChatStore } from '@/stores'

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
      
      const isCorrect = response.includes('正确') || response.includes('✅')
      
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
    
    const { loadMemory } = await import('@/services/data-service')
    const memoryData = await loadMemory()
    const userName = memoryData?.profile?.name || '宝贝'
    
    let prompt = `你是一位品学兼优且极具耐心的好学生，你正在辅导你最好的朋友${userName}学习，你们刚刚完成了一次练习。\n\n`
    prompt += `练习情况：\n`
    prompt += `- 总题数：${totalQuestions}\n`
    prompt += `- 正确数：${correctCount}\n`
    prompt += `- 错误数：${wrongCount}\n\n`
    
    if (wrongExercises.length > 0) {
      prompt += `做错的题目：\n`
      wrongExercises.forEach((ex, index) => {
        const userAnswer = this.session.answers.get(ex.id)
        prompt += `${index + 1}. ${ex.question}\n`
        prompt += `   学生答案：${userAnswer}\n`
        prompt += `   正确答案：${ex.answer}\n\n`
      })
    }
    
    prompt += `请生成一段总结报告，要求：\n`
    prompt += `1. 先表扬${userName}完成了所有题目\n`
    prompt += `2. 如果有错题，温和地指出错误,并给出正确答案和解题思路，适合小学生理解\n`
    prompt += `3. 回答正确的题目不用点评，鼓励孩子继续保持\n`
    prompt += `4. 如果有错题，询问是否需要类似的题目来巩固\n`
    prompt += `5. 语气要友好、亲切，像朋友一样\n`
    prompt += `6. 鼓励孩子继续努力\n`
    prompt += `7. 不超过100字\n`  
    
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
