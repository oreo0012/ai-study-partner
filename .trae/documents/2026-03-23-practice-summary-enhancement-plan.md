# 长期记忆总结功能增强计划：自主练习结果总结与数据结构优化

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 
1. 在提示词模板中增加专门用于总结自主练习结果的内容模块
2. 优化长期记忆数据结构，完整记录并结构化存储自主练习结果
3. 修复 DailyLearningReport 组件未调用 LLM 的问题（方案A）

**架构：** 扩展现有类型定义，增强提示词模板，确保数据向后兼容

**技术栈：** Vue 3 + TypeScript + Pinia + localStorage

---

## 一、问题分析

### 1.1 当前问题

**问题1：DailyLearningReport 未调用 LLM**
- [DailyLearningReport.vue:97](file:///d:/AiPorject/AiStudyPartner/apps/web/src/components/DailyLearningReport.vue#L97) 调用 `generateSummary(messages)` 时未传入 `llmCallFn` 参数
- 导致直接返回 `createDefaultSummary()`，输出简单的默认总结

**问题2：提示词模板缺少自主练习总结模块**
- 当前提示词（memory-archive.ts:19-33）只关注学习对话记录
- 没有专门处理自主练习结果（如练习目标、完成情况、关键发现、改进建议）

**问题3：长期记忆数据结构不支持练习结果存储**
- `DailySummary` 接口缺少练习结果字段
- 自主练习数据（练习类型、时间戳、完成度、评估指标、关联知识点）无法结构化存储

### 1.2 现有自主练习数据

从 `self-practice-skill.ts` 可知，练习会话包含：
```typescript
interface PracticeSession {
  exercises: Exercise[]           // 练习题目
  currentIndex: number            // 当前索引
  answers: Map<string, string>    // 用户答案
  results: Map<string, { isCorrect: boolean; feedback: string }>  // 评估结果
  startTime: Date                 // 开始时间
  endTime?: Date                  // 结束时间
}
```

当前 `savePracticeRecord` 只保存了简单记录：
```typescript
{
  date: string,
  score: number,
  total: number,
  weakPoints: string[]  // 只保存了题型，不够详细
}
```

---

## 二、数据结构设计

### 2.1 新增类型定义

在 `types.ts` 中新增以下类型：

```typescript
// 练习类型枚举
export type PracticeType = '选择题' | '填空题' | '简答题' | '口算题' | '竖式计算题' | '应用题' | '混合练习'

// 单题练习结果
export interface PracticeQuestionResult {
  exerciseId: string              // 题目ID
  questionType: ExerciseType      // 题型
  question: string                // 题目内容
  userAnswer: string              // 用户答案
  correctAnswer: string           // 正确答案
  isCorrect: boolean              // 是否正确
  feedback?: string               // AI反馈
  relatedTopic?: string           // 关联知识点
  timeSpent?: number              // 答题耗时（秒）
}

// 练习会话总结
export interface PracticeSummary {
  sessionId: string               // 会话ID
  practiceType: PracticeType      // 练习类型
  startTime: string               // 开始时间（ISO格式）
  endTime: string                 // 结束时间（ISO格式）
  duration: number                // 总耗时（分钟）
  
  // 完成情况
  totalQuestions: number          // 总题数
  completedQuestions: number      // 完成题数
  correctCount: number            // 正确数
  wrongCount: number              // 错误数
  accuracy: number                // 正确率（0-1）
  
  // 评估指标
  performance: '优秀' | '良好' | '一般' | '需加强'  // 表现等级
  speedRating: '快速' | '适中' | '较慢'           // 速度评级
  
  // 详细结果
  questionResults: PracticeQuestionResult[]  // 各题结果
  
  // 知识点分析
  relatedTopics: string[]         // 涉及知识点
  masteredTopics: string[]        // 已掌握知识点
  weakTopics: string[]            // 薄弱知识点
  
  // AI 分析
  keyFindings: string[]           // 关键发现
  improvementSuggestions: string[] // 改进建议
  nextSteps: string[]             // 下一步建议
}
```

### 2.2 扩展 DailySummary 接口

```typescript
export interface DailySummary {
  date: string
  summary: string
  keyPoints: string[]
  emotion: EmotionStats
  tasksCompleted: string[]
  studyDuration: number
  weakPoints: string[]
  achievements: string[]
  learnedTopics: LearnedTopic[]
  
  // 新增：自主练习结果
  practiceSummaries?: PracticeSummary[]  // 当日练习总结列表
  totalPracticeCount?: number            // 当日练习总次数
  totalPracticeTime?: number             // 当日练习总时长（分钟）
  overallPracticeAccuracy?: number       // 当日练习整体正确率
}
```

### 2.3 数据兼容性保证

- 所有新增字段使用可选类型（`?`），确保旧数据兼容
- 解析旧数据时，缺失字段使用默认值
- `parseSummaryResponse` 方法增加对新字段的处理

---

## 三、提示词模板增强

### 3.1 新增练习总结专用提示词

在 `memory-archive.ts` 中新增：

```typescript
const PRACTICE_SUMMARY_PROMPT = `你是一个专业的学习分析助手，负责分析学生的自主练习结果并生成结构化的练习总结。

请根据提供的练习数据，生成一个JSON格式的练习总结，包含以下字段：

1. keyFindings: 关键发现数组，分析学生在本次练习中的表现特点
   - 识别学生的优势和薄弱环节
   - 发现答题模式或常见错误类型
   
2. improvementSuggestions: 改进建议数组，针对薄弱知识点提供具体建议
   - 建议要具体、可操作
   - 适合小学生理解
   
3. nextSteps: 下一步学习建议数组
   - 推荐复习的知识点
   - 建议练习的题型

分析要求：
- 客观分析，既肯定进步也指出不足
- 建议要具体、有针对性
- 语言简洁明了，适合家长阅读
- 关注学习方法和习惯的培养

请只返回JSON格式的数据，不要包含其他文字。`
```

### 3.2 增强主提示词模板

修改 `SUMMARY_SYSTEM_PROMPT`，增加对练习数据的处理：

```typescript
const SUMMARY_SYSTEM_PROMPT = `你是一个专业的学习分析助手，负责分析学生的学习对话记录和自主练习结果，生成结构化的学习总结。

请根据提供的数据，生成一个JSON格式的学习总结，包含以下字段：

【基础学习总结】
1. summary: 一段简洁的学习总结（100-200字），综合描述当日学习情况
2. keyPoints: 关键知识点列表（数组）
3. emotion: 情绪状态统计，包含primary（主要情绪）和distribution（情绪分布对象）
4. tasksCompleted: 完成的任务列表（数组）
5. studyDuration: 估计学习时长（分钟，数字）
6. weakPoints: 薄弱知识点列表（数组）
7. achievements: 当日成就列表（数组）
8. learnedTopics: 学习的知识点详情数组，每个包含topic、masteryLevel、practiceCount、correctRate

【自主练习总结】（如有练习数据）
9. practiceAnalysis: 练习分析对象，包含：
   - overallPerformance: 整体表现评价（优秀/良好/一般/需加强）
   - practiceHighlights: 练习亮点数组（答对的难题、进步的题型等）
   - areasToImprove: 需改进领域数组
   - practiceSuggestions: 练习建议数组

情绪类型包括：开心、困惑、平静、兴奋、沮丧、好奇、自信

请只返回JSON格式的数据，不要包含其他文字。`
```

### 3.3 构建包含练习数据的用户提示词

新增函数 `buildPracticeDataPrompt`：

```typescript
function buildPracticeDataPrompt(practiceSummaries: PracticeSummary[]): string {
  if (!practiceSummaries || practiceSummaries.length === 0) {
    return ''
  }
  
  let text = '\n\n【当日自主练习记录】\n'
  
  practiceSummaries.forEach((practice, index) => {
    text += `\n练习${index + 1}：${practice.practiceType}\n`
    text += `- 时间：${practice.startTime.split('T')[1].slice(0, 5)} - ${practice.endTime.split('T')[1].slice(0, 5)}\n`
    text += `- 时长：${practice.duration}分钟\n`
    text += `- 题目：${practice.totalQuestions}题\n`
    text += `- 成绩：${practice.correctCount}/${practice.totalQuestions}（正确率${Math.round(practice.accuracy * 100)}%）\n`
    text += `- 表现：${practice.performance}\n`
    
    if (practice.weakTopics.length > 0) {
      text += `- 薄弱知识点：${practice.weakTopics.join('、')}\n`
    }
    
    if (practice.keyFindings.length > 0) {
      text += `- 关键发现：${practice.keyFindings.join('；')}\n`
    }
  })
  
  return text
}
```

---

## 四、实施任务

### Task 1: 更新类型定义

**文件：** `apps/web/src/config/types.ts`

**操作：**
1. 在文件末尾（约270行后）新增类型定义：
   - `PracticeType` 类型
   - `PracticeQuestionResult` 接口
   - `PracticeSummary` 接口
2. 修改 `DailySummary` 接口，新增可选字段：
   - `practiceSummaries?: PracticeSummary[]`
   - `totalPracticeCount?: number`
   - `totalPracticeTime?: number`
   - `overallPracticeAccuracy?: number`

---

### Task 2: 增强提示词模板

**文件：** `apps/web/src/services/memory-archive.ts`

**操作：**
1. 新增 `PRACTICE_SUMMARY_PROMPT` 常量（约第34行后）
2. 新增 `buildPracticeDataPrompt` 函数
3. 修改 `SUMMARY_SYSTEM_PROMPT`，增加练习分析模块
4. 修改 `buildSummaryUserPrompt`，支持传入练习数据
5. 修改 `parseSummaryResponse`，处理新增字段

---

### Task 3: 修改自主练习技能保存完整数据

**文件：** `apps/web/src/skills/self-practice-skill.ts`

**操作：**
1. 修改 `savePracticeRecord` 方法，保存完整的 `PracticeSummary` 数据
2. 新增 `generatePracticeSummary` 方法，生成结构化练习总结
3. 将练习数据存储到短期记忆中（供后续总结使用）

---

### Task 4: 修改短期记忆服务支持练习数据

**文件：** `apps/web/src/services/short-term-memory.ts`

**操作：**
1. 扩展 `ShortTermMemoryData` 接口，新增 `practiceSummaries` 字段
2. 新增 `savePracticeSummary` 方法
3. 新增 `getPracticeSummaries` 方法

---

### Task 5: 修复 DailyLearningReport LLM 调用问题

**文件：** `apps/web/src/components/DailyLearningReport.vue`

**操作：**
1. 导入 `useConfigStore`、`createChatProvider`、`streamChat`
2. 创建 `callLLM` 函数
3. 修改 `handleSummarizeToday` 方法，传入 `llmCallFn` 参数
4. 添加配置检查和错误处理

**核心代码：**
```typescript
import { useConfigStore } from '@/stores/config'
import { createChatProvider, streamChat } from '@/services'

const configStore = useConfigStore()

const callLLM = async (systemPrompt: string, userPrompt: string): Promise<string> => {
  const llmConfig = configStore.llmConfig
  
  if (!llmConfig?.apiKey) {
    throw new Error('LLM配置未设置，请在设置页面配置API密钥')
  }
  
  const provider = createChatProvider(llmConfig)
  
  return new Promise((resolve, reject) => {
    let result = ''
    
    streamChat({
      model: llmConfig.model,
      provider,
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.7,
      maxTokens: 1024
    }, {
      onToken: (token) => { result += token },
      onComplete: () => resolve(result),
      onError: (err) => reject(err)
    })
  })
}

// 调用时传入 llmCallFn
const summary = await memoryArchiveService.generateSummary(messages, callLLM)
```

---

### Task 6: 更新长期记忆服务处理新字段

**文件：** `apps/web/src/services/long-term-memory.ts`

**操作：**
1. 确保 `addDailySummary` 方法正确处理新增的可选字段
2. 新增 `getPracticeSummariesByDateRange` 方法（可选）

---

### Task 7: 更新数据服务

**文件：** `apps/web/src/services/data-service.ts`

**操作：**
1. 新增 `savePracticeSummary` 函数
2. 新增 `getPracticeSummaries` 函数

---

### Task 8: 验证与测试

**操作：**
1. 运行 `npm run build` 检查编译
2. 运行 `npm run typecheck` 检查类型
3. 手动测试：
   - 进行一次自主练习
   - 在家长页面点击"总结当日"
   - 验证生成的总结包含练习分析内容

---

## 五、数据兼容性说明

### 5.1 向后兼容

- 所有新增字段均为可选类型
- 旧数据加载时，缺失字段使用默认值
- `parseSummaryResponse` 方法对新增字段使用空数组默认值

### 5.2 数据迁移

无需数据迁移，新字段为可选类型，旧数据可正常使用。

---

## 六、任务依赖关系

```
Task 1 (类型定义)
   ↓
Task 2 (提示词) ←── Task 3 (自主练习)
   ↓                    ↓
Task 4 (短期记忆) ←─────┘
   ↓
Task 5 (DailyLearningReport)
   ↓
Task 6 (长期记忆)
   ↓
Task 7 (数据服务)
   ↓
Task 8 (验证测试)
```

---

## 七、预期效果

### 7.1 总结输出示例

```json
{
  "date": "2026-03-23",
  "summary": "今日学习了2小时，完成了数学练习和语文阅读。在数学练习中表现良好，正确率达到85%，但在分数运算方面还需加强。",
  "keyPoints": ["分数加减法", "阅读理解", "作文结构"],
  "practiceAnalysis": {
    "overallPerformance": "良好",
    "practiceHighlights": ["口算速度提升", "应用题理解准确"],
    "areasToImprove": ["分数通分", "复杂应用题分析"],
    "practiceSuggestions": ["建议多做分数运算练习", "加强应用题读题训练"]
  },
  "practiceSummaries": [
    {
      "sessionId": "practice_20260323_001",
      "practiceType": "混合练习",
      "totalQuestions": 20,
      "correctCount": 17,
      "accuracy": 0.85,
      "performance": "良好",
      "weakTopics": ["分数运算"],
      "keyFindings": ["口算能力较强", "分数通分容易出错"],
      "improvementSuggestions": ["多做分数通分练习", "注意约分到最后"]
    }
  ],
  "totalPracticeCount": 1,
  "totalPracticeTime": 30,
  "overallPracticeAccuracy": 0.85
}
```

### 7.2 家长页面展示

在"每日学习汇报"模块中，将新增：
- 练习统计卡片（练习次数、总时长、平均正确率）
- 练习详情时间轴（每次练习的类型、成绩、薄弱点）
- AI 分析建议（基于练习数据的个性化建议）
