# 短期记忆与长期记忆分离系统规格文档

## Why

当前V1.2版本的记忆系统将所有对话摘要存储在单一的 `memory.json` 文件中，缺乏对"当日聊天记录"和"历史总结记忆"的明确区分。用户需要：
1. 每次进入系统时能够加载当日完整的聊天记录（短期记忆）
2. 每日自动对昨日聊天记录进行智能总结，存入长期记忆，并清除昨日原始记录

这种分离机制可以优化记忆管理效率，确保AI能够快速访问当日上下文，同时保留历史关键信息。

## What Changes

### 新增功能模块

#### 短期记忆系统
- **当日聊天记录存储**：完整保存当日所有聊天消息，包括文本内容、时间戳、消息类型、交互上下文
- **自动加载机制**：用户每次进入系统时自动加载当日聊天记录
- **日期检测机制**：检测日期变更，触发记忆归档流程

#### 长期记忆系统
- **智能总结机制**：每日自动调用LLM对昨日聊天记录生成结构化总结
- **长期记忆存储**：持久化存储历史总结，支持按日期检索
- **记忆清理机制**：总结完成后自动清除昨日短期记忆

### 数据结构变更
- 新增 `shortTermMemory` 数据结构存储当日聊天记录
- 新增 `longTermMemory` 数据结构存储历史总结
- 修改现有 `MemoryData` 类型定义

### 技术架构调整
- 新增记忆归档服务 `services/memory-archive.ts`
- 新增短期记忆存储服务 `services/short-term-memory.ts`
- 新增长期记忆存储服务 `services/long-term-memory.ts`
- 修改 `stores/memory.ts` 支持双记忆系统
- 修改 `stores/chat.ts` 集成短期记忆加载

## Impact

### 新增文件
- `apps/web/src/services/short-term-memory.ts` - 短期记忆服务
- `apps/web/src/services/long-term-memory.ts` - 长期记忆服务
- `apps/web/src/services/memory-archive.ts` - 记忆归档服务
- `apps/web/public/data/short-term-memory.json` - 短期记忆数据文件
- `apps/web/public/data/long-term-memory.json` - 长期记忆数据文件

### 修改文件
- `apps/web/src/config/types.ts` - 添加短期/长期记忆类型定义
- `apps/web/src/services/data-service.ts` - 添加短期/长期记忆数据访问方法
- `apps/web/src/services/memory.ts` - 重构为记忆协调服务
- `apps/web/src/stores/memory.ts` - 支持双记忆系统管理
- `apps/web/src/stores/chat.ts` - 集成短期记忆加载和保存
- `apps/web/src/pages/HomePage.vue` - 添加记忆初始化逻辑

## ADDED Requirements

### Requirement: 短期记忆存储系统

系统应提供完整的当日聊天记录存储和管理功能。

#### Scenario: 存储当日聊天消息
- **WHEN** 用户与AI进行对话
- **THEN** 系统自动将每条消息保存到短期记忆存储
- **AND** 每条消息包含以下字段：
  - `id`: 唯一消息标识
  - `role`: 消息角色（user/assistant）
  - `content`: 消息文本内容
  - `timestamp`: 精确到毫秒的时间戳
  - `messageType`: 消息类型（text/voice/emotion）
  - `context`: 交互上下文（当前任务、情绪状态等）
- **AND** 消息按时间顺序排列

#### Scenario: 加载当日聊天记录
- **WHEN** 用户进入系统
- **THEN** 系统检测短期记忆文件中的日期
- **AND** 如果日期为今天，加载所有当日聊天记录
- **AND** 恢复聊天界面显示历史消息
- **AND** AI能够引用当日之前的对话内容

#### Scenario: 检测日期变更
- **WHEN** 用户进入系统
- **THEN** 系统比较短期记忆存储日期与当前日期
- **AND** 如果日期不同，触发记忆归档流程
- **AND** 如果日期相同，直接加载当日记忆

#### Scenario: 短期记忆数据结构
- **WHEN** 系统初始化短期记忆存储
- **THEN** 创建以下数据结构：
  ```json
  {
    "date": "2026-03-21",
    "userId": "child_001",
    "messages": [
      {
        "id": "msg_001",
        "role": "user",
        "content": "今天我想学数学",
        "timestamp": "2026-03-21T09:30:00.000Z",
        "messageType": "text",
        "context": {
          "currentTask": null,
          "emotion": "neutral"
        }
      }
    ],
    "metadata": {
      "totalMessages": 1,
      "sessionCount": 1,
      "lastSessionTime": "2026-03-21T09:30:00.000Z"
    },
    "createdAt": "2026-03-21T00:00:00.000Z",
    "lastUpdated": "2026-03-21T09:30:00.000Z"
  }
  ```

