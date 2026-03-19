# 火山引擎TTS集成计划

## 一、火山引擎seed-tts-2.0接口参数详解

### 1.1 请求头（必填）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| X-Api-App-Id | string | 是 | 火山引擎控制台获取的APP ID |
| X-Api-Access-Key | string | 是 | 火山引擎控制台获取的Access Token |
| X-Api-Resource-Id | string | 是 | 资源ID，seed-tts-2.0 |
| Content-Type | string | 是 | application/json |

### 1.2 请求体（必填字段）

```json
{
  "user": {
    "uid": "用户唯一标识"
  },
  "namespace": "BidirectionalTTS",
  "req_params": {
    "text": "要合成的文本内容",
    "model": "seed-tts-2.0-expressive 或 seed-tts-2.0-standard",
    "speaker": "音色ID",
    "audio_params": {
      "format": "mp3/ogg_opus/pcm",
      "sample_rate": 24000,
      "channels": 1
    }
  }
}
```

### 1.3 响应格式

- 传输编码：`Transfer-Encoding: chunked`
- 音频数据：base64格式，需解析后拼接播放
- 返回头：`X-Tt-Logid`（用于问题定位）

### 1.4 可用音色

火山引擎提供多种音色，需要从控制台获取具体的音色ID。

---

## 二、项目架构分析

### 2.1 当前技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Vue 3 + TypeScript | 响应式UI |
| 构建工具 | Vite | 开发服务器和打包 |
| TTS服务 | TTSService类 | 封装语音合成逻辑 |
| Provider模式 | SpeechProvider接口 | 抽象不同TTS提供商 |
| 音频处理 | Web Audio API | 播放和口型同步 |

### 2.2 当前TTS架构

```
config.json → TTSConfig → SpeechProvider → TTSService → 音频播放
```

### 2.3 集成可行性评估

| 评估项 | 状态 | 说明 |
|--------|------|------|
| Provider模式 | ✅ 支持 | 已有SpeechProvider接口 |
| 音频处理 | ✅ 支持 | Web Audio API已集成 |
| 口型同步 | ✅ 支持 | LipSyncAnalyzer已实现 |
| 代理配置 | ✅ 支持 | Vite proxy已配置 |
| 流式处理 | ⚠️ 需适配 | 需处理HTTP Chunked响应 |

---

## 三、技术可行性分析

### 3.1 系统资源需求

| 资源 | 需求 | 说明 |
|------|------|------|
| CPU | 低 | 音频解码由浏览器处理 |
| 内存 | 低 | 流式处理，无需大内存 |
| 网络 | 中等 | 需要稳定访问火山引擎API |
| 存储 | 无 | 无需本地存储 |

### 3.2 网络环境要求

- 能够访问 `openspeech.bytedance.com`
- 建议使用代理避免跨域问题
- 支持HTTPS和HTTP Chunked传输

### 3.3 潜在集成难点

| 难点 | 解决方案 |
|------|----------|
| HTTP Chunked响应 | 使用fetch + ReadableStream处理 |
| Base64音频解析 | 使用atob() + Uint8Array转换 |
| 自定义请求头 | 通过Vite代理转发 |
| 流式播放 | 边接收边解码播放 |

### 3.4 可行性结论

**✅ 技术可行**

项目已具备集成火山引擎TTS的所有条件：
1. 已有完善的TTS服务架构
2. 支持Provider模式扩展
3. 已有音频处理和口型同步功能
4. Vite代理配置成熟

---

## 四、集成实施方案

### 4.1 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/config/types.ts` | 修改 | 添加火山引擎TTS配置类型 |
| `src/services/providers/volcengine.ts` | 新建 | 火山引擎TTS Provider实现 |
| `src/services/providers/factory.ts` | 修改 | 添加火山引擎Provider创建逻辑 |
| `src/services/tts.ts` | 修改 | 适配火山引擎API格式 |
| `vite.config.ts` | 修改 | 添加火山引擎API代理 |
| `public/config.json` | 修改 | 添加火山引擎配置示例 |

### 4.2 实施步骤

#### 步骤1: 更新配置类型定义

**文件**: `src/config/types.ts`

```typescript
export interface TTSConfig {
  provider: 'openai' | 'elevenlabs' | 'edge-tts' | 'openai-compatible' | 'minimax' | 'volcengine'
  apiKey: string
  baseUrl: string
  model: string
  voice: string
  speed?: number
  // 火山引擎特有配置
  appId?: string
  resourceId?: string
}
```

#### 步骤2: 创建火山引擎TTS Provider

