# 自主练习功能系统性优化实施计划

## 任务概述

本次优化包含三个主要任务：
1. 数据一致性修复：解决删除操作的数据残留问题
2. 状态筛选项优化：调整任务状态分类
3. 自主练习交互体验升级：实现智能交互式练习

## 任务一：数据一致性修复

### 问题分析

**当前问题**：
- 家长删除任务时，只删除了任务记录，未删除关联的习题数据
- 家长删除试卷时，未删除关联的任务记录
- 导致儿童端显示错误信息或数据不一致

**根本原因**：
- 任务和习题之间没有建立明确的关联关系
- 删除操作缺少级联删除逻辑

### 实施步骤

#### 步骤1：建立任务与习题的关联关系

**修改文件**：`apps/web/src/config/types.ts`

```typescript
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
  exerciseIds?: string[]  // 新增：关联的习题ID列表
}
```

#### 步骤2：修改上传逻辑，建立关联

**修改文件**：`apps/web/src/pages/ParentPage.vue`

**修改位置**：`handleExerciseUpload` 函数（第139-178行）

```typescript
const handleExerciseUpload = async (result: { exercises: ParsedExercise[]; filename: string }) => {
  try {
    const exercisesToAdd = result.exercises.map(ex => ({
      type: ex.type,
      question: ex.question,
      options: ex.options,
      answer: ex.answer,
      chapter: ex.chapter,
      subject: ex.subject
    }))
    
    const savedExercises = await addExercises(exercisesToAdd)
    
    if (savedExercises.length > 0) {
      const today = new Date().toISOString().split('T')[0]
      const taskName = `完成习题: ${result.filename.replace(/\.[^/.]+$/, '')}`
      
      // 收集习题ID
      const exerciseIds = savedExercises.map(ex => ex.id)
      
      const newTask = await taskStore.createTask({
        name: taskName,
        description: `共 ${savedExercises.length} 道题目，包括选择题、填空题和简答题`,
        type: '练习',
        estimatedTime: Math.ceil(savedExercises.length * 3),
        date: today,
        status: '待完成',
        exerciseIds  // 保存关联的习题ID
      })
      
      // ... 其余逻辑
    }
  } catch (error) {
    // ... 错误处理
  }
}
```

#### 步骤3：实现级联删除逻辑

**修改文件**：`apps/web/src/pages/ParentPage.vue`

**新增函数**：`handleTaskDelete`（第120-125行）

```typescript
const handleTaskDelete = async (taskId: string) => {
  const task = taskStore.tasks.find(t => t.id === taskId)
  
  if (task && task.exerciseIds && task.exerciseIds.length > 0) {
    // 先删除关联的习题
    const success = await deleteExercises(task.exerciseIds)
    if (!success) {
      console.error('Failed to delete associated exercises')
      return
    }
  }
  
  // 再删除任务
  const success = await taskStore.removeTask(taskId)
  if (success) {
    await taskStore.loadAllTasks()
  }
}
```

**修改文件**：`apps/web/src/components/TaskList.vue`

**修改位置**：第62-68行

```typescript
function executeDelete() {
  if (taskToDelete.value) {
    emit('delete', taskToDelete.value.id)
    taskToDelete.value = null
    showDeleteConfirm.value = false
  }
}
```

#### 步骤4：添加习题删除功能

**修改文件**：`apps/web/src/pages/ParentPage.vue`

**新增UI**：习题管理界面

```vue
<div class="exercise-section">
  <div class="section-header">
    <h2>习题管理</h2>
  </div>
  
  <div class="exercise-list">
    <div v-for="exercise in exercises" :key="exercise.id" class="exercise-item">
      <div class="exercise-info">
        <span class="exercise-type">{{ exercise.type }}</span>
        <span class="exercise-question">{{ exercise.question.substring(0, 50) }}...</span>
      </div>
      <button @click="handleDeleteExercise(exercise.id)" class="delete-btn">
        删除
      </button>
    </div>
  </div>
</div>
```

