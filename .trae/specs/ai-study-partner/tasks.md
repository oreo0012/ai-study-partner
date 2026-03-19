# Tasks

## Phase 1: 项目初始化与基础架构

- [x] Task 1: 创建新项目目录结构
  - [x] SubTask 1.1: 在 `d:\AiPorject\AiStudyPartner` 下创建项目根目录结构
  - [x] SubTask 1.2: 复制AIRI的 `package.json`、`pnpm-workspace.yaml` 等配置文件并修改项目名称
  - [x] SubTask 1.3: 配置TypeScript、Vite、UnoCSS等构建工具

- [x] Task 2: 复用核心依赖包
  - [x] SubTask 2.1: 复制 `packages/stage-ui` 核心UI组件库
  - [x] SubTask 2.2: 复制 `packages/stage-ui-live2d` Live2D动画系统
  - [x] SubTask 2.3: 复制 `packages/i18n` 国际化支持
  - [x] SubTask 2.4: 复制 `packages/audio` 音频处理工具
  - [x] SubTask 2.5: 复制 `packages/stage-shared` 共享工具函数

- [x] Task 3: 创建Web应用入口
  - [x] SubTask 3.1: 创建 `apps/web` 目录结构
  - [x] SubTask 3.2: 创建 `index.html` 入口文件
  - [x] SubTask 3.3: 创建 `main.ts` 应用入口
  - [x] SubTask 3.4: 创建 `App.vue` 根组件
  - [x] SubTask 3.5: 配置Vite构建选项

- [x] Task 4: 实现配置文件系统
  - [x] SubTask 4.1: 定义配置文件TypeScript类型 (`src/config/types.ts`)
  - [x] SubTask 4.2: 创建默认配置文件模板 (`public/config.json`)
  - [x] SubTask 4.3: 实现配置加载器 (`src/config/loader.ts`)
  - [x] SubTask 4.4: 实现配置验证器 (`src/config/validator.ts`)
  - [x] SubTask 4.5: 创建配置状态Store (`src/stores/config.ts`)

- [x] Task 5: 简化Provider系统
  - [x] SubTask 5.1: 创建简化的Provider工厂函数
  - [x] SubTask 5.2: 移除多Provider选择逻辑
  - [x] SubTask 5.3: 实现基于配置的Provider初始化

- [x] Task 6: 实现Live2D角色显示
  - [x] SubTask 6.1: 复制hiyori Live2D模型资源到 `public/assets/live2d/`
  - [x] SubTask 6.2: 创建Live2D舞台组件 (`src/components/Live2DStage.vue`)
  - [x] SubTask 6.3: 实现模型自动加载和初始化
  - [x] SubTask 6.4: 实现鼠标跟随眼球动画

- [x] Task 7: 实现聊天功能
  - [x] SubTask 7.1: 创建聊天状态Store (`src/stores/chat.ts`)
  - [x] SubTask 7.2: 实现LLM流式对话接口
  - [x] SubTask 7.3: 创建聊天消息组件 (`src/components/ChatMessage.vue`)
  - [x] SubTask 7.4: 创建聊天输入组件 (`src/components/ChatInput.vue`)
  - [x] SubTask 7.5: 实现聊天历史记录

- [x] Task 8: 实现TTS语音输出
  - [x] SubTask 8.1: 创建TTS服务模块 (`src/services/tts.ts`)
  - [x] SubTask 8.2: 实现流式音频播放
  - [x] SubTask 8.3: 实现口型同步动画（基础实现）
  - [x] SubTask 8.4: 实现播放控制（暂停/继续/停止）

- [x] Task 9: 实现STT语音输入
  - [x] SubTask 9.1: 创建STT服务模块 (`src/services/stt.ts`)
  - [x] SubTask 9.2: 实现麦克风权限获取
  - [x] SubTask 9.3: 实现实时语音转写
  - [x] SubTask 9.4: 实现VAD语音活动检测（基础实现）

- [x] Task 10: 创建主页面
  - [x] SubTask 10.1: 创建主页布局 (`src/pages/HomePage.vue`)
  - [x] SubTask 10.2: 实现响应式布局适配
  - [x] SubTask 10.3: 实现移动端适配

- [x] Task 11: 创建儿童友好UI组件
  - [x] SubTask 11.1: 创建大尺寸麦克风按钮组件（已集成在ChatInput中）
  - [x] SubTask 11.2: 创建语音波形可视化组件（基础实现）
  - [x] SubTask 11.3: 创建加载动画组件（已集成）
  - [x] SubTask 11.4: 创建错误提示组件（已集成）

- [x] Task 12: 实现表情动画同步
  - [x] SubTask 12.1: 定义情感-表情映射
  - [x] SubTask 12.2: 实现LLM输出情感解析
  - [x] SubTask 12.3: 实现表情切换动画

## Phase 5: 测试与优化

- [x] Task 13: 功能测试
  - [x] SubTask 13.1: 测试配置文件加载
  - [x] SubTask 13.2: 测试LLM流式对话
  - [x] SubTask 13.3: 测试TTS语音输出
  - [x] SubTask 13.4: 测试STT语音输入
  - [x] SubTask 13.5: 测试Live2D动画

- [x] Task 14: 性能优化
  - [x] SubTask 14.1: 优化Live2D模型加载性能（已实现缓存机制）
  - [x] SubTask 14.2: 优化音频流处理（已实现LipSyncAnalyzer）
  - [x] SubTask 14.3: 优化响应式布局性能

- [x] Task 15: 文档与部署
  - [x] SubTask 15.1: 编写配置文件说明文档
  - [x] SubTask 15.2: 编写部署指南
  - [x] SubTask 15.3: 创建示例配置文件

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1
- Task 5 depends on Task 4
- Task 6 depends on Task 2, Task 3
- Task 7 depends on Task 4, Task 5
- Task 8 depends on Task 4, Task 5, Task 6
- Task 9 depends on Task 4, Task 5
- Task 10 depends on Task 3, Task 6, Task 7
- Task 11 depends on Task 10
- Task 12 depends on Task 6, Task 7
- Task 13 depends on Task 10, Task 11, Task 12
- Task 14 depends on Task 13
- Task 15 depends on Task 14
