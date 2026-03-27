# 试卷上传后显示为空问题排查计划

## 问题概述

在家长页面上传试卷文档后，提交上传操作完成，但在儿童聊天界面进行答题时，试卷内容显示为空。

## 排查发现

### 1. 文件上传流程分析

**涉及文件：**
- [ParentPage.vue](d:\AiPorject\AiStudyPartner\apps\web\src\pages\ParentPage.vue)
- [ExerciseUploader.vue](d:\AiPorject\AiStudyPartner\apps\web\src\components\ExerciseUploader.vue)
- [exercise-parser.ts](d:\AiPorject\AiStudyPartner\apps\web\src\services\exercise-parser.ts)

**流程：**
1. 用户在家长页面上传 `.txt` 文件
2. ExerciseUploader 组件调用 `parseExerciseDocument` 解析文件内容
3. 解析成功后触发 `@upload` 事件，传递 `ParsedExercise[]`
4. ParentPage 的 `handleExerciseUpload` 方法接收数据
5. 调用 `addExercises(exercisesToAdd)` 保存到 localStorage

**代码位置：**
- ParentPage.vue 第139-178行：处理上传逻辑
- ExerciseUploader.vue 第115-128行：确认上传逻辑

**验证结果：** ✅ 文件上传流程完整，解析逻辑正确

### 2. 数据存储机制分析

**涉及文件：**
- [data-service.ts](d:\AiPorject\AiStudyPartner\apps\web\src\services\data-service.ts)

**存储逻辑：**
```typescript
// 第159-173行：addExercises 函数
export async function addExercises(exercises: Omit<Exercise, 'id'>[]): Promise<Exercise[]> {
  try {
    const exercisesData = await loadExercises()  // 先加载现有数据
    const newExercises: Exercise[] = exercises.map(e => ({
      ...e,
      id: generateId()
    }))
    exercisesData.exercises.push(...newExercises)  // 追加新习题
    const success = await saveExercises(exercisesData)  // 保存到 localStorage
    return success ? newExercises : []
  } catch (error) {
    console.error('Failed to add exercises:', error)
    return []
  }
}
```

**存储位置：**
- localStorage key: `ai_study_exercises`
- 数据格式：`{ exercises: Exercise[], lastUpdated: string }`

**验证结果：** ✅ 数据存储逻辑正确

### 3. 数据传递机制分析

**涉及文件：**
- [PracticePage.vue](d:\AiPorject\AiStudyPartner\apps\web\src\pages\PracticePage.vue)
- [data-service.ts](d:\AiPorject\AiStudyPartner\apps\web\src\services\data-service.ts)

**问题发现：**

PracticePage.vue 第35-51行的数据加载逻辑：

```typescript
onMounted(async () => {
  isLoading.value = true
  try {
    // ❌ 问题所在：直接从静态文件加载，忽略 localStorage
    const data = await fetch('/data/exercises.json')
    const json = await data.json()
    exercises.value = json.exercises || []
    // ...
  } catch (error) {
    console.error('Failed to load exercises:', error)
  } finally {
    isLoading.value = false
  }
})
```

**对比 data-service.ts 的正确逻辑：**

```typescript
// 第130-146行：loadExercises 函数
export async function loadExercises(): Promise<ExercisesData> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.exercises)
    if (stored) {
      return JSON.parse(stored)  // ✅ 优先从 localStorage 加载
    }
    const data = await fetchJson<ExercisesData>(`${DATA_BASE_URL}/exercises.json`)
    localStorage.setItem(STORAGE_KEYS.exercises, JSON.stringify(data))
    return data
  } catch (error) {
    console.error('Failed to load exercises:', error)
    return {
      exercises: [],
      lastUpdated: getCurrentTimestamp()
    }
  }
}
```

**根本原因：**
- PracticePage.vue 直接使用 `fetch('/data/exercises.json')` 加载习题
- 没有使用 data-service 提供的 `loadExercises()` 函数
- 导致只加载静态文件中的习题，完全忽略了 localStorage 中用户上传的习题

**验证结果：** ❌ 数据传递机制存在严重问题

### 4. 界面渲染逻辑分析