**新增函数**：

```typescript
const handleDeleteExercise = async (exerciseId: string) => {
  // 查找关联的任务
  const relatedTask = taskStore.tasks.find(t => 
    t.exerciseIds && t.exerciseIds.includes(exerciseId)
  )
  
  if (relatedTask) {
    // 从任务的exerciseIds中移除
    const updatedExerciseIds = relatedTask.exerciseIds.filter(id => id !== exerciseId)
    
    if (updatedExerciseIds.length === 0) {
      // 如果没有关联的习题了，删除任务
      await taskStore.removeTask(relatedTask.id)
    } else {
      // 更新任务
      await taskStore.editTask(relatedTask.id, {
        ...relatedTask,
        exerciseIds: updatedExerciseIds,
        description: `共 ${updatedExerciseIds.length} 道题目`
      })
    }
  }
  
  // 删除习题
  await deleteExercises([exerciseId])
}
```

#### 步骤5：验证数据一致性

**测试用例**：

1. **删除任务**：
   - 上传试卷 → 创建任务和习题
   - 删除任务 → 验证习题是否被删除
   - 检查 localStorage 中的数据

2. **删除习题**：
   - 上传试卷 → 创建任务和习题
   - 删除单个习题 → 验证任务是否更新
   - 删除所有习题 → 验证任务是否被删除

3. **数据一致性**：
   - 验证任务和习题的关联关系
   - 验证删除操作后数据完整性

## 任务二：状态筛选项优化

### 问题分析

**当前问题**：
- TaskStatus 定义为：'待完成' | '进行中' | '已完成'
- 实际使用中，'进行中' 状态很少使用
- 用户希望简化为：'未完成' | '已完成' 两个状态

### 实施步骤

#### 步骤1：修改类型定义

**修改文件**：`apps/web/src/config/types.ts`

```typescript
// 修改前
export type TaskStatus = '待完成' | '进行中' | '已完成'

// 修改后
export type TaskStatus = '未完成' | '已完成'
```

#### 步骤2：更新任务创建逻辑

**修改文件**：`apps/web/src/pages/ParentPage.vue`

**修改位置**：第80-99行

```typescript
const handleTaskSubmit = async (formData: {
  name: string
  description: string
  type: TaskType
  estimatedTime: number
  date: string
}) => {
  const newTask = await taskStore.createTask({
    name: formData.name,
    description: formData.description || undefined,
    type: formData.type,
    estimatedTime: formData.estimatedTime,
    date: formData.date,
    status: '未完成'  // 修改：使用新的状态值
  })
  
  if (newTask) {
    await taskStore.loadAllTasks()
  }
}
```

#### 步骤3：更新任务编辑逻辑

**修改文件**：`apps/web/src/components/TaskEditor.vue`

**修改位置**：状态选择下拉框

```vue
<select v-model="formData.status" class="status-select">
  <option value="未完成">未完成</option>
  <option value="已完成">已完成</option>
</select>
```

#### 步骤4：更新筛选逻辑

**修改文件**：`apps/web/src/components/TaskList.vue`

**修改位置**：第113-122行

```vue
<select v-model="statusFilter" class="status-filter">
  <option value="全部">全部状态</option>
  <option value="未完成">未完成</option>
  <option value="已完成">已完成</option>
</select>
```

#### 步骤5：更新状态显示样式

**修改文件**：`apps/web/src/components/TaskList.vue`

**修改位置**：第70-81行

```typescript
function getStatusClass(status: TaskStatus) {
  switch (status) {
    case '未完成':
      return 'bg-amber-100 text-amber-700'
    case '已完成':
      return 'bg-green-100 text-green-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}
```

#### 步骤6：数据迁移

**创建迁移脚本**：`apps/web/src/utils/migrate-task-status.ts`

