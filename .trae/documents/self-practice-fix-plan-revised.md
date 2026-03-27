# 自主练习功能修复方案（修订版）

## 功能流程说明

### 用户期望的流程

1. **启动练习**：
   - 用户在 PracticePage.vue 点击"开始答题"按钮
   - 向 agent 发送"开始自主练习"指令
   - **不跳转页面，保持在当前聊天界面**

2. **Agent 处理**：
   - Agent 收到"开始自主练习"指令
   - 调用 selfPracticeSkill
   - 获取本地存储中的题目
   - 在对话框中输出第一题：
     ```
     "你准备好了吗？我们现在开始了哦！
     第一题：x*x=？"
     ```

3. **用户答题**：
   - 用户在聊天输入框发送答案
   - LLM 做出点评：
     - 正确："正确！太棒了！"
     - 错误："额...有点不对劲哦，我们晚点再讲评吧！"
   - 自动显示下一题：
     ```
     "第二题：x÷x=？"
     ```

4. **完成总结**：
   - 做完最后一题后进行总结：
     ```
     "你真棒，全部题目都完成啦~
     这次你有3题做错了，
     第一题......；
     第二题......，
     是否要我帮你找一些类似的题目来巩固一下呀？"
     ```

5. **全流程**：
   - **都在儿童聊天界面通过聊天模块完成**
   - **不需要跳转去其他页面**

## 当前问题分析

### 问题1：PracticePage.vue 的"开始答题"按钮

**当前实现**：
```typescript
// PracticePage.vue 第59-65行
function startPractice() {
  if (exercises.value.length > 0) {
    isPracticeActive.value = true  // ❌ 只是激活了旧的答题界面
    currentIndex.value = 0
    practiceResult.value = null
  }
}
```

**问题**：
- ❌ 只是激活了旧的答题界面
- ❌ 没有向 agent 发送"开始自主练习"指令
- ❌ 没有启动对话流问答

### 问题2：Agent 没有识别"开始自主练习"指令

**当前实现**：
- Agent 只能识别任务相关的指令
- 没有识别"开始自主练习"指令的逻辑
- 没有调用 selfPracticeSkill 的逻辑

### 问题3：selfPracticeSkill 没有集成到聊天流程

**当前实现**：
- selfPracticeSkill 已创建，但从未被调用
- 没有与聊天界面集成
- 没有与 Agent 集成

## 修复方案

### 步骤1：修改 PracticePage.vue 的"开始答题"按钮

**目标**：点击按钮时，向 agent 发送"开始自主练习"指令

**修改位置**：PracticePage.vue 第59-65行

**修改方案A（推荐）**：跳转到聊天页面并发送指令

```typescript
function startPractice() {
  if (exercises.value.length > 0) {
    // 跳转到聊天页面
    router.push('/')
    
    // 在下一个 tick 发送"开始自主练习"指令
    nextTick(() => {
      const chatStore = useChatStore()
      chatStore.sendMessage('开始自主练习')
    })
  }
}
```

**修改方案B**：直接在当前页面发送指令（如果聊天组件在当前页面）

```typescript
function startPractice() {
  if (exercises.value.length > 0) {
    // 直接发送"开始自主练习"指令
    const chatStore = useChatStore()
    chatStore.sendMessage('开始自主练习')
  }
}
```

### 步骤2：修改 Agent 识别"开始自主练习"指令

**目标**：Agent 收到"开始自主练习"指令后，调用 selfPracticeSkill

**修改文件**：`apps/web/src/services/task-agent.ts`

**新增方法**：

```typescript
export class TaskAgent {
  // ... 现有代码
  
  recognizePracticeIntent(message: string): boolean {
    const keywords = [
      '开始自主练习',
      '开始练习',
      '开始答题',
      '我要练习',
      '做题目'
    ]
    
    return keywords.some(keyword => message.includes(keyword))
  }
  
  async handlePracticeIntent(): Promise<string> {
    const { selfPracticeSkill } = await import('@/skills/self-practice-skill')
    
    // 启动练习
    await selfPracticeSkill.startPractice()
    
    return '好的，我们开始练习吧！'
  }
}
```

### 步骤3：修改 ChatStore 集成 Agent 和 selfPracticeSkill

**目标**：在聊天流程中识别"开始自主练习"指令并调用 selfPracticeSkill

**修改文件**：`apps/web/src/stores/chat.ts`

**修改位置**：sendMessage 方法（第140-240行）

