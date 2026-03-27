# 儿童聊天主页任务展示模块实施计划

## 一、需求概述

在儿童聊天主页（HomePage.vue → ChatArea.vue）中添加任务展示模块，位于聊天信息流区域和输入区域之间。

## 二、界面交互设计

### 2.1 整体布局结构

```
┌─────────────────────────────────────────────────────────┐
│  ChatArea.vue                                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  messages-container (flex-1 overflow-y-auto p-4)│   │
│  │                                                 │   │
│  │  [聊天消息列表...]                              │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  TaskPanel.vue (新增组件)                       │   │
│  │  仅当今日有任务时显示                           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  input-area (p-4)                               │   │
│  │  [输入框] [发送按钮] [语音按钮]                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.2 收缩状态设计

```
┌─────────────────────────────────────────────────────────┐
│  📋 今日学习任务已完成 1/5                    【展开】  │
└─────────────────────────────────────────────────────────┘

样式规范：
- 背景：bg-gradient-to-r from-amber-50 to-yellow-50
- 边框：border border-amber-200
- 圆角：rounded-xl
- 内边距：px-4 py-3
- 高度：固定约48px
- 阴影：shadow-sm
- 宽度：与上下区域一致（继承父容器宽度）
- 外边距：mx-4 mb-2（与输入区域间距一致）
```

### 2.3 展开状态设计

```
┌─────────────────────────────────────────────────────────┐
│  📋 今日任务                                 【收起】  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ☐ 1. 语文阅读                        30分钟    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ☑ 2. 语文听写                        20分钟    │   │
│  │     ✓ 已完成                                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ☐ 3. 数学自主练习            【开始】  45分钟  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│  进度：1/5 完成 (20%)  ████████░░░░░░░░░░░░░░░░░░░░░░  │
│                                                         │
└─────────────────────────────────────────────────────────┘

样式规范：
- 背景：bg-gradient-to-r from-amber-50 to-yellow-50
- 边框：border border-amber-200
- 圆角：rounded-xl
- 内边距：p-4
- 高度：自适应（根据任务数量）
- 阴影：shadow-md
- 过渡动画：transition-all duration-300 ease-in-out
```

### 2.4 任务项设计

#### 未完成任务
```
┌─────────────────────────────────────────────────────────┐
│  ☐ 1. 语文阅读                               30分钟    │
└─────────────────────────────────────────────────────────┘

样式：
- 背景：bg-white/60 hover:bg-white/80
- 边框：border border-gray-200
- 圆角：rounded-lg
- 内边距：px-3 py-2
- 复选框：w-5 h-5 border-2 border-gray-300 rounded cursor-pointer
- 悬停效果：hover:border-amber-300 hover:shadow-sm
```

#### 已完成任务
```
┌─────────────────────────────────────────────────────────┐
│  ☑ 2. 语文听写                               20分钟    │
│     ✓ 已完成                                           │
└─────────────────────────────────────────────────────────┘

样式：
- 背景：bg-green-50/60
- 边框：border border-green-200
- 文字颜色：text-gray-500 (任务名划线)
- 复选框：bg-green-500 border-green-500
- 完成标记：text-green-600 text-sm
```

#### 练习任务（带开始按钮）
```
┌─────────────────────────────────────────────────────────┐
│  ☐ 3. 数学自主练习          【开始】       45分钟      │
└─────────────────────────────────────────────────────────┘

样式：
- 开始按钮：
  - 背景：bg-gradient-to-r from-orange-400 to-amber-500
  - 文字：text-white text-sm font-medium
  - 圆角：rounded-full
  - 内边距：px-4 py-1
  - 悬停：hover:from-orange-500 hover:to-amber-600
  - 阴影：shadow-sm hover:shadow-md
  - 过渡：transition-all duration-200
```

### 2.5 交互元素设计

#### 展开/收起按钮
```
收缩状态：【展开 ▼】
展开状态：【收起 ▲】

