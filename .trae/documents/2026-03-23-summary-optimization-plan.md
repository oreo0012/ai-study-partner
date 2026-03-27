# 问题排查与优化计划

---

## 一、问题分析

### 问题1：控制台报错

**错误信息：**
```
Immersive Translate WARN: [translate-sentences] query cache DB error, but it's ok DeadlineError: Deadline 
    at content_script.js:4656:2560 
```

**原因分析：**
- 这是 **Immersive Translate（沉浸式翻译）** 浏览器插件的错误
- 错误来自插件的 content_script.js，是插件内部缓存数据库的问题
- **对业务功能没有影响**，这是第三方浏览器扩展的问题

**结论：** 无需处理，可忽略此错误

---

### 问题2：总结当日只能使用一次

**当前逻辑：**
1. 组件加载时检查长期记忆是否存在当天的总结 → 设置 `hasTodaySummary`
2. 点击"总结当日"按钮后：
   - 获取短期记忆中的消息和练习数据
   - 调用 LLM 生成总结
   - 保存到长期记忆（覆盖当天的旧记录）
   - **清除短期记忆**（问题根源）
3. 由于短期记忆被清除，当日无法再次总结

**影响：**
- 用户当日无法进行多次总结
- 不便于功能测试
- 次日系统也不会自动检测未总结的短期记忆

---

## 二、方案评估

### 方案A：增量更新机制（优先选择）

**核心思路：** 不限制总结次数，支持当日多次调用智能合并更新，设计完善的短期记忆清除机制

**技术可行性：** ✅ 可行

---

### 短期记忆清除机制设计

#### 数据结构扩展

```typescript
interface ShortTermMemoryData {
  // ... 现有字段
  status: 'pending' | 'summarized'    // 总结状态：pending=未总结，summarized=已总结
  summaryDate?: string                 // 最后总结时间（ISO格式）
}
```

#### 完整闭环逻辑

```
┌─────────────────────────────────────────────────────────────────┐
│                        应用启动                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              检测短期记忆日期是否为今天                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌────────┴────────┐
                    ↓                 ↓
            不是今天               是今天
                ↓                     ↓
    ┌───────────────────────┐   正常加载使用
    │ 检查 status 字段       │
    └───────────────────────┘
            ↓           ↓
     status='pending'  status='summarized'
     (有未总结内容)     (已总结完成)
            ↓               ↓
    ┌─────────────────┐  直接清除
    │ 自动调用LLM      │  该短期记忆
    │ 进行总结         │
    └─────────────────┘
            ↓
    更新对应日期的长期记忆
    （增量合并）
            ↓
    标记为 status='summarized'
            ↓
    清除该短期记忆
            ↓
┌─────────────────────────────────────────────────────────────────┐
│                  初始化今日短期记忆                               │
└─────────────────────────────────────────────────────────────────┘
```

#### 闭环验证

| 场景 | 处理方式 | 结果 |
|------|---------|------|
| 当日首次总结 | 生成总结 → 保存长期记忆 → 标记 `summarized` | ✅ 不清除短期记忆 |
| 当日增量总结 | 合并总结 → 更新长期记忆 → 更新 `summaryDate` | ✅ 短期记忆保留 |
| 次日启动（有未总结内容） | 自动总结 → 更新昨日长期记忆 → 清除 | ✅ 无数据丢失 |
| 次日启动（已总结） | 直接清除旧短期记忆 | ✅ 释放存储空间 |
| 多日未使用 | 依次处理每天的记忆 | ✅ 历史数据完整保存 |

---

### 方案B：测试开关（备用）

**核心思路：** 添加一个本地开关，开启后允许无限调用

**技术可行性：** ✅ 简单

**缺点：**
- 功能受限，非测试用户也会受限
- 不够优雅
- 没有解决根本问题

**复杂度：** 低

---

## 三、方案选择

**选择方案A**，理由：
1. 功能更完善，符合实际需求
2. 用户体验更好，不限制使用次数
3. **系统自动处理，用户无感**
4. 数据完整性好，无丢失风险
5. 形成完美闭环

---

## 四、实施任务

### Task 1: 扩展短期记忆数据结构

**文件：** `apps/web/src/config/types.ts`

**操作：**
```typescript
export type MemoryStatus = 'pending' | 'summarized'

export interface ShortTermMemoryData {
  date: string
  userId: string
  messages: ChatMessage[]
  metadata: ShortTermMemoryMetadata
  practiceSummaries?: PracticeSummary[]
  status: MemoryStatus              // 新增：总结状态
  summaryDate?: string              // 新增：最后总结时间
  createdAt: string
  lastUpdated: string
}
```

---

### Task 2: 修改短期记忆服务

**文件：** `apps/web/src/services/short-term-memory.ts`

**操作：**

1. 修改 `createEmptyMemory` 函数，初始化 `status: 'pending'`

