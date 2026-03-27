# AI学伴 - 儿童学习陪伴助手

一个基于 Vue 3 + TypeScript 的儿童学习陪伴应用。

## 功能特点

### 🎯 V1.2 新增功能

#### 家长管理端
- **每日学习任务布置**：家长可轻松创建、编辑、删除学习任务
- **自主习题上传**：支持上传.txt/.md格式习题文件，智能识别文档结构
- **任务类型管理**：支持学习、练习、阅读、其他四种任务类型
- **日期筛选**：按日期快速筛选和查看任务

#### 儿童学习端
- **待办事项系统**：自动生成今日学习任务清单，卡片式友好界面
- **进度可视化**：实时显示任务完成进度、学习时长、连续学习天数
- **Agent驱动任务管理**：AI主动询问任务完成情况，给予鼓励反馈
- **习题练习模式**：支持选择题、填空题、简答题三种题型

#### 自主记忆系统
- **对话内容总结**：对话结束自动生成结构化摘要
- **学习进度追踪**：记录任务完成情况、练习成绩、薄弱知识点
- **个性化问候**：AI根据记忆信息生成个性化问候和建议
- **智能提醒**：主动提醒未完成任务和需要加强的知识点

## 项目结构

```
ai-study-partner/
├── apps/
│   └── web/                 # Web 应用
│       ├── public/
│       │   └── data/        # 数据存储（tasks.json, exercises.json, memory.json）
│       └── src/
│           ├── pages/       # 页面组件
│           │   ├── HomePage.vue      # 儿童主页
│           │   ├── ParentPage.vue    # 家长管理页
│           │   ├── ChildTaskPage.vue # 儿童任务页
│           │   └── PracticePage.vue  # 习题练习页
│           ├── components/   # 通用组件
│           ├── services/     # 服务层
│           └── stores/      # 状态管理
├── packages/
│   ├── stage-ui/            # UI 组件库
│   ├── stage-ui-live2d/     # Live2D 组件
│   ├── stage-shared/        # 共享工具
│   ├── i18n/                # 国际化
│   └── audio/               # 音频处理
└── package.json
```

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 构建

```bash
pnpm build
```

## 技术栈

- Vue 3
- TypeScript
- Vite
- Pinia (状态管理)
- Vue Router (路由)
- UnoCSS (原子化CSS)
