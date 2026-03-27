# 题目区域高亮显示实现计划

## 一、概述

### 1.1 目标
实现"方案 C：存储原始图片 + 题目区域坐标 + 高亮显示"，让用户在做题时能够：
- 查看完整的原始试卷图片
- 快速定位当前题目在图片中的位置（通过高亮框显示）
- 保持完整的题目上下文

### 1.2 当前系统现状

#### 已有基础设施
- **图片存储服务** (`image-storage.ts`)：使用 IndexedDB 存储图片
- **习题数据结构** (`Exercise` 接口)：包含 `hasImageReference` 和 `images` 字段
- **VLM 识别服务** (`image-exercise-parser.ts`)：调用硅基流动 API 识别习题
- **做题组件** (`ExercisePractice.vue`)：展示习题并收集答案

#### 当前问题
- 只保存了整张试卷图片，没有题目区域坐标
- `hasImageReference` 只是布尔标记，无法定位具体位置
- 做题时无法展示题目对应的图片区域

---

## 二、数据架构设计

### 2.1 新增类型定义

```typescript
// 题目区域坐标（相对于原图的百分比位置）
export interface QuestionRegion {
  x: number        // 左上角 X 坐标百分比 (0-100)
  y: number        // 左上角 Y 坐标百分比 (0-100)
  width: number    // 宽度百分比 (0-100)
  height: number   // 高度百分比 (0-100)
  pageIndex?: number // 如果是多页试卷，页码索引（从0开始）
}

// 扩展 Exercise 接口
export interface Exercise {
  // ... 现有字段
  sourceImageId?: string      // 原始图片ID
  region?: QuestionRegion     // 题目在图片中的区域
}

// 扩展 ExerciseImage 接口
export interface ExerciseImage {
  // ... 现有字段
  width?: number              // 原图宽度（像素）
  height?: number             // 原图高度（像素）
  questionRegions?: Record<string, QuestionRegion> // 题目ID -> 区域映射
}
```

### 2.2 数据流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                      图片上传与识别流程                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 用户上传图片                                                 │
│       ↓                                                         │
│  2. 图片压缩与预处理                                              │
│       ↓                                                         │
│  3. 调用 VLM API（携带坐标识别提示词）                             │
│       ↓                                                         │
│  4. 解析响应：习题数据 + 区域坐标                                  │
│       ↓                                                         │
│  5. 存储原始图片到 IndexedDB                                      │
│       ↓                                                         │
│  6. 存储习题数据（包含 sourceImageId 和 region）                   │
│       ↓                                                         │
│  7. 更新图片记录的 questionRegions 映射                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      做题展示流程                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 加载当前习题                                                  │
│       ↓                                                         │
│  2. 检查是否有 sourceImageId                                      │
│       ↓ (有)                                                    │
│  3. 从 IndexedDB 加载原始图片                                     │
│       ↓                                                         │
│  4. 渲染图片组件                                                  │
│       ↓                                                         │
│  5. 根据 region 坐标绘制高亮框                                    │
│       ↓                                                         │
│  6. 用户答题交互                                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、存储方案设计

### 3.1 IndexedDB Schema 更新

```javascript
// 数据库版本升级到 2
const DB_VERSION = 2

// images store 新增字段
{
  id: string,
  exerciseIds: string[],
  base64: string,
  thumbnail?: string,
  createdAt: string,
  status: ImageStatus,
  size: number,
  // 新增字段
  width: number,           // 原图宽度
  height: number,          // 原图高度
  questionRegions: {       // 题目区域映射
    [exerciseId: string]: {
      x: number,
      y: number,
      width: number,
      height: number,
      pageIndex?: number
    }
  }
}
```

### 3.2 数据迁移策略