样式：
- 背景：bg-amber-100 hover:bg-amber-200
- 文字：text-amber-700 text-sm font-medium
- 圆角：rounded-lg
- 内边距：px-3 py-1
- 过渡：transition-colors duration-200
- 光标：cursor-pointer
```

#### 复选框交互
```
未选中：☐ (border-2 border-gray-300)
悬停：  ☐ (border-amber-400 bg-amber-50)
选中：  ☑ (bg-green-500 border-green-500)
动画：  缩放动画 scale-95 → scale-100
```

#### 开始按钮交互
```
默认：橙色渐变背景
悬停：加深渐变 + 阴影增强
点击：缩放效果 scale-95
禁用：opacity-50 cursor-not-allowed
```

### 2.6 过渡动画

```
收缩 → 展开：
- 高度：从固定高度过渡到自适应高度
- 内容：淡入显示 (opacity 0 → 1)
- 时长：300ms
- 缓动：ease-in-out

展开 → 收缩：
- 内容：淡出隐藏 (opacity 1 → 0)
- 高度：从自适应高度过渡到固定高度
- 时长：300ms
- 缓动：ease-in-out
```

### 2.7 响应式设计

```
桌面端 (≥768px)：
- 任务模块宽度：与聊天区域一致
- 任务项：单列显示

移动端 (<768px)：
- 任务模块宽度：100%
- 任务项：单列显示
- 字号略微缩小
```

## 三、技术实现方案

### 3.1 新建组件文件

**文件路径**: `apps/web/src/components/TaskPanel.vue`

### 3.2 组件Props定义

```typescript
interface Props {
  tasks: Task[]          // 今日任务列表
  completedCount: number // 已完成数量
  totalCount: number     // 总数量
}
```

### 3.3 组件Emits定义

```typescript
interface Emits {
  (e: 'task-complete', taskId: string): void    // 任务完成事件
  (e: 'start-practice', taskId: string): void   // 开始练习事件
}
```

### 3.4 状态管理

```typescript
// 组件内部状态
const isExpanded = ref(false)        // 展开/收缩状态
const isAnimating = ref(false)       // 动画进行中

// 计算属性
const hasTasks = computed(() => props.totalCount > 0)
const progressPercent = computed(() => 
  props.totalCount > 0 
    ? Math.round((props.completedCount / props.totalCount) * 100) 
    : 0
)
```

### 3.5 修改ChatArea.vue

在 `messages-container` 和 `input-area` 之间插入 `TaskPanel` 组件：

```vue
<template>
  <div class="chat-area flex flex-col h-full">
    <!-- 聊天消息区域 -->
    <div ref="messagesContainer" class="messages-container flex-1 overflow-y-auto p-4">
      <!-- 消息内容 -->
    </div>
    
    <!-- 任务展示模块（新增） -->
    <TaskPanel
      v-if="hasTodayTasks"
      :tasks="todayTasks"
      :completed-count="completedCount"
      :total-count="totalCount"
      @task-complete="handleTaskComplete"
      @start-practice="handleStartPractice"
    />
    
    <!-- 输入区域 -->
    <div class="input-area p-4">
      <ChatInput ... />
    </div>
  </div>
</template>
```

## 四、实施步骤

### Step 1: 创建 TaskPanel.vue 组件
- 实现收缩/展开状态切换
- 实现任务列表展示
- 实现复选框交互
- 实现开始按钮
- 实现进度条

### Step 2: 修改 ChatArea.vue
- 引入 TaskPanel 组件
- 添加任务数据获取逻辑
- 添加事件处理函数
- 调整布局结构

### Step 3: 添加路由跳转
- 点击"开始"按钮跳转到 `/practice` 页面
- 传递任务ID参数

### Step 4: 验证构建
- 运行 `npm run build` 确认无错误
- 测试收缩/展开动画
- 测试任务完成状态切换
- 测试开始练习跳转

## 五、验收标准

- [ ] 当日无任务时，模块完全隐藏
- [ ] 收缩状态正确显示进度概览
- [ ] 展开状态正确显示任务详情
- [ ] 展开/收起动画平滑流畅
- [ ] 复选框点击可切换任务状态
- [ ] "开始"按钮可跳转到练习页面
- [ ] 已完成任务有明显的视觉区分
- [ ] 宽度与上下区域一致
- [ ] 响应式布局正常工作
