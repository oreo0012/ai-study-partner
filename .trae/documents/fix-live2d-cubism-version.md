# Live2D Cubism 运行时版本不匹配修复计划

## 问题分析

### 错误信息
```
Uncaught Error: Could not find Cubism 2 runtime. This plugin requires live2d.min.js to be loaded.
```

### 根本原因
1. `pixi-live2d-display@0.4.0` 默认版本在初始化时会检查 Cubism 2 运行时
2. 用户放置的是 `live2dcubismcore.min.js`（Cubism 3/4 核心库）
3. 模型 `hiyori_free_t08.model3.json` 是 Cubism 3 格式

### pixi-live2d-display 版本说明
| 版本路径 | 支持的模型 | 需要的核心库 |
|---------|-----------|-------------|
| `pixi-live2d-display` | Cubism 2, 3, 4 | live2d.min.js + live2dcubismcore.min.js |
| `pixi-live2d-display/cubism2` | Cubism 2 | live2d.min.js |
| `pixi-live2d-display/cubism4` | Cubism 3, 4 | live2dcubismcore.min.js |

## 解决方案

使用 `pixi-live2d-display/cubism4` 版本，该版本：
- 只需要 `live2dcubismcore.min.js`（用户已放置）
- 支持 Cubism 3 和 Cubism 4 模型
- 不需要 Cubism 2 运行时

## 实施步骤

### 步骤 1：修改 Live2DStage.vue 组件
- 更新 CDN 加载路径，使用 `pixi-live2d-display/cubism4` 版本
- 移除对 Cubism 2 运行时的依赖检查
- 保持使用本地 `live2dcubismcore.min.js`

### 步骤 2：验证加载顺序
确保脚本加载顺序正确：
1. PIXI.js
2. live2dcubismcore.min.js（本地）
3. pixi-live2d-display/cubism4（CDN）

### 步骤 3：测试验证
- 启动开发服务器
- 检查浏览器控制台是否还有错误
- 确认 Live2D 模型正常显示

## 技术细节

### 需要修改的代码位置
- 文件：`apps/web/src/components/Live2DStage.vue`
- 函数：`loadDependencies()`
- CDN 路径：将 `pixi-live2d-display@0.4.0/dist/index.min.js` 改为 `pixi-live2d-display@0.4.0/dist/cubism4.min.js`

### 预期结果
- 控制台不再报 "Could not find Cubism 2 runtime" 错误
- Live2D 模型正常加载和渲染
- 模型响应鼠标移动（眼睛跟踪）