```typescript
// 数据库升级处理
request.onupgradeneeded = (event) => {
  const db = (event.target as IDBOpenDBRequest).result
  
  if (event.oldVersion < 1) {
    // 创建初始 store
    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    store.createIndex('status', 'status', { unique: false })
    store.createIndex('createdAt', 'createdAt', { unique: false })
    store.createIndex('exerciseIds', 'exerciseIds', { unique: false, multiEntry: true })
  }
  
  // 版本 1 -> 2: 添加新字段（无需删除重建，IndexedDB 支持动态字段）
  if (event.oldVersion < 2) {
    // 新字段会在写入时自动添加，无需迁移
    console.log('Upgrading IndexedDB schema to version 2')
  }
}
```

### 3.3 存储容量估算

| 数据类型 | 单张大小 | 预估数量 | 总容量 |
|---------|---------|---------|--------|
| 原始图片 (压缩后) | 500KB - 2MB | 50张 | 25-100MB |
| 区域坐标数据 | ~100 bytes | 500个 | ~50KB |
| 缩略图 (可选) | 50KB | 50张 | 2.5MB |

**建议限制**：
- 最大存储容量：100MB
- 图片保留天数：7天
- 单张图片大小限制：10MB

---

## 四、VLM 提示词优化

### 4.1 新增坐标识别提示词

```typescript
const COORDINATE_PROMPT = `
【坐标识别要求】
对于每道识别出的小题，请同时返回该题目在图片中的位置区域。

坐标说明：
- 使用百分比坐标（0-100），相对于图片整体
- x: 区域左上角的水平位置百分比
- y: 区域左上角的垂直位置百分比  
- width: 区域宽度占图片宽度的百分比
- height: 区域高度占图片高度的百分比

【输出格式】
请以JSON格式返回：
{
  "exercises": [
    {
      "type": "口算题",
      "questionNumber": "1",
      "question": "25 + 37 = ",
      "answer": "62",
      "hasImage": false,
      "region": {
        "x": 5,
        "y": 15,
        "width": 45,
        "height": 8
      }
    }
  ]
}

【坐标估算指南】
- 如果试卷分为左右两栏，每栏宽度约为50%
- 每道小题通常占图片高度的3-10%
- 大题标题区域通常比小题区域略大
- 如果无法精确定位，请给出合理的估算范围
`
```

### 4.2 响应解析增强

```typescript
interface ParsedExerciseData {
  type: string
  questionNumber?: string
  question: string
  options?: string[]
  answer: string
  hasImage: boolean
  region?: {
    x: number
    y: number
    width: number
    height: number
    pageIndex?: number
  }
}
```

---

## 五、前端组件实现

### 5.1 新增组件：QuestionImageHighlight.vue

```vue
<template>
  <div class="question-image-container">
    <!-- 图片容器 -->
    <div class="image-wrapper" ref="imageWrapper">
      <img 
        :src="imageBase64" 
        :style="imageStyle"
        @load="onImageLoad"
        alt="试卷图片"
      />
      
      <!-- 高亮覆盖层 -->
      <div 
        v-if="highlightRegion && imageLoaded"
        class="highlight-overlay"
        :style="highlightStyle"
      >
        <div class="highlight-border"></div>
      </div>
    </div>
    
    <!-- 控制按钮 -->
    <div class="image-controls">
      <button @click="zoomIn" title="放大">🔍+</button>
      <button @click="zoomOut" title="缩小">🔍-</button>
      <button @click="resetZoom" title="重置">↺</button>
    </div>
  </div>
</template>
```

### 5.2 组件功能特性

1. **图片渲染**
   - 支持缩放（0.5x - 3x）
   - 支持拖拽平移
   - 响应式适配不同屏幕尺寸

2. **高亮显示**
   - 使用 CSS 定位绘制高亮框
   - 支持自定义颜色、透明度、边框样式
   - 动画效果：淡入淡出、脉冲闪烁

3. **交互功能**
   - 点击高亮区域可放大查看
   - 双击图片切换全屏模式
   - 支持触摸手势（移动端）

### 5.3 坐标映射算法

