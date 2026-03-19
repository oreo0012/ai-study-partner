# Tasks

## Phase 1: 基础架构与数据模型

- [x] Task 1: 设计并实现数据存储结构
  - [x] SubTask 1.1: 创建数据目录 `apps/web/public/data/`
  - [x] SubTask 1.2: 定义任务数据模型 `tasks.json` 结构
  - [x] SubTask 1.3: 定义习题数据模型 `exercises.json` 结构
  - [x] SubTask 1.4: 定义记忆数据模型 `memory.json` 结构
  - [x] SubTask 1.5: 创建初始数据文件模板

- [x] Task 2: 扩展TypeScript类型定义
  - [x] SubTask 2.1: 在 `config/types.ts` 中添加任务相关类型
  - [x] SubTask 2.2: 添加习题相关类型定义
  - [x] SubTask 2.3: 添加记忆系统相关类型定义
  - [x] SubTask 2.4: 添加Agent相关类型定义

- [x] Task 3: 实现数据访问服务
  - [x] SubTask 3.1: 创建 `services/data-service.ts` 文件
  - [x] SubTask 3.2: 实现任务数据的读取、保存、更新方法
  - [x] SubTask 3.3: 实现习题数据的读取、保存、更新方法
  - [x] SubTask 3.4: 实现记忆数据的读取、保存、更新方法
  - [x] SubTask 3.5: 实现数据备份功能

## Phase 2: 家长页面模块

- [x] Task 4: 创建家长页面基础结构
  - [x] SubTask 4.1: 创建 `pages/ParentPage.vue` 页面组件
  - [x] SubTask 4.2: 设计家长页面布局（任务管理区、习题上传区）
  - [x] SubTask 4.3: 实现简单的页面访问控制（可选密码验证）
  - [x] SubTask 4.4: 在 `router.ts` 中添加家长页面路由

- [x] Task 5: 实现任务创建功能
  - [x] SubTask 5.1: 创建 `components/TaskCreator.vue` 组件
  - [x] SubTask 5.2: 实现任务创建表单（名称、描述、类型、时间、日期）
  - [x] SubTask 5.3: 实现表单验证逻辑
  - [x] SubTask 5.4: 实现任务保存功能（调用数据服务）
  - [x] SubTask 5.5: 实现成功/失败提示

- [x] Task 6: 实现任务列表管理
  - [x] SubTask 6.1: 创建任务列表展示组件
  - [x] SubTask 6.2: 实现任务列表加载功能
  - [x] SubTask 6.3: 实现任务编辑功能
  - [x] SubTask 6.4: 实现任务删除功能（带二次确认）
  - [x] SubTask 6.5: 实现按日期筛选任务功能

- [x] Task 7: 实现习题上传与解析功能
  - [x] SubTask 7.1: 创建 `components/ExerciseUploader.vue` 组件
  - [x] SubTask 7.2: 实现文件选择和上传功能
  - [x] SubTask 7.3: 创建 `services/exercise-parser.ts` 解析服务
  - [x] SubTask 7.4: 实现文档结构识别算法（章节、题目、答案）
  - [x] SubTask 7.5: 实现题型自动识别（选择题、填空题、简答题）
  - [x] SubTask 7.6: 实现解析预览功能
  - [x] SubTask 7.7: 实现习题数据保存功能

## Phase 3: 儿童页面待办事项系统

- [x] Task 8: 创建任务状态管理
  - [x] SubTask 8.1: 创建 `stores/task.ts` Pinia Store
  - [x] SubTask 8.2: 定义任务状态（待完成、进行中、已完成）
  - [x] SubTask 8.3: 实现任务加载action
  - [x] SubTask 8.4: 实现任务状态更新action
  - [x] SubTask 8.5: 实现进度计算getters

- [x] Task 9: 创建待办事项列表组件
  - [x] SubTask 9.1: 创建 `components/TodoList.vue` 组件
  - [x] SubTask 9.2: 设计儿童友好的卡片式布局
  - [x] SubTask 9.3: 实现任务类型图标和颜色区分
  - [x] SubTask 9.4: 实现完成状态可视化
  - [x] SubTask 9.5: 实现任务排序（未完成优先）

- [x] Task 10: 实现进度可视化
  - [x] SubTask 10.1: 创建 `components/ProgressVisualization.vue` 组件
  - [x] SubTask 10.2: 实现整体进度条
  - [x] SubTask 10.3: 实现学习时长统计
  - [x] SubTask 10.4: 实现连续学习天数显示
  - [x] SubTask 10.5: 实现鼓励性文字生成

- [x] Task 11: 创建儿童任务页面
  - [x] SubTask 11.1: 创建 `pages/ChildTaskPage.vue` 页面组件
  - [x] SubTask 11.2: 集成TodoList和ProgressVisualization组件
  - [x] SubTask 11.3: 在 `router.ts` 中添加任务页面路由
  - [x] SubTask 11.4: 在HomePage中添加任务页面入口

## Phase 4: Agent驱动的任务管理

- [x] Task 12: 实现任务管理Agent
  - [x] SubTask 12.1: 创建 `services/task-agent.ts` 服务
  - [x] SubTask 12.2: 实现任务完成意图识别
  - [x] SubTask 12.3: 实现Agent主动询问任务完成状态
  - [x] SubTask 12.4: 实现任务状态自动更新逻辑
  - [x] SubTask 12.5: 实现鼓励性反馈生成

