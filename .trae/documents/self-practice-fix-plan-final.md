# 自主练习功能修复方案（最终版）

## 功能需求确认

### 用户期望的功能流程

1. **启动练习**：
   - 用户点击"开始答题"按钮
   - 跳转到聊天界面
   - 发送"开始自主练习"指令

2. **Agent 响应**：
   - Agent 收到指令后，调用 selfPracticeSkill
   - **使用 TTS 朗读欢迎语和第一题**：
     ```
     "你准备好了吗？我们现在开始了哦！
     第一题：49 ÷ 7 = ？"
     ```

3. **用户答题**：
   - 用户在聊天输入框发送答案
   - **调用 LLM 生成点评**：
     - 正确："正确！太棒了！"
     - 错误："额...有点不对劲哦，正确答案是7。"
   - **使用 TTS 朗读点评**
   - 自动显示并朗读下一题

4. **完成总结**：
   - 做完最后一题后，**LLM 生成总结报告**
   - **使用 TTS 朗读总结**：
     ```
     "你真棒，全部题目都完成啦~
     这次你有3题做错了，
     第一题......；
     第二题......，
     是否要我帮你找一些类似的题目来巩固一下呀？"
     ```

5. **全流程**：
   - 都在儿童聊天界面通过聊天模块完成
   - **每道题都真实请求 TTS 模型**
   - **每道题都真实请求 LLM 模型**

## 当前方案能否实现需求？

### ✅ TTS 集成情况