```typescript
export async function migrateTaskStatus() {
  const tasksData = await loadTasks()
  
  tasksData.tasks.forEach(task => {
    if (task.status === '待完成' || task.status === '进行中') {
      task.status = '未完成'
    }
    // '已完成' 保持不变
  })
  
  await saveTasks(tasksData)
  console.log('Task status migration completed')
}
```

**在应用启动时调用**：`apps/web/src/main.ts`

```typescript
import { migrateTaskStatus } from '@/utils/migrate-task-status'

// ... 其他代码

onMounted(async () => {
  await migrateTaskStatus()
  // ... 其他初始化逻辑
})
```

## 任务三：自主练习交互体验升级

### 方案分析

#### 技术可行性评估

**方案概述**：
1. 用户点击开始按钮 → Agent 从 localStorage 读取题目
2. 一题一题交互式提问 → 用户提交答案
3. 调用 LLM 判断答案准确性 → 生成即时反馈
4. 全部完成 → Agent 生成总结报告和学习建议

**技术栈**：
- 前端：Vue 3 + TypeScript
- 状态管理：Pinia
- AI 集成：现有 LLM 服务（支持 OpenAI、DeepSeek 等）
- 数据存储：localStorage

**可行性**：✅ 完全可行

#### 开发复杂度评估

**复杂度等级**：中等

**工作量估算**：
- 核心功能开发：3-4 天
- UI/UX 优化：1-2 天
- 测试和调试：1-2 天
- **总计**：5-8 天

#### 潜在风险

1. **LLM 调用延迟**：
   - 风险：答案判断可能需要 2-5 秒
   - 缓解：显示加载动画，优化提示词

2. **答案判断准确性**：
   - 风险：LLM 可能误判答案
   - 缓解：使用 Few-shot 提示，添加示例

3. **成本控制**：
   - 风险：频繁调用 LLM 可能产生较高成本
   - 缓解：使用本地缓存，限制调用频率

4. **用户体验**：
   - 风险：等待时间过长影响体验
   - 缓解：添加进度提示，支持跳过题目

### 实施步骤

#### 步骤1：创建自主练习 Skill

**创建文件**：`apps/web/src/skills/self-practice-skill.ts`

