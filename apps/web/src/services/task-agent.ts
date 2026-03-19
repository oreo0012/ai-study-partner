import type { Task, TaskIntent } from '@/config/types'

export class TaskAgent {
  private encouragementMessages = {
    task_complete: [
      '太棒了！你完成了今天的任务，继续加油呀！🌟',
      '太厉害了！你真是一个爱学习的好孩子！⭐',
      '太棒了！你已经完成了一个任务哦，继续保持！✨',
      '哇！你好棒呀！完成任务的你超级厉害！🎉'
    ],
    task_start: [
      '好的，让我们开始学习吧！加油！💪',
      '好的！我相信你一定能完成的！🌟',
      '开始学习啦！有问题随时问我哦～📚'
    ],
    progress_query: [
      '你今天已经完成了{completed}个任务，还有{remaining}个要加油哦！',
      '今天的进度很不错呢！已完成{completed}个，继续努力！✨'
    ]
  }

  recognizeTaskIntent(userMessage: string, pendingTasks: Task[]): TaskIntent {
    const message = userMessage.toLowerCase()
    
    const completePatterns = [
      /完成了|做完了|结束了|搞定了|好啦|好了|结束|做完/
    ]
    
    const startPatterns = [
      /开始|启动|去做|来写|来学习|开始吧|开始学习/
    ]
    
    const queryPatterns = [
      /进度|完成了多少|还有几个|多少任务/
    ]
    
    for (const pattern of completePatterns) {
      if (pattern.test(message)) {
        if (pendingTasks.length > 0) {
          return {
            type: 'complete_task',
            taskName: pendingTasks[0].name,
            confidence: 0.9
          }
        }
        return {
          type: 'complete_task',
          confidence: 0.7
        }
      }
    }
    
    for (const pattern of startPatterns) {
      if (pattern.test(message) && pendingTasks.length > 0) {
        return {
          type: 'start_task',
          taskName: pendingTasks[0].name,
          confidence: 0.85
        }
      }
    }
    
    for (const pattern of queryPatterns) {
      if (pattern.test(message)) {
        return {
          type: 'query_progress',
          confidence: 0.9
        }
      }
    }
    
    return {
      type: 'none',
      confidence: 0
    }
  }

  generateCompletionMessage(taskName: string): string {
    const messages = this.encouragementMessages.task_complete
    const randomIndex = Math.floor(Math.random() * messages.length)
    return messages[randomIndex]
  }

  generateStartMessage(taskName: string): string {
    return `好的，让我们开始${taskName}吧！我会一直陪着你的哦～`
  }

  generateProgressMessage(completed: number, remaining: number): string {
    if (remaining === 0) {
      return `太棒了！你已经完成了今天所有的${completed}个任务！真是一个爱学习的好孩子！🌟`
    }
    
    if (completed === 0) {
      return `今天还有${remaining}个任务等着你呢，让我们开始学习吧！💪`
    }
    
    const baseMessage = this.encouragementMessages.progress_query[0]
    return baseMessage.replace('{completed}', String(completed)).replace('{remaining}', String(remaining))
  }

  generateTaskReminderMessage(pendingTasks: Task[]): string {
    if (pendingTasks.length === 0) {
      return ''
    }
    
    const firstTask = pendingTasks[0]
    const remaining = pendingTasks.length
    
    if (remaining === 1) {
      return `我注意到你今天还有1个任务没完成：「${firstTask.name}」～要不要现在就开始呀？🌟`
    }
    
    return `我注意到你今天还有${remaining}个任务没完成呢～第一个是「${firstTask.name}」，我们要不要开始呀？💪`
  }

  generateWeakPointReminder(weakPoints: string[]): string {
    if (!weakPoints || weakPoints.length === 0) {
      return ''
    }
    
    const weakPoint = weakPoints[0]
    return `上次练习中，我发现「${weakPoint}」还需要再加强一下～我们要不要现在练习一下呀？📚`
  }

  analyzeTaskCompletion(
    userResponse: string,
    expectedTaskName: string
  ): { confirmed: boolean; confidence: number } {
    const response = userResponse.toLowerCase()
    
    const positivePatterns = [
      /是|对|嗯|好|啦|确实|真的|完成了|做好了/
    ]
    
    const negativePatterns = [
      /没有|还没|不是|不对|还没完成/
    ]
    
    for (const pattern of positivePatterns) {
      if (pattern.test(response)) {
        return { confirmed: true, confidence: 0.9 }
      }
    }
    
    for (const pattern of negativePatterns) {
      if (pattern.test(response)) {
        return { confirmed: false, confidence: 0.85 }
      }
    }
    
    return { confirmed: false, confidence: 0.3 }
  }
}

export const taskAgent = new TaskAgent()
