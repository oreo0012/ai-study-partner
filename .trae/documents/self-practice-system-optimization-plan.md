# 自主练习系统优化方案

## 问题分析

### 1. 习题数据管理问题

**当前问题**：
- 本地存储数据显示有56道题目，可能是多次上传导致的累积
- `addExercises` 函数只是简单地追加新习题，没有去重机制
- 没有习题的生命周期管理
- 没有自动归档机制

**影响**：
- 习题数量不断累积，导致练习时间过长
- 重复习题浪费用户时间
- 数据冗余占用存储空间

### 2. 读题格式问题

**当前问题**：
- 答复文本显示 `**第 26/56 题**`，使用了Markdown的加粗语法 `**`
- TTS朗读时会读出"星号"或跳过，影响体验
- 格式不够简洁

**影响**：
- 语音朗读体验差
- 题目显示不够清晰

### 3. 答题反馈问题

**当前问题**：
- 当前反馈太详细："太棒了！🌟你算对了！ 76 - 23 + 17 = 70 你按照从左到右的顺序..."
- 正确答案的反馈应该简短鼓励

**影响**：
- 答题节奏慢
- 用户体验不够流畅

## 优化方案

### 任务一：习题数据管理优化

#### 1.1 建立习题唯一标识系统

**目标**：防止不同批次上传的相同习题重复存储

**实现方案**：

**步骤1：创建习题哈希函数**

**修改文件**：`apps/web/src/services/exercise-parser.ts`

```typescript
export function generateExerciseHash(exercise: Omit<Exercise, 'id'>): string {
  const content = `${exercise.type}|${exercise.question}|${exercise.answer || ''}`
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}
```

**步骤2：修改 addExercises 函数，添加去重逻辑**

**修改文件**：`apps/web/src/services/data-service.ts`

```typescript
export async function addExercises(exercises: Omit<Exercise, 'id'>[]): Promise<Exercise[]> {
  try {
    const exercisesData = await loadExercises()
    
    // 生成现有习题的哈希集合
    const existingHashes = new Set(
      exercisesData.exercises.map(e => e.hash || generateExerciseHash(e))
    )
    
    // 过滤掉重复的习题
    const uniqueExercises: Exercise[] = []
    for (const exercise of exercises) {
      const hash = generateExerciseHash(exercise)
      if (!existingHashes.has(hash)) {
        uniqueExercises.push({
          ...exercise,
          id: generateId(),
          hash,
          createdAt: getCurrentTimestamp(),
          status: 'pending' // pending, completed, archived
        })
        existingHashes.add(hash)
      }
    }
    
    if (uniqueExercises.length === 0) {
      console.log('No new exercises to add (all duplicates)')
      return []
    }
    
    exercisesData.exercises.push(...uniqueExercises)
    const success = await saveExercises(exercisesData)
    
    console.log(`Added ${uniqueExercises.length} new exercises (${exercises.length - uniqueExercises.length} duplicates skipped)`)
    
    return success ? uniqueExercises : []
  } catch (error) {
    console.error('Failed to add exercises:', error)
    return []
  }
}
```

#### 1.2 实现习题生命周期管理

**目标**：增加已完成习题的自动归档到本地记忆中的机制

**实现方案**：

**步骤1：扩展 Exercise 类型定义**

**修改文件**：`apps/web/src/config/types.ts`

```typescript
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
}
```

**步骤2：创建归档函数**

**修改文件**：`apps/web/src/services/data-service.ts`

```typescript
export async function archiveCompletedExercises(): Promise<void> {
  try {
    const exercisesData = await loadExercises()
    const memoryData = await loadMemory()
    
    // 找出已完成的习题
    const completedExercises = exercisesData.exercises.filter(
      e => e.status === 'completed'
    )
    
    if (completedExercises.length === 0) {
      return
    }
    
    // 添加到记忆中
    for (const exercise of completedExercises) {
      memoryData.exerciseRecords.push({
        exerciseId: exercise.id,
        type: exercise.type,
        question: exercise.question,
        userAnswer: exercise.userAnswer || '',
        correctAnswer: exercise.answer,
        isCorrect: exercise.isCorrect || false,
        completedAt: exercise.completedAt || getCurrentTimestamp()
      })
    }
    
    // 从习题列表中移除已归档的习题
    exercisesData.exercises = exercisesData.exercises.filter(
      e => e.status !== 'completed'
    )
    
    // 保存数据
    await saveExercises(exercisesData)
    await saveMemory(memoryData)
    
    console.log(`Archived ${completedExercises.length} completed exercises`)
  } catch (error) {
    console.error('Failed to archive exercises:', error)
  }
}
```

