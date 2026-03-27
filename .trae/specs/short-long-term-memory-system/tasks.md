# Tasks

## Phase 1: 数据模型与类型定义

- [x] Task 1: 扩展TypeScript类型定义
  - [x] SubTask 1.1: 在 `config/types.ts` 中定义 `ChatMessage` 类型（id, role, content, timestamp, messageType, context）
  - [x] SubTask 1.2: 定义 `MessageContext` 类型（currentTask, emotion, intent）
  - [x] SubTask 1.3: 定义 `ShortTermMemoryData` 类型（date, userId, messages, metadata, createdAt, lastUpdated）
  - [x] SubTask 1.4: 定义 `DailySummary` 类型（date, summary, keyPoints, emotion, tasksCompleted, studyDuration, weakPoints, achievements）
  - [x] SubTask 1.5: 定义 `EmotionStats` 类型（primary, distribution）
  - [x] SubTask 1.6: 定义 `AccumulatedKnowledge` 类型（masteredTopics, weakTopics, totalStudyDays, totalStudyHours）
  - [x] SubTask 1.7: 定义 `LongTermMemoryData` 类型（userId, dailySummaries, accumulatedKnowledge, createdAt, lastUpdated）
  - [x] SubTask 1.8: 定义 `ArchiveResult` 类型（archived, summary, error）

- [x] Task 2: 创建初始数据文件
  - [x] SubTask 2.1: 创建 `public/data/short-term-memory.json` 初始文件
  - [x] SubTask 2.2: 创建 `public/data/long-term-memory.json` 初始文件
  - [x] SubTask 2.3: 定义初始数据结构模板

## Phase 2: 数据访问层

- [x] Task 3: 扩展数据服务
  - [x] SubTask 3.1: 在 `services/data-service.ts` 中添加短期记忆存储键 `ai_study_short_term_memory`
  - [x] SubTask 3.2: 添加长期记忆存储键 `ai_study_long_term_memory`
  - [x] SubTask 3.3: 实现 `loadShortTermMemory()` 方法
  - [x] SubTask 3.4: 实现 `saveShortTermMemory(data)` 方法
  - [x] SubTask 3.5: 实现 `loadLongTermMemory()` 方法
  - [x] SubTask 3.6: 实现 `saveLongTermMemory(data)` 方法
  - [x] SubTask 3.7: 实现 `backupMemoryWithType(type)` 备份方法
  - [x] SubTask 3.8: 实现 `restoreMemoryFromBackup(type)` 恢复方法

## Phase 3: 短期记忆服务

- [x] Task 4: 创建短期记忆服务
  - [x] SubTask 4.1: 创建 `services/short-term-memory.ts` 文件
  - [x] SubTask 4.2: 实现 `load()` 方法 - 加载短期记忆数据
  - [x] SubTask 4.3: 实现 `save(data)` 方法 - 保存短期记忆数据
  - [x] SubTask 4.4: 实现 `addMessage(message)` 方法 - 添加消息到短期记忆
  - [x] SubTask 4.5: 实现 `clear()` 方法 - 清除短期记忆
  - [x] SubTask 4.6: 实现 `getDate()` 方法 - 获取短期记忆日期
  - [x] SubTask 4.7: 实现 `isToday()` 方法 - 判断是否为今日记忆
  - [x] SubTask 4.8: 实现 `getMessages()` 方法 - 获取所有消息
  - [x] SubTask 4.9: 实现 `initializeTodayMemory()` 方法 - 初始化今日记忆
  - [x] SubTask 4.10: 实现消息容量限制逻辑（最多500条）

## Phase 4: 长期记忆服务

- [x] Task 5: 创建长期记忆服务
  - [x] SubTask 5.1: 创建 `services/long-term-memory.ts` 文件
  - [x] SubTask 5.2: 实现 `load()` 方法 - 加载长期记忆数据
  - [x] SubTask 5.3: 实现 `save(data)` 方法 - 保存长期记忆数据
  - [x] SubTask 5.4: 实现 `addDailySummary(summary)` 方法 - 添加每日总结
  - [x] SubTask 5.5: 实现 `getSummaries(startDate, endDate)` 方法 - 按日期范围获取总结
  - [x] SubTask 5.6: 实现 `updateAccumulatedKnowledge(updates)` 方法 - 更新累计知识
  - [x] SubTask 5.7: 实现 `getRecentSummaries(count)` 方法 - 获取最近N天的总结
  - [x] SubTask 5.8: 实现 `getWeakTopics()` 方法 - 获取薄弱知识点
  - [x] SubTask 5.9: 实现总结容量限制逻辑（最多90天）
  - [x] SubTask 5.10: 实现 `getTotalStudyDays()` 方法 - 获取总学习天数