```typescript
async function sendMessage(userMessage: string) {
  // ... 现有代码
  
  // 检查是否是"开始自主练习"指令
  const taskAgent = new TaskAgent()
  if (taskAgent.recognizePracticeIntent(userMessage)) {
    // 调用 selfPracticeSkill
    const { selfPracticeSkill } = await import('@/skills/self-practice-skill')
    await selfPracticeSkill.startPractice()
    return
  }
  
  // 检查是否处于练习模式
  if (selfPracticeSkill.isActive()) {
    // 调用 selfPracticeSkill 处理答案
    await selfPracticeSkill.submitAnswer(userMessage)
    return
  }
  
  // ... 正常的聊天流程
}
```

### 步骤4：修改 selfPracticeSkill 与聊天界面集成

**目标**：selfPracticeSkill 通过 chatStore 显示题目和反馈

**修改文件**：`apps/web/src/skills/self-practice-skill.ts`

**修改方法**：

```typescript
export class SelfPracticeSkill {
  private session: PracticeSession | null = null
  private chatStore = useChatStore()  // ✅ 使用 chatStore

  async startPractice(exerciseIds?: string[]): Promise<void> {
    // ... 加载习题逻辑
    
    // 显示欢迎信息
    this.chatStore.addMessage({
      role: 'assistant',
      content: `你准备好了吗？我们现在开始了哦！🎉\n\n共有 ${exercises.length} 道题目。`
    })
    
    // 显示第一题
    await this.showCurrentQuestion()
  }

  private async showCurrentQuestion(): Promise<void> {
    if (!this.session) return
    
    const exercise = this.session.exercises[this.session.currentIndex]
    const questionNumber = this.session.currentIndex + 1
    
    let questionText = `**第 ${questionNumber} 题** (${exercise.type})\n\n`
    questionText += `${exercise.question}\n\n`
    
    if (exercise.type === '选择题' && exercise.options) {
      questionText += '选项：\n'
      exercise.options.forEach((option, index) => {
        questionText += `${String.fromCharCode(65 + index)}. ${option}\n`
      })
    }
    
    // ✅ 通过 chatStore 显示题目
    this.chatStore.addMessage({
      role: 'assistant',
      content: questionText
    })
  }

  async submitAnswer(answer: string): Promise<void> {
    if (!this.session) return
    
    const exercise = this.session.exercises[this.session.currentIndex]
    
    // 保存答案
    this.session.answers.set(exercise.id, answer)
    
    // 调用 LLM 判断答案
    const result = await this.evaluateAnswer(exercise, answer)
    
    // 保存结果
    this.session.results.set(exercise.id, result)
    
    // ✅ 通过 chatStore 显示反馈
    this.chatStore.addMessage({
      role: 'assistant',
      content: result.feedback
    })
    
    // 等待 1-2 秒后显示下一题
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // 移动到下一题
    this.session.currentIndex++
    
    if (this.session.currentIndex < this.session.exercises.length) {
      await this.showCurrentQuestion()
    } else {
      await this.finishPractice()
    }
  }

  private async finishPractice(): Promise<void> {
    if (!this.session) return
    
    this.session.endTime = new Date()
    
    // 统计结果
    const totalQuestions = this.session.exercises.length
    const correctCount = Array.from(this.session.results.values())
      .filter(r => r.isCorrect).length
    const wrongCount = totalQuestions - correctCount
    
    // 生成总结
    let summaryText = `你真棒，全部题目都完成啦！🎉\n\n`
    summaryText += `**成绩单**\n`
    summaryText += `- 总题数：${totalQuestions}\n`
    summaryText += `- 正确数：${correctCount}\n`
    summaryText += `- 错误数：${wrongCount}\n\n`
    
    if (wrongCount > 0) {
      summaryText += `这次你有 ${wrongCount} 题做错了：\n`
      
      const wrongExercises = this.session.exercises.filter((ex) => {
        const result = this.session.results.get(ex.id)
        return result && !result.isCorrect
      })
      
      wrongExercises.forEach((ex, index) => {
        const userAnswer = this.session.answers.get(ex.id)
        summaryText += `\n**第 ${index + 1} 题**：${ex.question.substring(0, 30)}...\n`
        summaryText += `你的答案：${userAnswer}\n`
        summaryText += `正确答案：${ex.answer}\n`
      })
      
      summaryText += `\n是否要我帮你找一些类似的题目来巩固一下呀？💪`
    } else {
      summaryText += `太棒了！你全部答对了！🌟\n`
      summaryText += `继续保持，你真是一个学习小能手！`
    }
    
    // ✅ 通过 chatStore 显示总结
    this.chatStore.addMessage({
      role: 'assistant',
      content: summaryText
    })
    
    // 清空会话
    this.session = null
  }
}
```

### 步骤5：修改 ChatArea.vue 显示练习进度（可选）

**目标**：在聊天界面顶部显示练习进度

