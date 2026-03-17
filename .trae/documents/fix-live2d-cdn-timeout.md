# 修复Live2D CDN连接超时问题

## 问题分析

### 错误信息
```
GET https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js
net::ERR_CONNECTION_TIMED_OUT
```

### 根本原因
当前使用的CDN地址 `https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js` 连接超时，无法访问。

**可能原因**：
1. CDN服务器暂时不可用
2. 网络防火墙限制
3. 该GitHub仓库地址已变更或不可访问

---

## 修复方案

### 方案一：更换为可靠的CDN地址（推荐）

使用更稳定的CDN源：

```typescript
// 使用 unpkg 或 cdnjs 的稳定版本
const LIVE2D_CORE_URL = 'https://unpkg.com/live2d-widget-model-shizuku@1.0.5/assets/live2d/core/live2d.min.js'
// 或者
const LIVE2D_CORE_URL = 'https://cdn.jsdelivr.net/npm/live2d-widget-model-shizuku@1.0.5/assets/live2d/core/live2d.min.js'
```

### 方案二：使用pixi-live2d-display内置的CDN

pixi-live2d-display 库提供了推荐的CDN地址：

```typescript
// Cubism 2 SDK
const LIVE2D_CORE_URL = 'https://cubism.live2d.com/sdk-web/cubismcore/live2d.core.min.js'
```

### 方案三：下载到本地（最稳定）

将Live2D核心库下载到项目的 `public` 目录，避免网络依赖。

---

## 推荐实施方案

修改 `Live2DStage.vue` 的 `loadDependencies` 函数，使用更可靠的CDN地址：

```typescript
async function loadDependencies() {
  // 1. 加载 PIXI.js
  if (!(window as any).PIXI) {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/pixi.js@7.x/dist/pixi.min.js'
    document.head.appendChild(script)
    await new Promise<void>((resolve, reject) => {
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load PIXI.js'))
    })
  }
  
  // 2. 加载 Cubism 2 核心运行时 (使用更稳定的CDN)
  if (!(window as any).live2d) {
    const live2dCoreScript = document.createElement('script')
    // 使用 unpkg CDN 或 jsDelivr 的 npm 包地址
    live2dCoreScript.src = 'https://cdn.jsdelivr.net/npm/live2d-widget-model-shizuku@1.0.5/assets/live2d/core/live2d.min.js'
    document.head.appendChild(live2dCoreScript)
    await new Promise<void>((resolve, reject) => {
      live2dCoreScript.onload = () => resolve()
      live2dCoreScript.onerror = () => reject(new Error('Failed to load Live2D Core'))
    })
  }
  
  // 3. 加载 pixi-live2d-display
  if (!(window as any).Live2D) {
    const live2dScript = document.createElement('script')
    live2dScript.src = 'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/index.min.js'
    document.head.appendChild(live2dScript)
    await new Promise<void>((resolve, reject) => {
      live2dScript.onload = () => resolve()
      live2dScript.onerror = () => reject(new Error('Failed to load Live2D Display'))
    })
  }
  
  PIXI = (window as any).PIXI
}
```

---

## 备选CDN地址列表

| CDN源 | 地址 | 稳定性 |
|-------|------|--------|
| jsDelivr npm | `https://cdn.jsdelivr.net/npm/live2d-widget-model-shizuku@1.0.5/assets/live2d/core/live2d.min.js` | ⭐⭐⭐ |
| unpkg | `https://unpkg.com/live2d-widget-model-shizuku@1.0.5/assets/live2d/core/live2d.min.js` | ⭐⭐⭐ |
| GitHub原版 | `https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js` | ⭐ (当前不可用) |

---

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `apps/web/src/components/Live2DStage.vue` | 更换Live2D核心库CDN地址 |

---

## 预期结果

1. Live2D核心库成功加载
2. 无网络连接超时错误
3. Live2D模型正常显示