### Requirement: 长期记忆存储系统

系统应提供历史记忆总结的持久化存储和检索功能。

#### Scenario: 存储每日总结
- **WHEN** 记忆归档流程完成
- **THEN** 系统将生成的总结存入长期记忆存储
- **AND** 总结包含以下字段：
  - `date`: 总结日期
  - `summary`: AI生成的总结文本
  - `keyPoints`: 关键知识点列表
  - `emotion`: 当日情绪状态统计
  - `tasksCompleted`: 完成的任务列表
  - `studyDuration`: 学习时长（分钟）
  - `weakPoints`: 薄弱知识点
  - `achievements`: 当日成就
  - `learnedTopics`: 学习的知识点详情（含评估）

#### Scenario: 检索历史记忆
- **WHEN** AI需要引用历史记忆
- **THEN** 系统支持以下检索方式：
  - 按日期范围检索
  - 按关键词检索
  - 按知识点检索
- **AND** 返回相关的历史总结

#### Scenario: 长期记忆懒加载 - 知识点检索场景
- **WHEN** 用户提问学习相关问题（如"进一法是什么"、"乘法怎么做"）
- **THEN** 系统检测问题中的知识点关键词
- **AND** 懒加载长期记忆数据
- **AND** 检索与该知识点相关的历史总结
- **AND** 提取该知识点的学习记录和评估结果
- **AND** 将相关信息注入AI上下文
- **AND** AI能够基于之前的教学内容做出跟进（如"上次我们讲了进一法，你还记得吗？"）

#### Scenario: 长期记忆懒加载 - 记忆归档场景
- **WHEN** 系统检测到日期变更，触发记忆归档
- **THEN** 系统懒加载完整长期记忆数据
- **AND** 读取累计知识统计
- **AND** 将昨日总结存入长期记忆
- **AND** 更新累计知识统计（已掌握知识点、薄弱知识点、学习天数、学习时长）
- **AND** 保存更新后的长期记忆

#### Scenario: 知识点学习记录
- **WHEN** 用户学习某个知识点
- **THEN** 系统在长期记忆中记录该知识点：
  - `topic`: 知识点名称
  - `firstLearnedDate`: 首次学习日期
  - `lastReviewDate`: 最近复习日期
  - `masteryLevel`: 掌握程度（未掌握/初步理解/基本掌握/熟练掌握）
  - `practiceCount`: 练习次数
  - `correctRate`: 正确率
  - `relatedQuestions`: 相关问题列表
  - `notes`: 学习备注

#### Scenario: 学习效果评估
- **WHEN** 用户完成某个知识点的学习或练习
- **THEN** 系统评估学习效果：
  - 根据练习正确率更新掌握程度
  - 记录错误类型和频率
  - 识别薄弱环节
  - 生成复习建议
- **AND** 更新长期记忆中的知识点记录

#### Scenario: 长期记忆数据结构
- **WHEN** 系统初始化长期记忆存储
- **THEN** 创建以下数据结构：
  ```json
  {
    "userId": "child_001",
    "dailySummaries": [
      {
        "date": "2026-03-20",
        "summary": "今天小橙子学习了乘法口诀，掌握了2-5的乘法，对6-9的乘法还需练习。情绪整体开心，完成了数学练习任务。",
        "keyPoints": ["乘法口诀2-5", "乘法口诀6-9待加强"],
        "emotion": {
          "primary": "开心",
          "distribution": {
            "开心": 0.6,
            "困惑": 0.3,
            "平静": 0.1
          }
        },
        "tasksCompleted": ["数学练习"],
        "studyDuration": 45,
        "weakPoints": ["乘法口诀6-9"],
        "achievements": ["连续学习第7天"],
        "learnedTopics": [
          {
            "topic": "乘法口诀",
            "masteryLevel": "初步理解",
            "practiceCount": 5,
            "correctRate": 0.6
          }
        ]
      }
    ],
    "topicRecords": {
      "进一法": {
        "topic": "进一法",
        "firstLearnedDate": "2026-03-19",
        "lastReviewDate": "2026-03-20",
        "masteryLevel": "基本掌握",
        "practiceCount": 3,
        "correctRate": 0.8,
        "relatedQuestions": ["8块饼干分给3个小朋友", "10颗糖分给4个小朋友"],
        "notes": "理解了进一法的概念，能正确应用到实际问题"
      },
      "乘法口诀": {
        "topic": "乘法口诀",
        "firstLearnedDate": "2026-03-15",
        "lastReviewDate": "2026-03-20",
        "masteryLevel": "初步理解",
        "practiceCount": 15,
        "correctRate": 0.65,
        "relatedQuestions": ["2×3=?", "5×6=?"],
        "notes": "2-5的乘法掌握较好，6-9的乘法需要加强",
        "weakSubTopics": ["乘法口诀6-9"]
      }
    },
    "accumulatedKnowledge": {
      "masteredTopics": ["加法", "减法", "乘法口诀2-5", "进一法"],
      "weakTopics": ["乘法口诀6-9"],
      "totalStudyDays": 7,
      "totalStudyHours": 5.5
    },
    "createdAt": "2026-03-01T00:00:00.000Z",
    "lastUpdated": "2026-03-20T23:59:59.000Z"
  }
  ```

