# TTS功能测试与集成修复计划

## 问题诊断

### 发现的问题

经过代码分析，发现 **TTS功能未被集成到聊天流程中**：

1. `chat.ts` 的 `sendMessage` 函数只处理LLM对话，**没有调用TTS服务**
2. `HomePage.vue` 中**没有TTS相关的调用代码**
3. TTS服务虽然已实现（`TTSService`、`VolcengineTTSProvider`），但**从未被实例化或调用**

### 当前代码流程

```
用户输入 → sendMessage() → LLM流式响应 → 显示文本 → 结束
                                    ↓
                              ❌ 没有调用TTS
```

### 期望代码流程

```
用户输入 → sendMessage() → LLM流式响应 → 显示文本 → TTS播放语音 → 结束
```

---

## 一、TTS配置测试方案

### 1.1 浏览器控制台测试

打开浏览器开发者工具（F12），在Console中执行以下测试：

#### 测试1: 检查配置是否正确加载

```javascript
// 检查TTS配置
const configStore = window.__PINIA_STORE__?.config
console.log('TTS Config:', configStore?.ttsConfig)
```

**预期结果**: 应显示包含 `provider: "volcengine"` 的配置对象

#### 测试2: 手动测试TTS API

```javascript
// 测试火山引擎TTS API
async function testTTS() {
  const response = await fetch('/api/volcengine/unidirectional', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-App-Id': '4537824551',
      'X-Api-Access-Key': 'ba892369-1025-42d8-bb37-699b74c207f1',
      'X-Api-Resource-Id': 'seed-tts-2.0'
    },
    body: JSON.stringify({
      user: { uid: 'test-user' },
      namespace: 'BidirectionalTTS',
      req_params: {
        text: '你好，这是一个测试',
        model: 'seed-tts-2.0-expressive',
        speaker: 'ICL_zh_female_huoponvhai_tob',
        audio_params: {
          format: 'mp3',
          sample_rate: 24000
        }
      }
    })
  })
  
  console.log('Response status:', response.status)
  console.log('Response headers:', [...response.headers.entries()])
  
  if (response.ok) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let result = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      result += decoder.decode(value, { stream: true })
    }
    
    console.log('Response body:', result.substring(0, 500))
    return result
  } else {
    const errorText = await response.text()
    console.error('Error:', errorText)
  }
}

testTTS()
```

**预期结果**: 
- 状态码 200
- 响应体包含base64编码的音频数据

### 1.2 网络请求检查

1. 打开开发者工具 → Network 标签
2. 筛选 `volcengine` 关键词
3. 发送一条消息
4. 检查是否有对 `/api/volcengine/unidirectional` 的请求

**如果没有请求**: 说明TTS未被调用
**如果有请求但失败**: 检查错误响应

---

## 二、TTS功能开关检查

### 2.1 当前状态

**项目中没有TTS开关** - TTS功能应该始终启用，但由于代码未集成，实际上从未工作。

### 2.2 需要添加的功能

1. **TTS开关**: 允许用户开启/关闭语音播放
2. **自动播放**: AI回复完成后自动播放语音
3. **手动播放**: 点击消息可重新播放

---

## 三、修复方案

### 3.1 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/stores/chat.ts` | 添加TTS服务实例化和调用 |
| `src/pages/HomePage.vue` | 添加TTS回调和状态管理 |
| `src/stores/config.ts` | 添加TTS开关状态 |
| `src/config/types.ts` | 添加TTS开关配置项 |

### 3.2 核心修改

#### 修改1: 在chat.ts中集成TTS

```typescript
// 添加TTS服务
import { TTSService, createSpeechProvider } from '@/services'

// 在sendMessage完成后调用TTS
onComplete: async (fullText) => {
  const cleanedText = stripEmotionTags(fullText)
  addAssistantMessage(cleanedText)
  streamingMessage.value = ''
  
  // 新增：调用TTS播放
  if (ttsEnabled && ttsService) {
    await ttsService.speak(cleanedText)
  }
}
```

#### 修改2: 添加TTS开关

```typescript
// config.ts
const ttsEnabled = ref(true)

function toggleTTS() {
  ttsEnabled.value = !ttsEnabled.value
}
```

---

## 四、完整测试流程

### 步骤1: 验证配置加载

1. 打开浏览器控制台
2. 执行配置检查代码
3. 确认TTS配置正确显示

### 步骤2: 测试API连接

1. 执行手动TTS API测试代码
2. 检查响应状态和数据
3. 记录任何错误信息

### 步骤3: 检查代理配置

1. 确认Vite开发服务器正在运行
2. 检查 `vite.config.ts` 中的代理配置
3. 验证代理是否正确转发请求

### 步骤4: 集成测试（修复后）

1. 发送一条消息给AI
2. 观察Network面板是否有TTS请求
3. 确认音频播放

---

## 五、故障排除

### 问题1: 没有声音输出

**可能原因**:
- TTS未被调用（当前问题）
- API请求失败
- 音频解码失败
- 浏览器静音

**排查步骤**:
1. 检查控制台是否有错误
2. 检查Network面板的请求
3. 检查浏览器音量设置

### 问题2: API请求失败

**可能原因**:
- App ID 或 Access Key 错误
- 代理配置错误
- 网络问题

**排查步骤**:
1. 验证凭证是否正确
2. 检查代理是否工作
3. 尝试直接请求（绕过代理）

### 问题3: 音频播放失败

**可能原因**:
- 音频格式不支持
- AudioContext未激活
- 浏览器自动播放限制

**排查步骤**:
1. 检查音频格式
2. 用户需要先与页面交互
3. 检查AudioContext状态

---

## 六、实施步骤

### 阶段1: 诊断测试（只读）

1. 执行浏览器控制台测试代码
2. 检查Network请求
3. 确认问题根源

### 阶段2: 代码修复

1. 更新 `chat.ts` 集成TTS
2. 更新 `HomePage.vue` 添加TTS回调
3. 添加TTS开关功能

### 阶段3: 验证测试

1. 重启开发服务器
2. 刷新页面
3. 发送消息测试TTS

---

## 七、预期工作量

| 任务 | 时间 |
|------|------|
| 诊断测试 | 10分钟 |
| 代码修复 | 30分钟 |
| 测试验证 | 15分钟 |
| **总计** | **约55分钟** |