- [x] Task 13: 集成任务Agent到聊天系统
  - [x] SubTask 13.1: 在 `stores/chat.ts` 中集成任务Agent
  - [x] SubTask 13.2: 实现对话中的任务意图检测
  - [x] SubTask 13.3: 实现任务状态更新触发
  - [x] SubTask 13.4: 实现Agent任务相关回复生成

## Phase 5: 自主习题练习系统

- [x] Task 14: 创建习题练习页面
  - [x] SubTask 14.1: 创建 `pages/PracticePage.vue` 页面组件
  - [x] SubTask 14.2: 实现习题概览展示
  - [x] SubTask 14.3: 实现练习进度显示
  - [x] SubTask 14.4: 在 `router.ts` 中添加练习页面路由

- [x] Task 15: 创建习题练习组件
  - [x] SubTask 15.1: 创建 `components/ExercisePractice.vue` 组件
  - [x] SubTask 15.2: 实现选择题交互界面
  - [x] SubTask 15.3: 实现填空题交互界面
  - [x] SubTask 15.4: 实现简答题交互界面
  - [x] SubTask 15.5: 实现语音输入支持

- [x] Task 16: 实现习题批改Agent
  - [x] SubTask 16.1: 创建习题批改服务
  - [x] SubTask 16.2: 实现选择题自动批改
  - [x] SubTask 16.3: 实现填空题智能批改
  - [x] SubTask 16.4: 实现简答题LLM评估
  - [x] SubTask 16.5: 实现批改反馈生成

- [x] Task 17: 实现练习总结功能
  - [x] SubTask 17.1: 实现得分计算
  - [x] SubTask 17.2: 实现错题列表生成
  - [x] SubTask 17.3: 实现知识点分析
  - [x] SubTask 17.4: 实现学习建议生成
  - [x] SubTask 17.5: 实现语音播报总结

## Phase 6: 自主记忆系统

- [x] Task 18: 创建记忆状态管理
  - [x] SubTask 18.1: 创建 `stores/memory.ts` Pinia Store
  - [x] SubTask 18.2: 定义记忆数据结构
  - [x] SubTask 18.3: 实现记忆加载action
  - [x] SubTask 18.4: 实现记忆更新action
  - [x] SubTask 18.5: 实现记忆分析getters

- [x] Task 19: 实现对话总结机制
  - [x] SubTask 19.1: 创建 `services/memory.ts` 服务
  - [x] SubTask 19.2: 实现对话结束检测
  - [x] SubTask 19.3: 实现LLM调用生成摘要
  - [x] SubTask 19.4: 实现摘要数据结构化
  - [x] SubTask 19.5: 实现摘要自动保存

- [x] Task 20: 实现状态感知机制
  - [x] SubTask 20.1: 实现对话开始前记忆加载
  - [x] SubTask 20.2: 实现关键信息提取
  - [x] SubTask 20.3: 实现个性化问候生成
  - [x] SubTask 20.4: 实现主动提醒功能
  - [x] SubTask 20.5: 实现学习建议生成

- [x] Task 21: 集成记忆系统到聊天
  - [x] SubTask 21.1: 在 `stores/chat.ts` 中集成记忆服务
  - [x] SubTask 21.2: 实现系统提示词增强（注入记忆信息）
  - [x] SubTask 21.3: 实现对话结束触发总结
  - [x] SubTask 21.4: 实现记忆数据自动更新

## Phase 7: 测试与优化

- [x] Task 22: 功能测试
  - [x] SubTask 22.1: 测试家长页面任务创建流程
  - [x] SubTask 22.2: 测试习题上传与解析功能
  - [x] SubTask 22.3: 测试儿童待办事项展示
  - [x] SubTask 22.4: 测试Agent驱动任务管理
  - [x] SubTask 22.5: 测试习题练习流程
  - [x] SubTask 22.6: 测试记忆系统功能

- [x] Task 23: 用户体验优化
  - [x] SubTask 23.1: 优化儿童界面视觉效果
  - [x] SubTask 23.2: 优化语音交互流畅度
  - [x] SubTask 23.3: 优化Agent响应速度
  - [x] SubTask 23.4: 优化数据加载性能

- [ ] Task 24: 文档与部署
  - [ ] SubTask 24.1: 更新README文档
  - [ ] SubTask 24.2: 编写家长使用指南
  - [ ] SubTask 24.3: 编写儿童使用指南
  - [ ] SubTask 24.4: 更新部署文档

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 depends on Task 1, Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 3, Task 4
- Task 6 depends on Task 3, Task 5
- Task 7 depends on Task 3, Task 4
- Task 8 depends on Task 3
- Task 9 depends on Task 8
- Task 10 depends on Task 8
- Task 11 depends on Task 9, Task 10
- Task 12 depends on Task 8
- Task 13 depends on Task 12
- Task 14 depends on Task 3
- Task 15 depends on Task 14
- Task 16 depends on Task 15
- Task 17 depends on Task 16
- Task 18 depends on Task 3
- Task 19 depends on Task 18
- Task 20 depends on Task 18, Task 19
- Task 21 depends on Task 19, Task 20
- Task 22 depends on Task 6, Task 7, Task 11, Task 13, Task 17, Task 21
- Task 23 depends on Task 22
- Task 24 depends on Task 23
