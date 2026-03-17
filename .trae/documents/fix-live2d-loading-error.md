# 修复Live2D加载失败问题

## 问题分析

### 错误信息
```
Uncaught Error: Could not find Cubism 2 runtime. 
This plugin requires live2d.min.js to be loaded.
```

### 根本原因
`pixi-live2d-display` 插件需要 Live2D Cubism SDK 运行时才能工作。当前代码只加载了：
1. `pixi.js` - PIXI.js 渲染库
2. `pixi-live2d-display` - Live2D 显示插件

**缺少关键依赖**：
- `live2d.min.js` - Cubism 2 核心运行时

### 依赖关系
```
Live2D模型 (Cubism 2/3/4)
    ↓
pixi-live2d-display (适配层)
    ↓
├── PIXI.js (渲染引擎) ✓ 已加载
└── Live2D Cubism SDK (运行时) ✗ 未加载
```

---

## 修复方案

### 方案：加载Cubism 2运行时

修改 `Live2DStage.vue` 的 `loadDependencies` 函数，添加 `live2d.min.js` 的加载：

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
  
  // 2. 加载 Cubism 2 核心运行时 (新增)
  if (!(window as any).live2d) {
    const live2dCoreScript = document.createElement('script')
    live2dCoreScript.src = 'https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js'
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

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `apps/web/src/components/Live2DStage.vue` | 添加 Cubism 2 核心运行时加载 |

---

## 预期结果

1. Live2D核心运行时正确加载
2. pixi-live2d-display插件正常初始化
3. Live2D模型成功加载显示
4. 控制台无错误信息