### Requirement: 记忆归档机制

系统应实现每日自动归档昨日短期记忆到长期记忆的功能。

#### Scenario: 触发记忆归档
- **WHEN** 系统检测到日期变更（用户进入系统时发现短期记忆日期为昨天或更早）
- **THEN** 系统自动触发记忆归档流程
- **AND** 显示归档进度提示（可选）

#### Scenario: 生成昨日总结
- **WHEN** 记忆归档流程启动
- **THEN** 系统读取昨日短期记忆中的所有聊天记录
- **AND** 调用LLM API生成结构化总结
- **AND** 总结提示词包含：
  - 对话内容概述
  - 关键知识点提取
  - 情绪状态分析
  - 任务完成情况
  - 薄弱环节识别
  - 学习建议

#### Scenario: 更新长期记忆
- **WHEN** 昨日总结生成完成
- **THEN** 系统将总结存入长期记忆存储
- **AND** 更新累计知识统计
- **AND** 更新薄弱知识点列表
- **AND** 更新学习天数和时长统计

#### Scenario: 清理短期记忆
- **WHEN** 长期记忆更新完成
- **THEN** 系统清除昨日短期记忆中的所有聊天记录
- **AND** 初始化今日短期记忆存储
- **AND** 设置日期为今天

#### Scenario: 归档失败处理
- **WHEN** 记忆归档过程中发生错误
- **THEN** 系统记录错误日志
- **AND** 保留昨日短期记忆数据（不删除）
- **AND** 下次进入时重试归档
- **AND** 通知用户归档失败（可选）

### Requirement: AI上下文增强

系统应在对话中自动注入记忆上下文，增强AI的个性化能力。

#### Scenario: 注入短期记忆上下文
- **WHEN** 用户开始新对话
- **THEN** 系统加载当日短期记忆
- **AND** 将当日历史对话作为上下文注入系统提示词
- **AND** AI能够引用当日之前的对话内容

#### Scenario: 注入长期记忆上下文
- **WHEN** 用户开始新对话
- **THEN** 系统加载长期记忆摘要
- **AND** 提取关键信息注入系统提示词：
  - 用户基本信息（姓名、年龄、年级）
  - 最近学习内容和薄弱点
  - 连续学习天数
  - 用户偏好
- **AND** AI生成个性化问候

#### Scenario: 个性化问候生成
- **WHEN** AI获取记忆信息后开始对话
- **THEN** AI根据记忆生成个性化问候：
  - "早上好呀小橙子！你已经连续学习7天了，真棒！"
  - "昨天我们学习了乘法口诀，今天要继续加油哦！"
  - "我注意到你乘法口诀6-9还需要练习，要不要今天再练一下？"

### Requirement: 存储容量管理

系统应管理存储容量，防止数据无限增长。

#### Scenario: 短期记忆容量限制
- **WHEN** 当日聊天记录超过限制
- **THEN** 系统保留最近500条消息
- **AND** 自动删除最早的消息
- **AND** 保留消息元数据用于统计

#### Scenario: 长期记忆容量限制
- **WHEN** 长期记忆存储超过限制
- **THEN** 系统保留最近90天的每日总结
- **AND** 自动删除更早的总结
- **AND** 保留累计知识统计

#### Scenario: 数据备份机制
- **WHEN** 记忆归档完成
- **THEN** 系统创建短期记忆和长期记忆的备份
- **AND** 备份文件命名格式：`memory_backup_YYYYMMDD_HHMMSS.json`
- **AND** 保留最近7天的备份文件