2. 新增方法：
   ```typescript
   // 标记为已总结
   async markAsSummarized(): Promise<boolean>
   
   // 获取自上次总结后的新消息数量
   async getNewContentCountAfterSummary(): Promise<{ messages: number, practices: number }>
   
   // 检查是否有未总结的内容
   async hasUnsummarizedContent(): Promise<boolean>
   ```

3. 修改 `clear` 方法，不再直接清除，而是由启动检测逻辑控制

---

### Task 3: 创建启动检测服务

**文件：** `apps/web/src/services/memory-startup-check.ts`（新建）

**操作：**
```typescript
export class MemoryStartupCheckService {
  // 检查并处理非今日的短期记忆
  async checkAndProcessMemory(llmCallFn?: Function): Promise<void>
  
  // 处理单个非今日记忆
  private async processNonTodayMemory(memory: ShortTermMemoryData, llmCallFn?: Function): Promise<void>
  
  // 自动总结未总结的记忆
  private async autoSummarize(memory: ShortTermMemoryData, llmCallFn?: Function): Promise<void>
}

export const memoryStartupCheckService = new MemoryStartupCheckService()
```

---

### Task 4: 修改长期记忆服务

**文件：** `apps/web/src/services/long-term-memory.ts`

**操作：**

1. 新增方法：
   ```typescript
   // 获取指定日期的总结
   async getSummaryByDate(date: string): Promise<DailySummary | null>
   
   // 更新指定日期的总结（增量合并）
   async updateSummaryByDate(date: string, summary: DailySummary): Promise<boolean>
   ```

---

### Task 5: 增强提示词模板

**文件：** `apps/web/src/services/memory-archive.ts`

**操作：**

1. 新增增量总结提示词：
   ```typescript
   const INCREMENTAL_SUMMARY_PROMPT = `你是一个专业的学习分析助手，负责将新增的学习内容与已有的每日总结进行合并更新。

请根据已有的总结和新增内容，生成一个完整的学习总结...

【已有总结】
{existingSummary}

【新增内容】
{newContent}

请合并生成完整的JSON格式学习总结。`
   ```

2. 新增方法：
   ```typescript
   // 生成增量总结
   async generateIncrementalSummary(
     existingSummary: DailySummary,
     newMessages: ChatMessage[],
     newPractices: PracticeSummary[],
     llmCallFn: Function
   ): Promise<DailySummary>
   ```

---

### Task 6: 修改 DailyLearningReport 组件

**文件：** `apps/web/src/components/DailyLearningReport.vue`

**操作：**

1. 修改按钮逻辑：
   ```typescript
   // 按钮状态计算
   const buttonState = computed(() => {
     if (isSummarizing.value) return { text: '总结中...', disabled: true }
     if (todayMessageCount.value === 0 && todayPracticeCount.value === 0) {
       return { text: '暂无内容', disabled: true }
     }
     if (hasTodaySummary.value) {
       // 检查是否有新内容
       if (hasNewContent.value) {
         return { text: '更新总结', disabled: false }
       }
       return { text: '今日已总结', disabled: true }
     }
     return { text: '总结当日', disabled: false }
   })
   ```

2. 修改 `handleSummarizeToday` 方法：
   - 区分首次总结和增量更新
   - 总结后调用 `markAsSummarized()` 而非 `clear()`

---

### Task 7: 在应用启动时调用检测

**文件：** `apps/web/src/pages/HomePage.vue` 或 `apps/web/src/App.vue`

**操作：**
```typescript
import { memoryStartupCheckService } from '@/services/memory-startup-check'

onMounted(async () => {
  // 执行启动检测
  await memoryStartupCheckService.checkAndProcessMemory(callLLM)
  
  // 其他初始化...
})
```

---

### Task 8: 验证与测试

**操作：**
1. 运行 `npm run build` 检查编译
2. 手动测试场景：
   - 当日首次总结
   - 当日增量更新总结
   - 模拟次日启动（修改日期）检测未总结记忆
   - 模拟次日启动检测已总结记忆

---

## 五、预期效果

### 用户视角

1. **当日使用**
   - 随时可点击"总结当日"或"更新总结"
   - 每次总结都会合并所有内容
   - 无需担心数据丢失

2. **次日启动**
   - 系统自动处理昨日记忆
   - 无需任何操作
   - 历史数据完整保存

### 按钮状态

| 条件 | 按钮文字 | 可点击 |
|------|---------|--------|
| 当日无内容 | 暂无内容 | ❌ |
| 当日首次总结 | ✨ 总结当日 | ✅ |
| 当日已总结，有新内容 | 🔄 更新总结 | ✅ |
| 当日已总结，无新内容 | ✅ 今日已总结 | ❌ |

### 数据流向

```
当日学习 → 短期记忆(pending) → 点击总结 → 长期记忆 → 短期记忆(summarized)
    ↓                                                           ↓
继续学习 → 短期记忆(追加内容) → 点击更新 → 长期记忆(合并) → 短期记忆(summarized)
    ↓
次日启动 → 检测到非今日+summarized → 清除短期记忆 → 初始化今日记忆
```
