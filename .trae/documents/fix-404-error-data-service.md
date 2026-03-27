# 修复家长管理页面添加任务功能 404 错误

## 问题分析

### 错误信息
```
POST http://localhost:3000/api/data/tasks 404 (Not Found)
Failed to save tasks: Error: Failed to post /api/data/tasks: 404 Not Found
```

### 问题根源

在 `data-service.ts` 中存在逻辑矛盾：

1. **读取数据**（第44-55行）：使用 `fetchJson` 访问静态文件 `/data/tasks.json` - ✅ 正确
2. **保存数据**（第57-66行）：使用 `postJson` 发送 POST 请求到 `/api/data/tasks` - ❌ 错误

**问题本质**：这是一个纯前端静态应用（Vue + Vite），没有后端API服务器。但保存数据时却使用了需要后端处理的 POST 请求到 `/api/data/tasks`，导致 404 错误。

## 解决方案

### 方案选择

由于是纯前端静态应用，无法直接写文件到服务器。有两种可行方案：

| 方案 | 优点 | 缺点 |
|------|------|------|
| **方案A: localStorage** | 简单快速，无需后端，可立即使用 | 数据仅存储在浏览器本地，不同设备不同步 |
| **方案B: 后端API服务** | 数据可同步，支持多设备 | 需要部署额外服务，开发复杂度高 |

**推荐方案A**：使用 localStorage 作为数据持久化方案，简单可靠，适合儿童学习场景（通常单设备使用）。

## 实施步骤

### Step 1: 修改 data-service.ts

将所有保存操作（saveTasks、saveExercises、saveMemory）从 POST 请求改为使用 localStorage：

1. 创建 localStorage 辅助函数
2. 修改 `saveTasks()` 使用 localStorage
3. 修改 `saveExercises()` 使用 localStorage
4. 修改 `saveMemory()` 使用 localStorage
5. 移除对不存在 API 端点的依赖

### Step 2: 验证修改

1. 运行 `npm run dev` 启动开发服务器
2. 访问家长页面 `/parent`
3. 尝试添加新任务
4. 确认控制台无 404 错误
5. 确认任务成功保存并显示在列表中

### Step 3: 测试完整流程

1. 创建任务 → 验证保存成功
2. 编辑任务 → 验证更新成功
3. 删除任务 → 验证删除成功
4. 刷新页面 → 验证数据持久化

## 具体代码修改

### 修改文件: `apps/web/src/services/data-service.ts`

**变更点1**: 添加 localStorage 辅助函数
```typescript
const STORAGE_KEYS = {
  tasks: 'ai_study_tasks',
  exercises: 'ai_study_exercises',
  memory: 'ai_study_memory'
}
```

**变更点2**: 修改 saveTasks
```typescript
export async function saveTasks(data: TasksData): Promise<boolean> {
  try {
    data.lastUpdated = getCurrentTimestamp()
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(data))
    return true
  } catch (error) {
    console.error('Failed to save tasks:', error)
    return false
  }
}
```

**变更点3**: 修改 loadTasks
```typescript
export async function loadTasks(): Promise<TasksData> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.tasks)
    if (stored) {
      return JSON.parse(stored)
    }
    const data = await fetchJson<TasksData>(`${DATA_BASE_URL}/tasks.json`)
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(data))
    return data
  } catch (error) {
    console.error('Failed to load tasks:', error)
    return {
      tasks: [],
      lastUpdated: getCurrentTimestamp()
    }
  }
}
```

**变更点4**: 同样修改 saveExercises、loadExercises、saveMemory、loadMemory

## 预期结果

修复后：
- 添加任务时使用 localStorage 保存数据
- 无 404 错误
- 数据在浏览器刷新后仍然保留
- 功能与原设计一致（任务创建、编辑、删除、筛选）