**修改文件**：`apps/web/src/components/ChatArea.vue`

```vue
<template>
  <div class="chat-area flex flex-col h-full">
    <!-- 练习进度显示 -->
    <div v-if="isPracticeMode" class="practice-progress-bar">
      <div class="progress-info">
        <span>练习进度</span>
        <span>{{ practiceProgress.current }} / {{ practiceProgress.total }}</span>
      </div>
      <div class="progress-bar">
        <div 
          class="progress-fill"
          :style="{ width: `${(practiceProgress.current / practiceProgress.total) * 100}%` }"
        ></div>
      </div>
    </div>
    
    <!-- 聊天消息 -->
    <div ref="messagesContainer" class="messages-container flex-1 overflow-y-auto p-4">
      <!-- ... 现有代码 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { selfPracticeSkill } from '@/skills/self-practice-skill'

const isPracticeMode = computed(() => selfPracticeSkill.isActive())
const practiceProgress = computed(() => selfPracticeSkill.getCurrentProgress())
</script>
```

## 实施步骤

### 阶段1：修改 PracticePage.vue（0.5小时）

1. 修改 `startPractice` 函数
2. 跳转到聊天页面并发送"开始自主练习"指令

### 阶段2：修改 ChatStore（1小时）

1. 在 `sendMessage` 方法中添加练习指令识别
2. 添加练习模式状态检查
3. 调用 selfPracticeSkill 处理答案

### 阶段3：修改 selfPracticeSkill（1小时）

1. 使用 chatStore 显示题目和反馈
2. 优化反馈文案
3. 完善总结报告

### 阶段4：测试验证（1小时）

1. 测试启动练习
2. 测试答题流程
3. 测试总结报告

## 测试验证

### 测试用例1：启动练习

**步骤**：
1. 在 PracticePage.vue 点击"开始答题"按钮
2. 验证是否跳转到聊天页面
3. 验证是否发送"开始自主练习"指令
4. 验证是否显示欢迎信息和第一题

**预期结果**：
```
用户：开始自主练习
AI：你准备好了吗？我们现在开始了哦！🎉

共有 28 道题目。

**第 1 题** (口算题)

49 ÷ 7 =

请输入你的答案：
```

### 测试用例2：答题流程

**步骤**：
1. 在聊天输入框输入答案"7"
2. 验证是否显示反馈
3. 验证是否自动显示下一题

**预期结果**：
```
用户：7
AI：✅ 正确！太棒了！

**第 2 题** (口算题)

36 ÷ 6 =

请输入你的答案：
```

### 测试用例3：错误答案

**步骤**：
1. 输入错误答案"5"
2. 验证是否显示错误反馈
3. 验证是否显示正确答案

**预期结果**：
```
用户：5
AI：❌ 额...有点不对劲哦。

正确答案是 6。

让我们继续下一题吧！

**第 3 题** (口算题)

28 + 63 =

请输入你的答案：
```

### 测试用例4：完成总结

**步骤**：
1. 完成所有题目
2. 验证是否显示总结报告

**预期结果**：
```
AI：你真棒，全部题目都完成啦！🎉

**成绩单**
- 总题数：28
- 正确数：25
- 错误数：3

这次你有 3 题做错了：

**第 1 题**：49 ÷ 7 = ?
你的答案：8
正确答案：7

**第 2 题**：36 ÷ 6 = ?
你的答案：5
正确答案：6

**第 3 题**：28 + 63 = ?
你的答案：90
正确答案：91

是否要我帮你找一些类似的题目来巩固一下呀？💪
```

## 实施时间表

| 任务 | 预计时间 | 优先级 |
|------|---------|--------|
| 修改 PracticePage.vue | 0.5 小时 | 高 |
| 修改 ChatStore | 1 小时 | 高 |
| 修改 selfPracticeSkill | 1 小时 | 高 |
| 添加练习进度显示 | 0.5 小时 | 中 |
| 测试验证 | 1 小时 | 高 |
| **总计** | **4 小时** | - |

## 总结

**问题根源**：
1. PracticePage.vue 的"开始答题"按钮没有发送"开始自主练习"指令
2. ChatStore 没有识别"开始自主练习"指令
3. selfPracticeSkill 没有与聊天流程集成

**解决方案**：
1. 修改 PracticePage.vue，跳转到聊天页面并发送指令
2. 在 ChatStore 中识别练习指令并调用 selfPracticeSkill
3. selfPracticeSkill 通过 chatStore 显示题目和反馈

**修复难度**：中等

**影响范围**：仅影响自主练习功能

**预期效果**：用户可以在聊天界面完成整个练习流程，体验流畅自然