- [x] Task 5.5: 实现知识点记录服务
  - [x] SubTask 5.5.1: 在 `services/long-term-memory.ts` 中添加 `getTopicRecord(topic)` 方法
  - [x] SubTask 5.5.2: 实现 `searchTopicsByKeyword(keyword)` 方法 - 按关键词搜索知识点
  - [x] SubTask 5.5.3: 实现 `updateTopicRecord(topic, updates)` 方法 - 更新知识点记录
  - [x] SubTask 5.5.4: 实现 `getWeakTopics()` 方法 - 获取薄弱知识点列表
  - [x] SubTask 5.5.5: 实现 `getMasteredTopics()` 方法 - 获取已掌握知识点列表

- [x] Task 5.6: 创建知识点检索服务
  - [x] SubTask 5.6.1: 创建 `services/topic-search.ts` 文件
  - [x] SubTask 5.6.2: 实现 `detectTopicFromQuestion(question)` 方法 - 检测问题中的知识点
  - [x] SubTask 5.6.3: 实现 `searchTopicHistory(topic)` 方法 - 检索知识点历史
  - [x] SubTask 5.6.4: 实现 `buildTopicContext(topic, record)` 方法 - 生成知识点上下文
  - [x] SubTask 5.6.5: 实现知识点关键词映射表（数学、语文、英语等学科知识点）

## Phase 5: 记忆归档服务

- [x] Task 6: 创建记忆归档服务
  - [x] SubTask 6.1: 创建 `services/memory-archive.ts` 文件
  - [x] SubTask 6.2: 实现 `checkAndArchive()` 方法 - 检查并执行归档
  - [x] SubTask 6.3: 实现 `needsArchive()` 方法 - 判断是否需要归档
  - [x] SubTask 6.4: 实现 `generateSummary(messages)` 方法 - 调用LLM生成总结
  - [x] SubTask 6.5: 设计总结生成的系统提示词模板
  - [x] SubTask 6.6: 实现 `parseSummaryResponse(response)` 方法 - 解析LLM响应
  - [x] SubTask 6.7: 实现 `archive()` 方法 - 执行完整归档流程
  - [x] SubTask 6.8: 实现错误处理和重试逻辑
  - [x] SubTask 6.9: 实现归档状态记录（防止重复归档）

## Phase 6: 状态管理重构

- [x] Task 7: 重构记忆状态管理
  - [x] SubTask 7.1: 修改 `stores/memory.ts` 添加短期记忆状态
  - [x] SubTask 7.2: 添加长期记忆状态
  - [x] SubTask 7.3: 实现 `loadAllMemory()` 方法 - 加载所有记忆
  - [x] SubTask 7.4: 实现 `initializeMemory()` 方法 - 初始化记忆系统
  - [x] SubTask 7.5: 实现 `getTodayMessages()` getter - 获取当日消息
  - [x] SubTask 7.6: 实现 `getRecentSummaries()` getter - 获取最近总结
  - [x] SubTask 7.7: 实现 `getPersonalizedGreeting()` 方法 - 生成个性化问候
  - [x] SubTask 7.8: 实现 `getContextForLLM()` 方法 - 生成LLM上下文

- [x] Task 8: 集成聊天状态管理
  - [x] SubTask 8.1: 修改 `stores/chat.ts` 添加短期记忆集成
  - [x] SubTask 8.2: 实现 `loadTodayChatHistory()` 方法 - 加载当日聊天历史
  - [x] SubTask 8.3: 实现 `saveMessageToShortTermMemory()` 方法 - 保存消息到短期记忆
  - [x] SubTask 8.4: 修改消息发送逻辑，自动保存到短期记忆
  - [x] SubTask 8.5: 修改消息接收逻辑，自动保存AI回复
  - [x] SubTask 8.6: 实现页面刷新时恢复聊天记录