#### 1.3 添加过期习题的识别与清除功能

**目标**：清除非今日的任务，并归档到本地记忆中去

**实现方案**：

**步骤1：创建清理函数**

**修改文件**：`apps/web/src/services/data-service.ts`

```typescript
export async function cleanupExpiredExercises(): Promise<void> {
  try {
    const exercisesData = await loadExercises()
    const memoryData = await loadMemory()
    const today = new Date().toISOString().split('T')[0]
    
    // 找出过期的习题（非今日创建的）
    const expiredExercises = exercisesData.exercises.filter(e => {
      if (!e.createdAt) return false
      const createdDate = e.createdAt.split('T')[0]
      return createdDate !== today
    })
    
    if (expiredExercises.length === 0) {
      return
    }
    
    // 添加到记忆中（标记为过期）
    for (const exercise of expiredExercises) {
      memoryData.exerciseRecords.push({
        exerciseId: exercise.id,
        type: exercise.type,
        question: exercise.question,
        userAnswer: exercise.userAnswer || '',
        correctAnswer: exercise.answer,
        isCorrect: exercise.isCorrect || false,
        completedAt: exercise.completedAt || getCurrentTimestamp(),
        status: 'expired'
      })
    }
    
    // 从习题列表中移除过期的习题
    exercisesData.exercises = exercisesData.exercises.filter(e => {
      if (!e.createdAt) return true
      const createdDate = e.createdAt.split('T')[0]
      return createdDate === today
    })
    
    // 保存数据
    await saveExercises(exercisesData)
    await saveMemory(memoryData)
    
    console.log(`Cleaned up ${expiredExercises.length} expired exercises`)
  } catch (error) {
    console.error('Failed to cleanup exercises:', error)
  }
}
```

**步骤2：在应用启动时调用清理函数**

**修改文件**：`apps/web/src/main.ts`

```typescript
import { cleanupExpiredExercises, archiveCompletedExercises } from '@/services/data-service'

// ... 现有代码

onMounted(async () => {
  await cleanupExpiredExercises()
  await archiveCompletedExercises()
  // ... 其他初始化逻辑
})
```

### 任务二：读题格式与特殊符号处理

#### 2.1 移除Markdown特殊符号

**目标**：处理文本中出现的"**"特殊符号问题

**实现方案**：

**修改文件**：`apps/web/src/skills/self-practice-skill.ts`

**修改位置**：`showCurrentQuestion` 方法（第52-74行）

```typescript
private async showCurrentQuestion(): Promise<void> {
  if (!this.session) return
  
  const exercise = this.session.exercises[this.session.currentIndex]
  const questionNumber = this.session.currentIndex + 1
  const totalQuestions = this.session.exercises.length
  
  // ✅ 移除Markdown特殊符号，使用标准格式
  let questionText = `第 ${questionNumber} 题 (${exercise.type})\n\n`
  questionText += `${exercise.question}\n\n`
  
  if (exercise.type === '选择题' && exercise.options) {
    questionText += '选项：\n'
    exercise.options.forEach((option, index) => {
      questionText += `${String.fromCharCode(65 + index)}. ${option}\n`
    })
  }
  
  questionText += '\n请输入你的答案：'
  
  this.chatStore.addAssistantMessage(questionText)
  
  await this.chatStore.speakText(questionText)
}
```

#### 2.2 优化题目格式

**目标**：统一采用标准格式，精简冗余内容

**实现方案**：

**修改文件**：`apps/web/src/skills/self-practice-skill.ts`

**修改位置**：`showCurrentQuestion` 方法

```typescript
private async showCurrentQuestion(): Promise<void> {
  if (!this.session) return
  
  const exercise = this.session.exercises[this.session.currentIndex]
  const questionNumber = this.session.currentIndex + 1
  
  // ✅ 简洁格式：第X题，(题型) 题目内容
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
```

### 任务三：答题反馈机制优化

#### 3.1 优化正确答案的反馈

**目标**：将详细点评调整为简短鼓励语

**实现方案**：