```typescript
function calculateHighlightStyle(
  region: QuestionRegion,
  containerWidth: number,
  containerHeight: number,
  zoom: number,
  panX: number,
  panY: number
): CSSProperties {
  // 将百分比坐标转换为像素坐标
  const pixelX = (region.x / 100) * containerWidth
  const pixelY = (region.y / 100) * containerHeight
  const pixelWidth = (region.width / 100) * containerWidth
  const pixelHeight = (region.height / 100) * containerHeight
  
  return {
    position: 'absolute',
    left: `${pixelX * zoom + panX}px`,
    top: `${pixelY * zoom + panY}px`,
    width: `${pixelWidth * zoom}px`,
    height: `${pixelHeight * zoom}px`,
    transform: `translate(-50%, -50%)`
  }
}
```

---

## 六、开发阶段规划

### Phase 1: 类型定义与数据层（预计 2-3 小时）

**任务清单**：
- [ ] 1.1 更新 `types.ts` 添加 `QuestionRegion` 接口
- [ ] 1.2 扩展 `Exercise` 接口添加 `sourceImageId` 和 `region` 字段
- [ ] 1.3 扩展 `ExerciseImage` 接口添加 `width`、`height`、`questionRegions` 字段
- [ ] 1.4 更新 `image-storage.ts` 数据库版本到 2
- [ ] 1.5 添加 `saveImageWithRegions` 函数
- [ ] 1.6 添加 `getImageWithRegions` 函数

**验收标准**：
- TypeScript 编译无错误
- IndexedDB 升级不丢失现有数据
- 新字段可正常读写

### Phase 2: VLM 提示词与解析（预计 2-3 小时）

**任务清单**：
- [ ] 2.1 更新 `SYSTEM_PROMPT` 添加坐标识别要求
- [ ] 2.2 更新 `ParsedExerciseData` 接口添加 `region` 字段
- [ ] 2.3 增强 `parseAIResponse` 函数解析坐标数据
- [ ] 2.4 添加坐标数据验证函数
- [ ] 2.5 处理 VLM 未返回坐标的情况（降级处理）

**验收标准**：
- VLM 能返回合理的坐标数据
- 坐标数据格式正确
- 无坐标时不影响其他功能

### Phase 3: 图片上传流程集成（预计 2-3 小时）

**任务清单**：
- [ ] 3.1 修改 `ImageExerciseUploader.vue` 保存图片时获取尺寸
- [ ] 3.2 修改 `confirmUpload` 函数关联图片ID到习题
- [ ] 3.3 更新 `ParentPage.vue` 的 `processExerciseUpload` 函数
- [ ] 3.4 添加图片尺寸提取工具函数
- [ ] 3.5 更新习题存储逻辑保存 `sourceImageId` 和 `region`

**验收标准**：
- 上传图片后习题正确关联图片ID
- 区域坐标正确保存
- 控制台无错误日志

### Phase 4: 高亮显示组件开发（预计 3-4 小时）

**任务清单**：
- [ ] 4.1 创建 `QuestionImageHighlight.vue` 组件
- [ ] 4.2 实现图片渲染与缩放功能
- [ ] 4.3 实现高亮框定位与样式
- [ ] 4.4 添加交互控制（缩放、平移）
- [ ] 4.5 实现响应式布局适配
- [ ] 4.6 添加加载状态与错误处理

**验收标准**：
- 图片正确显示
- 高亮框位置准确
- 缩放功能正常
- 移动端适配良好

### Phase 5: 做题页面集成（预计 2-3 小时）

**任务清单**：
- [ ] 5.1 修改 `ExercisePractice.vue` 添加图片展示区域
- [ ] 5.2 实现图片懒加载
- [ ] 5.3 添加展开/收起图片的交互
- [ ] 5.4 处理无图片习题的情况
- [ ] 5.5 优化布局确保题目和图片都能良好展示

**验收标准**：
- 做题时能看到对应图片
- 高亮框正确指示当前题目
- 不影响现有答题功能

### Phase 6: 测试与优化（预计 2-3 小时）

**任务清单**：
- [ ] 6.1 编写单元测试（坐标计算函数）
- [ ] 6.2 编写集成测试（上传->识别->展示流程）
- [ ] 6.3 性能测试（大图片加载、多题目切换）
- [ ] 6.4 兼容性测试（不同浏览器、移动端）
- [ ] 6.5 用户体验优化（加载动画、过渡效果）