**文件**: `src/services/providers/volcengine.ts`

核心功能：
- 构建火山引擎API请求格式
- 处理HTTP Chunked流式响应
- 解析base64音频数据
- 返回音频ArrayBuffer

```typescript
export class VolcengineTTSProvider {
  private config: VolcengineTTSConfig

  async synthesize(text: string): Promise<ArrayBuffer> {
    // 1. 构建请求
    // 2. 发送到代理端点
    // 3. 处理流式响应
    // 4. 解析base64音频
    // 5. 返回ArrayBuffer
  }
}
```

#### 步骤3: 更新Vite代理配置

**文件**: `vite.config.ts`

```typescript
proxy: {
  '/api/volcengine': {
    target: 'https://openspeech.bytedance.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/volcengine/, '/api/v3/tts')
  }
}
```

#### 步骤4: 更新配置文件

**文件**: `public/config.json`

```json
{
  "tts": {
    "provider": "volcengine",
    "appId": "your-app-id",
    "apiKey": "your-access-key",
    "resourceId": "seed-tts-2.0",
    "model": "seed-tts-2.0-expressive",
    "voice": "zh_female_tianmei",
    "baseUrl": "/api/volcengine/unidirectional"
  }
}
```

### 4.3 核心代码实现

#### 火山引擎Provider实现

```typescript
// src/services/providers/volcengine.ts
export interface VolcengineTTSConfig {
  appId: string
  accessKey: string
  resourceId: string
  speaker: string
  model?: 'seed-tts-2.0-expressive' | 'seed-tts-2.0-standard'
}

export class VolcengineTTSProvider implements SpeechProvider {
  private config: VolcengineTTSConfig

  constructor(config: VolcengineTTSConfig) {
    this.config = config
  }

  speech(_model: string, voice?: string) {
    return {
      baseURL: '/api/volcengine/unidirectional',
      apiKey: this.config.accessKey,
      model: this.config.model || 'seed-tts-2.0-expressive',
      voice: voice || this.config.speaker,
      appId: this.config.appId,
      resourceId: this.config.resourceId
    }
  }

  async synthesize(text: string): Promise<ArrayBuffer> {
    const response = await fetch('/api/volcengine/unidirectional', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-App-Id': this.config.appId,
        'X-Api-Access-Key': this.config.accessKey,
        'X-Api-Resource-Id': this.config.resourceId
      },
      body: JSON.stringify({
        user: { uid: 'user-' + Date.now() },
        namespace: 'BidirectionalTTS',
        req_params: {
          text,
          model: this.config.model || 'seed-tts-2.0-expressive',
          speaker: this.config.speaker,
          audio_params: {
            format: 'mp3',
            sample_rate: 24000
          }
        }
      })
    })

    return this.parseStreamResponse(response)
  }

  private async parseStreamResponse(response: Response): Promise<ArrayBuffer> {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    const audioChunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.trim()) {
          try {
            const json = JSON.parse(line)
            if (json.data?.audio) {
              const audioData = this.base64ToArrayBuffer(json.data.audio)
              audioChunks.push(new Uint8Array(audioData))
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }
    }

    return this.concatArrayBuffers(audioChunks)
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  private concatArrayBuffers(chunks: Uint8Array[]): ArrayBuffer {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return result.buffer
  }
}
```

### 4.4 配置说明文档更新

更新 `public/config.example.json`，添加火山引擎配置说明。

---

## 五、测试验证计划

### 5.1 功能测试

- [ ] 基本文本合成
- [ ] 流式音频播放
- [ ] 口型同步
- [ ] 错误处理

### 5.2 性能测试

- [ ] 首次合成延迟
- [ ] 流式播放流畅度
- [ ] 内存占用

### 5.3 兼容性测试

- [ ] Chrome浏览器
- [ ] Firefox浏览器
- [ ] Edge浏览器

---

## 六、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| API调用失败 | 无法播放语音 | 添加fallback机制，使用备用TTS |
| 网络延迟 | 播放卡顿 | 使用流式处理优化，显示加载状态 |
| 音色不可用 | 合成失败 | 提供音色检测和提示 |
| 跨域问题 | 请求失败 | 通过Vite代理解决 |

---

## 七、预计工作量

| 任务 | 预计时间 |
|------|----------|
| 配置类型更新 | 10分钟 |
| 火山引擎Provider实现 | 30分钟 |
| Vite代理配置 | 5分钟 |
| TTSService适配 | 15分钟 |
| 配置文件更新 | 10分钟 |
| 测试验证 | 20分钟 |
| **总计** | **约1.5小时** |