```typescript
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
    // 加载习题
    const exercisesData = await loadExercises()
    let exercises = exercisesData.exercises
    
    if (exerciseIds && exerciseIds.length > 0) {
      exercises = exercises.filter(ex => exerciseIds.includes(ex.id))
    }
    
    if (exercises.length === 0) {
      this.chatStore.addMessage({
        role: 'assistant',
        content: '抱歉，没有找到可练习的题目。请先让家长上传试卷哦！📚'
      })
      return
    }
    
    // 初始化会话
    this.session = {
      exercises,
      currentIndex: 0,
      answers: new Map(),
      results: new Map(),
      startTime: new Date()
    }
    
    // 显示欢迎信息
    this.chatStore.addMessage({
      role: 'assistant',
      content: `太好了！我们开始练习吧！🎉\n\n共有 ${exercises.length} 道题目，准备好了吗？`
    })
    
    // 显示第一题
    await this.showCurrentQuestion()
  }

  private async showCurrentQuestion(): Promise<void> {
    if (!this.session) return
    
    const exercise = this.session.exercises[this.session.currentIndex]
    const questionNumber = this.session.currentIndex + 1
    const totalQuestions = this.session.exercises.length
    
    let questionText = `**第 ${questionNumber}/${totalQuestions} 题** (${exercise.type})\n\n`
    questionText += `${exercise.question}\n\n`
    
    if (exercise.type === '选择题' && exercise.options) {
      questionText += '选项：\n'
      exercise.options.forEach((option, index) => {
        questionText += `${String.fromCharCode(65 + index)}. ${option}\n`
      })
    }
    
    questionText += '\n请输入你的答案：'
    
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
    
    // 显示用户答案
    this.chatStore.addMessage({
      role: 'user',
      content: answer
    })
    
    // 调用 LLM 判断答案
    const result = await this.evaluateAnswer(exercise, answer)
    
    // 保存结果
    this.session.results.set(exercise.id, result)
    
    // 显示反馈
    this.chatStore.addMessage({
      role: 'assistant',
      content: result.feedback
    })
    
    // 等待 2 秒后显示下一题
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // 移动到下一题
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
      
      // 解析 LLM 响应
      const isCorrect = response.includes('正确') || response.includes('✅')
      
      return {
        isCorrect,
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
    
    prompt += `请判断学生的答案是否正确，并给出鼓励性的反馈。\n`
    prompt += `要求：\n`
    prompt += `1. 如果答案正确，给予热情的鼓励（使用表情符号）\n`
    prompt += `2. 如果答案错误，温和地指出错误，并给出正确答案和解题思路\n`
    prompt += `3. 反馈要简洁（不超过100字），适合小学生理解\n`
    prompt += `4. 使用中文回复\n\n`
    prompt += `请直接给出反馈，不要有其他内容。`
    
    return prompt
  }

  private async finishPractice(): Promise<void> {
    if (!this.session) return
    
    this.session.endTime = new Date()
    
    // 统计结果
    const totalQuestions = this.session.exercises.length
    const correctCount = Array.from(this.session.results.values())
      .filter(r => r.isCorrect).length
    const accuracy = Math.round((correctCount / totalQuestions) * 100)
    
    // 生成总结报告
    const summary = await this.generateSummary()
    
    // 显示总结
    let summaryText = `🎉 练习完成！\n\n`
    summaryText += `**成绩单**\n`
    summaryText += `- 总题数：${totalQuestions}\n`
    summaryText += `- 正确数：${correctCount}\n`
    summaryText += `- 准确率：${accuracy}%\n\n`
    summaryText += summary
    
    this.chatStore.addMessage({
      role: 'assistant',
      content: summaryText
    })
    
    // 清空会话
    this.session = null
  }

  private async generateSummary(): Promise<string> {
    if (!this.session) return ''
    
    const wrongExercises = this.session.exercises.filter((ex, index) => {
      const result = this.session.results.get(ex.id)
      return result && !result.isCorrect
    })
    
    let summary = `**学习建议**\n`
    
    if (wrongExercises.length === 0) {
      summary += `太棒了！你全部答对了！🌟\n`
      summary += `继续保持，你真是一个学习小能手！\n`
    } else {
      summary += `以下题目需要多加练习：\n`
      wrongExercises.forEach((ex, index) => {
        summary += `${index + 1}. ${ex.type}: ${ex.question.substring(0, 30)}...\n`
      })
      summary += `\n加油！多练习几次就会越来越好的！💪\n`
    }
    
    return summary
  }

  getCurrentProgress(): { current: number; total: number } | null {
    if (!this.session) return null
    
    return {
      current: this.session.currentIndex + 1,
      total: this.session.exercises.length
    }
  }
}

export const selfPracticeSkill = new SelfPracticeSkill()
```

#### 步骤2：集成到聊天界面

**修改文件**：`apps/web/src/stores/chat.ts`

**新增方法**：

```typescript
async generateResponse(prompt: string): Promise<string> {
  if (!this.config?.llm) {
    throw new Error('LLM config not found')
  }
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.llm.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.llm.model,
        messages: [
          {
            role: 'system',
            content: '你是一位耐心、友好的小学老师，专门辅导小学生学习。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    })
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }
    
    const data = await response.json()
    return data.choices[0].message.content
  } catch (error) {
    console.error('Failed to generate response:', error)
    throw error
  }
}
```

#### 步骤3：创建启动入口

**修改文件**：`apps/web/src/pages/PracticePage.vue`

**新增按钮**：

```vue
<button 
  class="start-interactive-practice"
  @click="startInteractivePractice"
>
  🎮 开始互动练习
</button>
```