**当前实现**：
- [chat.ts](d:\AiPorject\AiStudyPartner\apps\web\src\stores\chat.ts#L86-L105) 中有 `speakText` 方法
- TTS 服务已初始化（第74-84行）
- 有 `ttsEnabled` 和 `isSpeaking` 状态管理

**问题**：
- ❌ selfPracticeSkill 中没有调用 TTS

**解决方案**：
- ✅ 在 selfPracticeSkill 中调用 `chatStore.speakText()`

### ⚠️ LLM 集成情况

**当前实现**：
- [self-practice-skill.ts](d:\AiPorject\AiStudyPartner\apps\web\src\skills\self-practice-skill.ts#L114) 中调用了 `chatStore.generateResponse(prompt)`

**问题**：
- ❌ chatStore 中没有 `generateResponse` 方法

**解决方案**：
- ✅ 在 chatStore 中添加 `generateResponse` 方法

## 修复方案

### 步骤1：在 chatStore 中添加 generateResponse 方法

**修改文件**：`apps/web/src/stores/chat.ts`

**添加位置**：第135行之后

```typescript
async function generateResponse(prompt: string): Promise<string> {
  const llmConfig = configStore.llmConfig
  if (!llmConfig) {
    throw new Error('LLM config not found')
  }
  
  try {
    const provider = createChatProvider(llmConfig)
    
    const response = await streamChat({
      model: llmConfig.model,
      provider,
      systemPrompt: '你是一位耐心、友好的小学老师，专门辅导小学生学习。',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      maxTokens: 500
    }, {
      signal: new AbortController().signal,
      onToken: () => {},
      onComplete: () => {}
    })
    
    return response
  } catch (error) {
    console.error('Failed to generate response:', error)
    throw error
  }
}

return {
  // ... 现有导出
  generateResponse
}
```

### 步骤2：修改 selfPracticeSkill 集成 TTS

**修改文件**：`apps/web/src/skills/self-practice-skill.ts`

**修改方法**：

#### 2.1 修改 startPractice 方法

```typescript
async startPractice(exerciseIds?: string[]): Promise<void> {
  // ... 加载习题逻辑
  
  // 显示欢迎信息
  const welcomeMessage = `你准备好了吗？我们现在开始了哦！🎉\n\n共有 ${exercises.length} 道题目。`
  
  this.chatStore.addMessage({
    role: 'assistant',
    content: welcomeMessage
  })
  
  // ✅ 使用 TTS 朗读欢迎信息
  await this.chatStore.speakText(welcomeMessage)
  
  // 显示第一题
  await this.showCurrentQuestion()
}
```

#### 2.2 修改 showCurrentQuestion 方法

```typescript
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
  
  // 通过 chatStore 显示题目
  this.chatStore.addMessage({
    role: 'assistant',
    content: questionText
  })
  
  // ✅ 使用 TTS 朗读题目
  await this.chatStore.speakText(questionText)
}
```

#### 2.3 修改 submitAnswer 方法

```typescript
async submitAnswer(answer: string): Promise<void> {
  if (!this.session) return
  
  const exercise = this.session.exercises[this.session.currentIndex]
  
  // 保存答案
  this.session.answers.set(exercise.id, answer)
  
  // ✅ 调用 LLM 判断答案（真实请求）
  const result = await this.evaluateAnswer(exercise, answer)
  
  // 保存结果
  this.session.results.set(exercise.id, result)
  
  // 通过 chatStore 显示反馈
  this.chatStore.addMessage({
    role: 'assistant',
    content: result.feedback
  })
  
  // ✅ 使用 TTS 朗读反馈（真实请求）
  await this.chatStore.speakText(result.feedback)
  
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
```

#### 2.4 修改 finishPractice 方法

```typescript
private async finishPractice(): Promise<void> {
  if (!this.session) return
  
  this.session.endTime = new Date()
  
  // 统计结果
  const totalQuestions = this.session.exercises.length
  const correctCount = Array.from(this.session.results.values())
    .filter(r => r.isCorrect).length
  const wrongCount = totalQuestions - correctCount
  
  // ✅ 调用 LLM 生成总结报告（真实请求）
  const summaryText = await this.generateSummaryWithLLM(totalQuestions, correctCount, wrongCount)
  
  // 通过 chatStore 显示总结
  this.chatStore.addMessage({
    role: 'assistant',
    content: summaryText
  })
  
  // ✅ 使用 TTS 朗读总结（真实请求）
  await this.chatStore.speakText(summaryText)
  
  // 清空会话
  this.session = null
}
```

#### 2.5 新增 generateSummaryWithLLM 方法

```typescript
private async generateSummaryWithLLM(
  totalQuestions: number,
  correctCount: number,
  wrongCount: number
): Promise<string> {
  const wrongExercises = this.session.exercises.filter((ex) => {
    const result = this.session.results.get(ex.id)
    return result && !result.isCorrect
  })
  
  // 构建 LLM 提示
  let prompt = `你是一位友好的小学老师，刚刚批改完学生的练习。\n\n`
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
  prompt += `1. 先表扬学生完成了所有题目\n`
  prompt += `2. 如果有错题，温和地指出错误\n`
  prompt += `3. 鼓励学生继续努力\n`
  prompt += `4. 如果有错题，询问是否需要类似的题目来巩固\n`
  prompt += `5. 语气要友好、亲切，像朋友一样\n`
  prompt += `6. 使用表情符号\n`
  prompt += `7. 不超过200字\n`
  
  try {
    const response = await this.chatStore.generateResponse(prompt)
    return response
  } catch (error) {
    console.error('Failed to generate summary:', error)
    
    // 降级方案：使用模板生成
    let summaryText = `你真棒，全部题目都完成啦！🎉\n\n`
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
```

### 步骤3：修改 PracticePage.vue

**修改文件**：`apps/web/src/pages/PracticePage.vue`

**修改位置**：第59-65行

```typescript
import { useRouter } from 'vue-router'
import { nextTick } from 'vue'
import { useChatStore } from '@/stores'

const router = useRouter()
const chatStore = useChatStore()

function startPractice() {
  if (exercises.value.length > 0) {
    // 跳转到聊天页面
    router.push('/')
    
    // 在下一个 tick 发送"开始自主练习"指令
    nextTick(() => {
      chatStore.sendMessage('开始自主练习')
    })
  }
}
```

### 步骤4：修改 ChatStore 识别练习指令

**修改文件**：`apps/web/src/stores/chat.ts`

**修改位置**：sendMessage 方法（第136行）

```typescript
async function sendMessage(userMessage: string): Promise<void> {
  if (isGenerating.value) return
  
  // ✅ 检查是否是"开始自主练习"指令
  if (isPracticeIntent(userMessage)) {
    const { selfPracticeSkill } = await import('@/skills/self-practice-skill')
    await selfPracticeSkill.startPractice()
    return
  }
  
  // ✅ 检查是否处于练习模式
  const { selfPracticeSkill } = await import('@/skills/self-practice-skill')
  if (selfPracticeSkill.isActive()) {
    await selfPracticeSkill.submitAnswer(userMessage)
    return
  }
  
  // ... 正常的聊天流程
}

function isPracticeIntent(message: string): boolean {
  const keywords = [
    '开始自主练习',
    '开始练习',
    '开始答题',
    '我要练习',
    '做题目'
  ]
  
  return keywords.some(keyword => message.includes(keyword))
}
```

## 技术可行性分析

### ✅ TTS 集成

**当前支持**：
- ✅ TTS 服务已初始化
- ✅ `speakText` 方法可用
- ✅ 支持火山引擎 TTS

**需要添加**：
- ✅ 在 selfPracticeSkill 中调用 `chatStore.speakText()`

**实现难度**：低

### ✅ LLM 集成

**当前支持**：
- ✅ LLM 服务已初始化
- ✅ `streamChat` 方法可用
- ✅ 支持多种 LLM 提供商

**需要添加**：
- ✅ 在 chatStore 中添加 `generateResponse` 方法

**实现难度**：低

### ✅ 完整流程

**实现步骤**：
1. 用户点击"开始答题" → 跳转到聊天页面 → 发送"开始自主练习"指令
2. ChatStore 识别指令 → 调用 selfPracticeSkill.startPractice()
3. selfPracticeSkill 加载题目 → 显示欢迎信息 → **TTS 朗读**
4. 显示第一题 → **TTS 朗读**
5. 用户发送答案 → ChatStore 检测练习模式 → 调用 selfPracticeSkill.submitAnswer()
6. selfPracticeSkill 调用 **LLM 生成反馈** → 显示反馈 → **TTS 朗读**
7. 显示下一题 → **TTS 朗读**
8. 完成所有题目 → **LLM 生成总结** → **TTS 朗读**

**实现难度**：中等

## 性能和成本考虑

### TTS 调用次数

**每道题的 TTS 调用**：
1. 朗读题目（1次）
2. 朗读反馈（1次）

**总调用次数**：
- 28道题目 × 2次 = 56次 TTS 调用
- 欢迎语（1次）
- 总结报告（1次）
- **总计：58次 TTS 调用**

### LLM 调用次数

**每道题的 LLM 调用**：
1. 生成反馈（1次）

**总调用次数**：
- 28道题目 × 1次 = 28次 LLM 调用
- 总结报告（1次）
- **总计：29次 LLM 调用**

### 成本估算

**TTS 成本**（火山引擎）：
- 假设每段文本平均50字
- 58次 × 50字 = 2900字
- 火山引擎 TTS：约0.002元/千字
- **总成本：约0.006元**

**LLM 成本**（DeepSeek）：
- 假设每次调用平均500 tokens
- 29次 × 500 tokens = 14500 tokens
- DeepSeek：约0.001元/千tokens
- **总成本：约0.015元**

**单次练习总成本**：约0.021元（不到3分钱）

## 测试验证

### 测试用例1：TTS 朗读

**步骤**：
1. 启动练习
2. 验证是否朗读欢迎语
3. 验证是否朗读第一题

**预期结果**：
- ✅ 听到欢迎语
- ✅ 听到第一题内容

### 测试用例2：LLM 生成反馈

**步骤**：
1. 提交答案
2. 验证是否调用 LLM
3. 验证反馈内容是否个性化

**预期结果**：
- ✅ LLM 被调用
- ✅ 反馈内容个性化
- ✅ 反馈内容友好

### 测试用例3：完整流程

**步骤**：
1. 完成所有题目
2. 验证总结报告是否由 LLM 生成

**预期结果**：
- ✅ 总结报告个性化
- ✅ 包含错题分析
- ✅ 包含学习建议

## 实施时间表

| 任务 | 预计时间 | 优先级 |
|------|---------|--------|
| 添加 generateResponse 方法 | 0.5 小时 | 高 |
| 修改 selfPracticeSkill 集成 TTS | 1 小时 | 高 |
| 修改 selfPracticeSkill 集成 LLM | 1 小时 | 高 |
| 修改 PracticePage.vue | 0.5 小时 | 高 |
| 修改 ChatStore 识别指令 | 0.5 小时 | 高 |
| 测试验证 | 1 小时 | 高 |
| **总计** | **4.5 小时** | - |

## 总结

### ✅ 当前方案能够实现需求

**TTS 集成**：
- ✅ TTS 服务已就绪
- ✅ 只需在 selfPracticeSkill 中调用

**LLM 集成**：
- ✅ LLM 服务已就绪
- ✅ 只需添加 generateResponse 方法

**完整流程**：
- ✅ 每道题都真实请求 TTS 模型
- ✅ 每道题都真实请求 LLM 模型
- ✅ 用户体验友好、真实

### 实施建议

1. **优先级**：高（核心功能）
2. **实施难度**：中等
3. **成本**：低（每次练习不到3分钱）
4. **用户体验**：优秀（真实的对话体验）

### 下一步行动

立即开始实施修复，按照以下顺序：
1. 添加 generateResponse 方法
2. 修改 selfPracticeSkill 集成 TTS 和 LLM
3. 修改 PracticePage.vue 和 ChatStore
4. 测试验证
