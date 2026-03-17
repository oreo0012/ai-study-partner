# 修复计划：404错误与MiniMax API兼容

## 问题分析

### 问题1：404错误无法访问页面

**根本原因**：
- 根目录 `package.json` 中的脚本使用 `--config apps/web/vite.config.ts`
- 但 `apps/web/vite.config.ts` 没有正确设置 `root` 属性
- 当从项目根目录运行 `pnpm dev` 时，Vite的工作目录是根目录，而不是 `apps/web`
- 导致 `index.html` 和 `/src/main.ts` 路径无法正确解析

**具体问题**：
1. Vite配置文件路径与工作目录不匹配
2. `index.html` 中的 `/src/main.ts` 路径在根目录运行时找不到对应文件

### 问题2：MiniMax API兼容性

**当前状态**：
- 项目使用标准OpenAI API格式，基本兼容MiniMax
- 需要调整配置参数以适配MiniMax的特殊要求

**MiniMax特殊要求**：
1. `baseURL` 必须是 `https://api.minimaxi.com/v1`
2. `temperature` 取值范围为 (0.0, 1.0]，推荐使用 1.0
3. 模型名称：`MiniMax-M2.5`, `MiniMax-M2.5-highspeed` 等
4. 不支持 `presence_penalty`, `frequency_penalty`, `logit_bias` 等参数

---

## 修复步骤

### 步骤1：修复Vite配置解决404错误

**操作**：修改 `apps/web/vite.config.ts`，添加正确的 `root` 配置

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname),  // 明确设置root为apps/web目录
  plugins: [
    vue(),
    UnoCSS(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3000,
    host: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
```

**或者**：修改根目录 `package.json` 的脚本，切换工作目录

```json
{
  "scripts": {
    "dev": "cd apps/web && vite",
    "build": "cd apps/web && vite build",
    "preview": "cd apps/web && vite preview"
  }
}
```

### 步骤2：更新配置文件支持MiniMax

**操作**：修改 `apps/web/public/config.json`，添加MiniMax配置示例

```json
{
  "llm": {
    "provider": "minimax",
    "apiKey": "",
    "baseUrl": "https://api.minimaxi.com/v1/",
    "model": "MiniMax-M2.5",
    "temperature": 1.0,
    "maxTokens": 2048
  },
  "tts": {
    "provider": "openai",
    "apiKey": "",
    "baseUrl": "https://api.openai.com/v1/",
    "model": "tts-1",
    "voice": "nova",
    "speed": 1.0
  },
  "stt": {
    "provider": "openai",
    "apiKey": "",
    "baseUrl": "https://api.openai.com/v1/",
    "model": "whisper-1",
    "language": "zh-CN"
  },
  "character": {
    "name": "小伴",
    "systemPrompt": "你是一个友好的学习伙伴，名叫小伴。你的任务是帮助儿童学习，回答他们的问题，鼓励他们探索新知识。请用简单、有趣的语言与孩子交流，保持耐心和友善。当孩子遇到困难时，给予鼓励和引导。",
    "personality": "活泼、耐心、鼓励、友善"
  },
  "live2d": {
    "modelPath": "/assets/live2d/hiyori/",
    "scale": 1.0,
    "positionX": 0,
    "positionY": 0
  }
}
```

### 步骤3：更新配置类型定义

**操作**：修改 `apps/web/src/config/types.ts`，添加MiniMax provider类型

```typescript
export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'ollama' | 'openai-compatible' | 'minimax'
  apiKey: string
  baseUrl: string
  model: string
  temperature?: number
  maxTokens?: number
}
```

### 步骤4：更新LLM服务适配MiniMax

**操作**：修改 `apps/web/src/services/llm.ts`，确保temperature参数正确

- MiniMax的temperature范围是 (0.0, 1.0]，推荐1.0
- 需要确保temperature不为0，且不超过1.0

```typescript
// 在streamChat函数中添加temperature校验
const effectiveTemperature = temperature ?? 0.7
const validatedTemperature = Math.min(Math.max(effectiveTemperature, 0.1), 1.0)
```

### 步骤5：验证测试

1. 启动开发服务器：`pnpm dev`
2. 访问 http://localhost:3000 确认页面正常加载
3. 配置MiniMax API Key后测试对话功能

---

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `apps/web/vite.config.ts` | 添加 `root: resolve(__dirname)` |
| `apps/web/public/config.json` | 更新为MiniMax配置示例 |
| `apps/web/src/config/types.ts` | 添加 'minimax' provider类型 |
| `apps/web/src/services/llm.ts` | 添加temperature参数校验 |

---

## 预期结果

1. 访问 http://localhost:3000 能正常显示AI学伴页面
2. 配置MiniMax API Key后能正常进行对话
3. 流式响应正常工作