**验收标准**：
- 所有测试用例通过
- 页面加载时间 < 2秒
- 无明显性能问题

---

## 七、质量保证要求

### 7.1 坐标准确性指标

| 指标 | 目标值 | 测量方法 |
|-----|-------|---------|
| 水平位置偏差 | < 5% | 人工抽样对比 |
| 垂直位置偏差 | < 5% | 人工抽样对比 |
| 区域大小偏差 | < 10% | 人工抽样对比 |
| 无坐标识别率 | < 10% | 统计分析 |

### 7.2 性能基准

| 指标 | 目标值 | 测试条件 |
|-----|-------|---------|
| 图片首次加载 | < 1秒 | 2MB 图片 |
| 高亮框渲染 | < 100ms | 单次切换 |
| 缩放响应 | < 50ms | 用户交互 |
| 内存占用 | < 100MB | 10张图片 |

### 7.3 测试用例

```typescript
describe('QuestionImageHighlight', () => {
  // 坐标计算测试
  test('should calculate correct pixel coordinates', () => {
    const region = { x: 10, y: 20, width: 30, height: 15 }
    const result = calculatePixelCoordinates(region, 1000, 800)
    expect(result).toEqual({
      x: 100,
      y: 160,
      width: 300,
      height: 120
    })
  })
  
  // 边界值测试
  test('should handle edge cases for coordinates', () => {
    const region = { x: 0, y: 0, width: 100, height: 100 }
    // ...
  })
  
  // 缩放测试
  test('should scale coordinates correctly with zoom', () => {
    // ...
  })
})
```

---

## 八、交付物清单

### 8.1 源代码文件

| 文件路径 | 说明 |
|---------|-----|
| `src/config/types.ts` | 类型定义更新 |
| `src/services/image-storage.ts` | 图片存储服务更新 |
| `src/services/image-exercise-parser.ts` | VLM 提示词更新 |
| `src/components/QuestionImageHighlight.vue` | 新增：高亮显示组件 |
| `src/components/ExercisePractice.vue` | 做题组件更新 |
| `src/components/ImageExerciseUploader.vue` | 上传组件更新 |
| `src/pages/ParentPage.vue` | 家长页面更新 |

### 8.2 文档

| 文档 | 说明 |
|-----|-----|
| API 文档 | 新增函数和接口的使用说明 |
| 组件文档 | `QuestionImageHighlight` 组件的 Props、Events、Slots |
| 数据库迁移指南 | IndexedDB 版本升级说明 |

### 8.3 测试报告

- 单元测试覆盖率报告
- 集成测试结果
- 性能测试报告
- 兼容性测试报告

---

## 九、风险评估与应对

### 9.1 技术风险

| 风险 | 可能性 | 影响 | 应对措施 |
|-----|-------|-----|---------|
| VLM 坐标识别不准确 | 高 | 中 | 提供手动调整功能；优化提示词 |
| 大图片加载慢 | 中 | 中 | 实现渐进式加载；生成缩略图 |
| IndexedDB 存储满 | 低 | 高 | 实现自动清理；提示用户清理 |
| 移动端性能差 | 中 | 中 | 降低图片分辨率；延迟加载 |

### 9.2 用户体验风险

| 风险 | 可能性 | 影响 | 应对措施 |
|-----|-------|-----|---------|
| 高亮框位置偏移 | 中 | 中 | 允许用户手动调整 |
| 图片占用屏幕空间 | 高 | 低 | 提供折叠功能 |
| 多页试卷处理复杂 | 中 | 中 | 简化为单页；提示用户分页上传 |

---

## 十、后续优化方向

1. **手动调整功能**：允许用户手动调整高亮框位置
2. **多页试卷支持**：支持识别和展示多页试卷
3. **智能裁剪**：自动裁剪题目区域生成独立图片
4. **离线缓存**：使用 Service Worker 缓存图片资源
5. **批量处理**：支持批量上传和处理试卷图片