**修改文件**：`apps/web/src/skills/self-practice-skill.ts`

**修改位置**：`evaluateAnswer` 方法（第104-126行）

```typescript
private async evaluateAnswer(
  exercise: Exercise, 
  userAnswer: string
): Promise<{ isCorrect: boolean; feedback: string }> {
  const prompt = this.buildEvaluationPrompt(exercise, userAnswer)
  
  try {
    const response = await this.chatStore.generateResponse(prompt)
    
    const isCorrect = response.includes('正确') || response.includes('✅')
    
    // ✅ 如果答案正确，使用简短鼓励语
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
    
    // 如果答案错误，保持详细点评
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
```

#### 3.2 修改 LLM 提示词

**目标**：确保错误答案的反馈保持详细

**实现方案**：

**修改文件**：`apps/web/src/skills/self-practice-skill.ts`

**修改位置**：`buildEvaluationPrompt` 方法（第128-152行）

```typescript
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
  
  // ✅ 只针对错误答案提供详细反馈
  prompt += `如果学生的答案错误，请：\n`
  prompt += `1. 温和地指出错误\n`
  prompt += `2. 给出正确答案\n`
  prompt += `3. 提供解题思路\n`
  prompt += `4. 反馈要简洁（不超过80字），适合小学生理解\n`
  prompt += `5. 使用中文回复\n\n`
  prompt += `请直接给出反馈，不要有其他内容。`
  
  return prompt
}
```

## 实施步骤

### 阶段1：习题数据管理优化（2小时）

1. 创建习题哈希函数
2. 修改 addExercises 函数，添加去重逻辑
3. 扩展 Exercise 类型定义
4. 创建归档函数
5. 创建清理函数
6. 在应用启动时调用清理和归档函数

### 阶段2：读题格式优化（1小时）

1. 移除Markdown特殊符号
2. 优化题目格式
3. 精简冗余内容

### 阶段3：答题反馈优化（1小时）

1. 优化正确答案的反馈
2. 修改 LLM 提示词
3. 测试验证

## 测试验证

### 测试用例1：习题去重

**步骤**：
1. 上传同一份试卷两次
2. 验证习题是否去重
3. 检查 localStorage 中的数据

**预期结果**：
- ✅ 第二次上传时识别为重复
- ✅ 习题数量不翻倍

### 测试用例2：习题归档

**步骤**：
1. 完成一些习题
2. 验证习题是否归档到记忆中
3. 检查 localStorage 中的数据

**预期结果**：
- ✅ 已完成的习题从列表中移除
- ✅ 已完成的习题添加到记忆中

### 测试用例3：过期清理

**步骤**：
1. 修改习题的创建日期为昨天
2. 重启应用
3. 验证过期习题是否清理

**预期结果**：
- ✅ 过期习题从列表中移除
- ✅ 过期习题添加到记忆中

### 测试用例4：读题格式

**步骤**：
1. 启动练习
2. 检查题目显示格式
3. 验证TTS朗读效果

**预期结果**：
- ✅ 格式为"第X题，(题型) 题目内容"
- ✅ 没有Markdown特殊符号
- ✅ TTS朗读流畅

### 测试用例5：答题反馈

**步骤**：
1. 提交正确答案
2. 验证反馈是否简短
3. 提交错误答案
4. 验证反馈是否详细

**预期结果**：
- ✅ 正确答案反馈简短
- ✅ 错误答案反馈详细

## 实施时间表

| 任务 | 预计时间 | 优先级 |
|------|---------|--------|
| 习题数据管理优化 | 2 小时 | 高 |
| 读题格式优化 | 1 小时 | 高 |
| 答题反馈优化 | 1 小时 | 中 |
| 测试验证 | 1 小时 | 高 |
| **总计** | **5 小时** | - |

## 总结

**优化内容**：
1. 建立习题唯一标识系统，防止重复存储
2. 实现习题生命周期管理，自动归档已完成的习题
3. 添加过期习题的识别与清除功能
4. 移除Markdown特殊符号，优化读题格式
5. 简化正确答案的反馈，保持错误答案的详细点评

**预期效果**：
- 习题数量不再累积
- 数据管理更加规范
- 用户体验更加流畅
- 答题节奏更快

**影响范围**：习题管理、练习流程、答题反馈

**风险**：低（主要是优化现有功能，不影响核心逻辑）
