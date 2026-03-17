# AI学伴 (AI Study Partner) 规格文档

## Why

开发一款面向儿童的AI学习陪伴Web工具，通过生动的Live2D人物形象和流式语音对话功能，为儿童提供互动式学习陪伴体验。该项目基于开源AIRI项目进行二次开发，最大化复用其成熟的技术架构和组件。

## What Changes

### 核心功能
- 复用AIRI项目的Vue 3 + TypeScript架构、响应式设计、流式对话机制
- 改造配置系统：移除复杂设置界面，改用JSON配置文件管理
- 集成Live2D人物动画系统，内置儿童友好角色模型
- 实现LLM对话 + TTS/STT流式语音交互功能

### 配置系统改造 **BREAKING**
- 移除原项目的Web端设置界面
- 实现基于JSON文件的配置管理系统
- 支持LLM服务提供商配置（API Key、Base URL、模型选择）
- 支持TTS/STT服务提供商配置
- 支持角色提示词模板配置

### 动画系统
- 复用AIRI内置的Live2D hiyori模型
- 实现表情与对话内容同步
- 支持语音节奏驱动的口型动画

## Impact

### 复用的AIRI模块
- `packages/stage-ui` - 核心UI组件库
- `packages/stage-ui-live2d` - Live2D动画系统
- `packages/i18n` - 国际化支持
- `packages/audio` - 音频处理工具

### 需要新建/修改的模块
- `src/config/` - JSON配置管理系统
- `src/pages/` - 简化的页面组件
- `src/stores/config.ts` - 配置状态管理

## ADDED Requirements

### Requirement: JSON配置文件系统
系统应提供基于JSON文件的配置管理方案，支持以下配置项：

#### Scenario: 配置文件加载
- **WHEN** 应用启动时
- **THEN** 系统自动加载 `config.json` 配置文件
- **AND** 验证配置项的完整性和有效性
- **AND** 若配置无效则显示友好的错误提示

#### Scenario: LLM配置
- **WHEN** 用户需要配置LLM服务
- **THEN** 配置文件支持以下字段：
  ```json
  {
    "llm": {
      "provider": "openai",
      "apiKey": "sk-xxx",
      "baseUrl": "https://api.openai.com/v1/",
      "model": "gpt-4o-mini"
    }
  }
  ```

#### Scenario: TTS配置
- **WHEN** 用户需要配置TTS服务
- **THEN** 配置文件支持以下字段：
  ```json
  {
    "tts": {
      "provider": "openai",
      "apiKey": "sk-xxx",
      "baseUrl": "https://api.openai.com/v1/",
      "model": "tts-1",
      "voice": "nova"
    }
  }
  ```

#### Scenario: STT配置
- **WHEN** 用户需要配置STT服务
- **THEN** 配置文件支持以下字段：
  ```json
  {
    "stt": {
      "provider": "openai",
      "apiKey": "sk-xxx",
      "baseUrl": "https://api.openai.com/v1/",
      "model": "whisper-1"
    }
  }
  ```

#### Scenario: 角色提示词配置
- **WHEN** 用户需要自定义AI角色行为
- **THEN** 配置文件支持以下字段：
  ```json
  {
    "character": {
      "name": "小伴",
      "systemPrompt": "你是一个友好的学习伙伴...",
      "personality": "活泼、耐心、鼓励"
    }
  }
  ```

### Requirement: Live2D动画集成
系统应集成Live2D动画系统，提供生动的儿童友好角色形象。

#### Scenario: 默认角色加载
- **WHEN** 应用启动时
- **THEN** 自动加载内置的hiyori Live2D模型
- **AND** 模型显示在屏幕中央位置
- **AND** 模型执行默认的待机动画

#### Scenario: 表情同步
- **WHEN** AI回复文本内容时
- **THEN** Live2D模型根据情感标签切换表情
- **AND** 表情变化自然流畅

#### Scenario: 口型同步
- **WHEN** TTS播放语音时
- **THEN** Live2D模型的口型与语音节奏同步
- **AND** 口型动画自然协调

### Requirement: 流式语音对话
系统应支持完整的语音对话流程。

#### Scenario: 语音输入
- **WHEN** 用户点击麦克风按钮开始说话
- **THEN** 系统通过STT服务实时转写语音
- **AND** 显示转写文本预览
- **AND** 检测到说话结束后自动发送消息

#### Scenario: 语音输出
- **WHEN** AI生成回复文本
- **THEN** 系统通过TTS服务流式播放语音
- **AND** Live2D模型同步执行口型动画
- **AND** 支持中断播放

#### Scenario: 流式对话
- **WHEN** 用户发送消息后
- **THEN** LLM流式返回文本内容
- **AND** 文本实时显示在聊天界面
- **AND** TTS同步播放已生成的文本片段

### Requirement: 儿童友好界面
系统界面设计应符合儿童使用习惯。

#### Scenario: 简洁界面
- **WHEN** 用户打开应用
- **THEN** 界面仅显示核心交互元素
- **AND** 移除复杂的设置菜单
- **AND** 使用大尺寸图标和按钮

#### Scenario: 响应式设计
- **WHEN** 用户在不同设备上访问
- **THEN** 界面自适应屏幕尺寸
- **AND** 移动端和桌面端均有良好体验

## MODIFIED Requirements

### Requirement: 简化的Provider系统
基于原AIRI的Provider系统进行简化，仅保留配置文件中指定的服务提供商。

#### Scenario: 单一Provider模式
- **WHEN** 配置文件指定了LLM/TTS/STT提供商
- **THEN** 系统仅使用配置的提供商
- **AND** 不显示Provider选择界面
- **AND** 配置错误时显示明确的错误提示

## REMOVED Requirements

### Requirement: 复杂设置界面
**Reason**: 儿童用户不需要复杂的配置界面，改用JSON配置文件由家长/教师配置。
**Migration**: 原设置界面的功能迁移至JSON配置文件。

### Requirement: 多Provider切换
**Reason**: 简化用户体验，单一配置文件指定所有服务。
**Migration**: 通过配置文件预配置所有服务参数。

### Requirement: 用户认证系统
**Reason**: 本地部署场景不需要用户认证。
**Migration**: 移除认证相关代码和依赖。