## MODIFIED Requirements

### Requirement: 记忆数据服务扩展

系统应扩展数据服务以支持短期和长期记忆的存储访问。

#### Scenario: 短期记忆数据访问
- **WHEN** 系统需要访问短期记忆数据
- **THEN** 提供以下方法：
  - `loadShortTermMemory()`: 加载短期记忆
  - `saveShortTermMemory(data)`: 保存短期记忆
  - `addMessageToShortTermMemory(message)`: 添加消息到短期记忆
  - `clearShortTermMemory()`: 清除短期记忆
  - `getShortTermMemoryDate()`: 获取短期记忆日期

#### Scenario: 长期记忆数据访问
- **WHEN** 系统需要访问长期记忆数据
- **THEN** 提供以下方法：
  - `loadLongTermMemory()`: 加载长期记忆
  - `saveLongTermMemory(data)`: 保存长期记忆
  - `addDailySummary(summary)`: 添加每日总结
  - `getDailySummaries(startDate, endDate)`: 获取日期范围内的总结
  - `updateAccumulatedKnowledge(updates)`: 更新累计知识

#### Scenario: 记忆归档服务
- **WHEN** 系统需要执行记忆归档
- **THEN** 提供以下方法：
  - `checkAndArchiveMemory()`: 检查并执行归档
  - `generateDailySummary(messages)`: 生成每日总结
  - `archiveShortTermMemory()`: 归档短期记忆

### Requirement: 聊天系统集成

系统应在聊天流程中集成短期记忆的自动保存和加载。

#### Scenario: 消息自动保存
- **WHEN** 用户发送消息或AI回复消息
- **THEN** 系统自动将消息保存到短期记忆
- **AND** 更新短期记忆的最后更新时间

#### Scenario: 页面加载时恢复聊天
- **WHEN** 用户刷新页面或重新进入
- **THEN** 系统自动加载当日聊天记录
- **AND** 恢复聊天界面显示
- **AND** 保持对话连续性

## REMOVED Requirements

无移除的需求。现有记忆系统功能将被重构为短期/长期记忆分离架构。

## Technical Implementation Notes

### 系统架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户界面层                                │
│  HomePage.vue / ChatArea.vue / ChatMessage.vue                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        状态管理层                                │
│  chat.ts (聊天状态)    memory.ts (记忆状态)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        服务层                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ short-term-      │  │ long-term-       │  │ memory-       │  │
│  │ memory.ts        │  │ memory.ts        │  │ archive.ts    │  │
│  │ (短期记忆服务)    │  │ (长期记忆服务)    │  │ (归档服务)    │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        数据访问层                                │
│  data-service.ts (localStorage / JSON文件)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        存储层                                    │
│  short-term-memory.json    long-term-memory.json                │
│  (短期记忆文件)             (长期记忆文件)                        │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流程

```
用户进入系统
    │
    ▼
检查短期记忆日期
    │
    ├── 日期为今天 → 加载当日聊天记录 → 恢复聊天界面
    │
    └── 日期为昨天或更早 → 执行记忆归档流程
                                │
                                ▼
                        读取昨日聊天记录
                                │
                                ▼
                        调用LLM生成总结
                                │
                                ▼
                        存入长期记忆
                                │
                                ▼
                        清除昨日短期记忆
                                │
                                ▼
                        初始化今日短期记忆
                                │
                                ▼
                        加载今日聊天记录（空）
```

### 存储方案

| 存储类型 | 存储位置 | 存储内容 | 容量限制 |
|---------|---------|---------|---------|
| 短期记忆 | localStorage + JSON文件 | 当日聊天记录 | 500条消息 |
| 长期记忆 | localStorage + JSON文件 | 历史每日总结 | 90天 |
| 备份 | localStorage | 记忆备份 | 7天 |

### API接口定义

#### 短期记忆服务接口

```typescript
interface ShortTermMemoryService {
  load(): Promise<ShortTermMemoryData>
  save(data: ShortTermMemoryData): Promise<boolean>
  addMessage(message: ChatMessage): Promise<boolean>
  clear(): Promise<boolean>
  getDate(): string | null
  isToday(): boolean
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  messageType: 'text' | 'voice' | 'emotion'
  context: MessageContext
}

interface MessageContext {
  currentTask?: string
  emotion?: string
  intent?: string
}
```

#### 长期记忆服务接口