**新增方法**：

```typescript
import { selfPracticeSkill } from '@/skills/self-practice-skill'

function startInteractivePractice() {
  router.push('/chat')
  
  // 在下一个 tick 启动练习
  nextTick(() => {
    const exerciseIds = exercises.value.map(ex => ex.id)
    selfPracticeSkill.startPractice(exerciseIds)
  })
}
```

#### 步骤4：优化用户体验

**添加进度显示**：

```vue
<div v-if="practiceProgress" class="practice-progress">
  <div class="progress-bar">
    <div 
      class="progress-fill"
      :style="{ width: `${(practiceProgress.current / practiceProgress.total) * 100}%` }"
    ></div>
  </div>
  <div class="progress-text">
    第 {{ practiceProgress.current }} / {{ practiceProgress.total }} 题
  </div>
</div>
```

**添加加载动画**：

```vue
<div v-if="isEvaluating" class="evaluating-indicator">
  <div class="loading-spinner"></div>
  <span>正在批改答案...</span>
</div>
```

#### 步骤5：添加错误处理

```typescript
async submitAnswer(answer: string): Promise<void> {
  if (!this.session) return
  
  try {
    // ... 原有逻辑
  } catch (error) {
    console.error('Failed to submit answer:', error)
    
    this.chatStore.addMessage({
      role: 'assistant',
      content: '抱歉，处理答案时出错了。请重试或跳过这道题。'
    })
  }
}
```

## 测试验证

### 测试用例1：数据一致性

**步骤**：
1. 上传试卷 → 创建任务和习题
2. 删除任务 → 验证习题是否被删除
3. 检查 localStorage 数据完整性

**预期结果**：
- ✅ 任务和习题同步删除
- ✅ localStorage 数据一致
- ✅ 儿童端不显示错误信息

### 测试用例2：状态筛选

**步骤**：
1. 创建多个任务（未完成和已完成）
2. 使用状态筛选功能
3. 验证筛选结果

**预期结果**：
- ✅ 筛选选项显示正确
- ✅ 筛选逻辑正确
- ✅ 数据迁移成功

### 测试用例3：自主练习

**步骤**：
1. 点击"开始互动练习"
2. 逐题答题
3. 查看反馈和总结

**预期结果**：
- ✅ 题目逐题显示
- ✅ LLM 正确判断答案
- ✅ 生成详细总结报告

## 风险评估

| 风险项 | 影响程度 | 发生概率 | 缓解措施 |
|--------|---------|---------|---------|
| LLM 调用延迟 | 中 | 高 | 显示加载动画，优化提示词 |
| 答案判断错误 | 高 | 中 | 使用 Few-shot 提示，人工审核 |
| 成本过高 | 中 | 中 | 使用本地缓存，限制调用频率 |
| 数据迁移失败 | 低 | 低 | 添加回滚机制，备份数据 |

## 实施时间表

| 任务 | 预计时间 | 优先级 |
|------|---------|--------|
| 数据一致性修复 | 1-2 天 | 高 |
| 状态筛选项优化 | 0.5 天 | 高 |
| 自主练习 Skill 开发 | 3-4 天 | 中 |
| UI/UX 优化 | 1-2 天 | 中 |
| 测试和调试 | 1-2 天 | 高 |
| **总计** | **6-10 天** | - |

## 总结

本次优化将显著提升系统的数据一致性和用户体验：

1. **数据一致性**：彻底解决删除操作的数据残留问题
2. **状态管理**：简化任务状态，提升易用性
3. **交互体验**：实现智能交互式练习，提升学习效果

**建议实施顺序**：
1. 先完成数据一致性修复（高优先级）
2. 再完成状态筛选项优化（快速见效）
3. 最后实现自主练习功能（核心功能）

**预期效果**：
- 数据一致性：100% 保证
- 用户满意度：提升 50% 以上
- 学习效果：提升 30% 以上