**涉及文件：**
- [PracticePage.vue](d:\AiPorject\AiStudyPartner\apps\web\src\pages\PracticePage.vue)
- [ExercisePractice.vue](d:\AiPorject\AiStudyPartner\apps\web\src\components\ExercisePractice.vue)

**渲染逻辑：**
- PracticePage.vue 第109-127行：显示习题概览
- 第122行：`{{ exercises.length > 0 ? '开始练习' : '暂无习题' }}`
- 由于 `exercises.value` 为空（因为从静态文件加载失败），显示"暂无习题"

**验证结果：** ⚠️ 渲染逻辑正常，但数据源有问题

## 解决方案

### 修复步骤

#### 步骤1：修改 PracticePage.vue 的数据加载逻辑

**修改位置：** PracticePage.vue 第35-51行

**修改前：**
```typescript
onMounted(async () => {
  isLoading.value = true
  try {
    const data = await fetch('/data/exercises.json')
    const json = await data.json()
    exercises.value = json.exercises || []
    await taskStore.loadTodayTasks()
    const practiceTask = taskStore.todayTasks.find(t => t.type === '练习')
    if (practiceTask) {
      await taskStore.completeTask(practiceTask.id)
    }
  } catch (error) {
    console.error('Failed to load exercises:', error)
  } finally {
    isLoading.value = false
  }
})
```

**修改后：**
```typescript
import { loadExercises } from '@/services/data-service'

onMounted(async () => {
  isLoading.value = true
  try {
    // 使用 data-service 的 loadExercises 函数
    // 它会优先从 localStorage 加载用户上传的习题
    const exercisesData = await loadExercises()
    exercises.value = exercisesData.exercises || []
    
    await taskStore.loadTodayTasks()
    const practiceTask = taskStore.todayTasks.find(t => t.type === '练习')
    if (practiceTask) {
      await taskStore.completeTask(practiceTask.id)
    }
  } catch (error) {
    console.error('Failed to load exercises:', error)
  } finally {
    isLoading.value = false
  }
})
```

#### 步骤2：验证修复效果

1. 在家长页面上传试卷文件
2. 检查 localStorage 中是否保存了习题数据
3. 在儿童聊天界面点击练习任务
4. 验证习题是否正确显示

## 测试验证

### 测试用例1：上传新试卷

**步骤：**
1. 打开家长页面
2. 上传 `2026二年级数学寒假作业_每日一练_第1天.txt`
3. 确认上传成功提示
4. 打开浏览器开发者工具，检查 localStorage
5. 验证 `ai_study_exercises` 键中是否包含习题数据

**预期结果：** localStorage 中应包含解析后的习题数据

### 测试用例2：显示上传的习题

**步骤：**
1. 切换到儿童聊天界面
2. 点击今日任务中的练习任务
3. 验证习题页面是否显示上传的习题

**预期结果：** 应显示"共识别到 X 道题目"，并能开始练习

### 测试用例3：混合数据源

**步骤：**
1. 确认 public/data/exercises.json 中有默认习题
2. 上传新试卷
3. 验证是否同时显示默认习题和上传的习题

**预期结果：** 应显示所有习题（默认 + 上传）

## 附加改进建议

### 改进1：添加数据同步提示

在 PracticePage.vue 中添加数据加载状态提示：

```typescript
const loadingMessage = computed(() => {
  if (isLoading.value) return '加载习题中...'
  if (exercises.value.length === 0) return '暂无习题，请让家长上传试卷'
  return `已加载 ${exercises.value.length} 道习题`
})
```

### 改进2：优化习题管理

建议添加习题管理功能：
- 查看已上传的习题列表
- 删除不需要的习题
- 清空所有习题

### 改进3：数据持久化备份

建议定期将 localStorage 数据备份到服务器或文件：
- 避免数据丢失
- 支持多设备同步

## 总结

**问题根源：** PracticePage.vue 直接从静态文件加载习题，忽略了 localStorage 中用户上传的数据

**解决方案：** 使用 data-service 提供的 `loadExercises()` 函数，它会优先从 localStorage 加载用户数据

**修复难度：** 低（只需修改一个函数调用）

**影响范围：** 仅影响 PracticePage.vue 的数据加载逻辑，不影响其他功能