## Phase 7: 页面集成

- [x] Task 9: 修改主页集成记忆系统
  - [x] SubTask 9.1: 修改 `pages/HomePage.vue` 添加记忆初始化逻辑
  - [x] SubTask 9.2: 在 `onMounted` 中调用记忆初始化
  - [x] SubTask 9.3: 实现记忆归档进度提示（可选）
  - [x] SubTask 9.4: 实现聊天记录恢复显示
  - [x] SubTask 9.5: 实现个性化问候显示

- [x] Task 10: 修改聊天组件
  - [x] SubTask 10.1: 修改 `components/ChatArea.vue` 支持历史消息显示
  - [x] SubTask 10.2: 修改 `components/ChatMessage.vue` 支持消息上下文显示
  - [x] SubTask 10.3: 实现消息滚动到最新位置

## Phase 8: AI上下文增强

- [x] Task 11: 实现AI上下文注入
  - [x] SubTask 11.1: 创建 `services/memory-context.ts` 文件
  - [x] SubTask 11.2: 实现 `buildSystemPromptWithMemory()` 方法 - 构建包含记忆的系统提示词
  - [x] SubTask 11.3: 实现 `formatShortTermMemoryContext()` 方法 - 格式化短期记忆上下文
  - [x] SubTask 11.4: 实现 `formatLongTermMemoryContext()` 方法 - 格式化长期记忆上下文
  - [x] SubTask 11.5: 实现 `generatePersonalizedGreeting()` 方法 - 生成个性化问候
  - [x] SubTask 11.6: 修改LLM调用逻辑，注入记忆上下文

## Phase 9: 测试与验证

- [ ] Task 12: 单元测试
  - [ ] SubTask 12.1: 测试短期记忆服务的加载和保存
  - [ ] SubTask 12.2: 测试长期记忆服务的存储和检索
  - [ ] SubTask 12.3: 测试日期检测逻辑
  - [ ] SubTask 12.4: 测试记忆归档流程
  - [ ] SubTask 12.5: 测试容量限制逻辑

- [ ] Task 13: 集成测试
  - [ ] SubTask 13.1: 测试聊天消息自动保存
  - [ ] SubTask 13.2: 测试页面刷新后聊天记录恢复
  - [ ] SubTask 13.3: 测试跨日记忆归档完整流程
  - [ ] SubTask 13.4: 测试AI个性化问候生成
  - [ ] SubTask 13.5: 测试记忆上下文注入

- [ ] Task 14: 端到端测试
  - [ ] SubTask 14.1: 测试当日对话连续性场景
  - [ ] SubTask 14.2: 测试跨日记忆归档场景
  - [ ] SubTask 14.3: 测试AI个性化问候场景
  - [ ] SubTask 14.4: 测试存储容量管理场景
  - [ ] SubTask 14.5: 测试错误恢复场景

## Phase 10: 文档与优化

- [ ] Task 15: 更新文档
  - [ ] SubTask 15.1: 更新README中的记忆系统说明
  - [ ] SubTask 15.2: 编写记忆系统架构文档
  - [ ] SubTask 15.3: 编写API使用说明

- [ ] Task 16: 性能优化
  - [ ] SubTask 16.1: 实现短期记忆内存缓存
  - [ ] SubTask 16.2: 实现长期记忆懒加载
  - [ ] SubTask 16.3: 实现消息增量保存
  - [ ] SubTask 16.4: 优化归档流程异步执行

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 depends on Task 1, Task 2
- Task 4 depends on Task 1, Task 3
- Task 5 depends on Task 1, Task 3
- Task 6 depends on Task 4, Task 5
- Task 7 depends on Task 4, Task 5, Task 6
- Task 8 depends on Task 7
- Task 9 depends on Task 7, Task 8
- Task 10 depends on Task 8
- Task 11 depends on Task 7
- Task 12 depends on Task 4, Task 5, Task 6
- Task 13 depends on Task 8, Task 9, Task 11
- Task 14 depends on Task 13
- Task 15 depends on Task 14
- Task 16 depends on Task 14