```typescript
interface LongTermMemoryService {
  load(): Promise<LongTermMemoryData>
  save(data: LongTermMemoryData): Promise<boolean>
  addDailySummary(summary: DailySummary): Promise<boolean>
  getSummaries(startDate: string, endDate: string): Promise<DailySummary[]>
  updateAccumulatedKnowledge(updates: Partial<AccumulatedKnowledge>): Promise<boolean>
  
  // 知识点相关方法
  getTopicRecord(topic: string): Promise<TopicRecord | null>
  searchTopicsByKeyword(keyword: string): Promise<TopicRecord[]>
  updateTopicRecord(topic: string, updates: Partial<TopicRecord>): Promise<boolean>
  getWeakTopics(): Promise<TopicRecord[]>
  getMasteredTopics(): Promise<TopicRecord[]>
}

interface DailySummary {
  date: string
  summary: string
  keyPoints: string[]
  emotion: EmotionStats
  tasksCompleted: string[]
  studyDuration: number
  weakPoints: string[]
  achievements: string[]
  learnedTopics: LearnedTopic[]
}

interface LearnedTopic {
  topic: string
  masteryLevel: MasteryLevel
  practiceCount: number
  correctRate: number
}

interface TopicRecord {
  topic: string
  firstLearnedDate: string
  lastReviewDate: string
  masteryLevel: MasteryLevel
  practiceCount: number
  correctRate: number
  relatedQuestions: string[]
  notes: string
  weakSubTopics?: string[]
}

type MasteryLevel = '未掌握' | '初步理解' | '基本掌握' | '熟练掌握'
```

#### 知识点检索服务接口

```typescript
interface TopicSearchService {
  // 检测用户问题中的知识点
  detectTopicFromQuestion(question: string): Promise<string | null>
  
  // 检索知识点相关的历史记录
  searchTopicHistory(topic: string): Promise<TopicSearchResult>
  
  // 生成知识点上下文（注入AI提示词）
  buildTopicContext(topic: string, record: TopicRecord): string
}

interface TopicSearchResult {
  found: boolean
  record?: TopicRecord
  relatedSummaries: DailySummary[]
  suggestions: string[]
}
```

#### 记忆归档服务接口

```typescript
interface MemoryArchiveService {
  checkAndArchive(): Promise<ArchiveResult>
  generateSummary(messages: ChatMessage[]): Promise<DailySummary>
  archive(): Promise<boolean>
}

interface ArchiveResult {
  archived: boolean
  summary?: DailySummary
  error?: string
}
```

### 错误处理机制

| 错误类型 | 处理策略 |
|---------|---------|
| 存储读取失败 | 从备份恢复，若无备份则初始化新数据 |
| 存储写入失败 | 重试3次，失败后提示用户 |
| LLM总结失败 | 保留原始数据，下次重试 |
| 存储容量超限 | 自动清理最旧数据 |
| 数据格式错误 | 尝试修复，失败则从备份恢复 |

### 性能优化策略

1. **懒加载**：长期记忆仅在需要时加载
2. **增量保存**：消息增量保存，避免全量写入
3. **缓存机制**：内存缓存当日聊天记录
4. **异步处理**：归档流程异步执行，不阻塞用户操作
5. **批量操作**：消息批量保存，减少IO次数

### 测试用例设计

#### 单元测试

| 测试项 | 测试内容 |
|-------|---------|
| 短期记忆加载 | 验证正确加载当日聊天记录 |
| 短期记忆保存 | 验证消息正确保存 |
| 日期检测 | 验证日期变更检测逻辑 |
| 长期记忆存储 | 验证总结正确存储 |
| 归档流程 | 验证完整归档流程 |

#### 集成测试

| 测试项 | 测试内容 |
|-------|---------|
| 聊天集成 | 验证消息自动保存到短期记忆 |
| 页面刷新 | 验证聊天记录正确恢复 |
| 跨日归档 | 验证跨日归档完整流程 |
| AI上下文 | 验证记忆正确注入系统提示词 |

#### 端到端测试

| 测试场景 | 测试步骤 |
|---------|---------|
| 当日对话连续性 | 1. 开始对话 2. 刷新页面 3. 验证历史消息恢复 |
| 跨日记忆归档 | 1. 模拟昨日数据 2. 进入系统 3. 验证归档完成 4. 验证长期记忆更新 |
| AI个性化问候 | 1. 存在历史记忆 2. 开始新对话 3. 验证个性化问候内容 |
