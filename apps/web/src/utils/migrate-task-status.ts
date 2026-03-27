import { loadTasks, saveTasks } from '@/services/data-service'

export async function migrateTaskStatus(): Promise<void> {
  try {
    const tasksData = await loadTasks()
    
    let migrated = false
    
    tasksData.tasks.forEach(task => {
      if (task.status === '待完成' || task.status === '进行中') {
        task.status = '未完成'
        migrated = true
      }
    })
    
    if (migrated) {
      await saveTasks(tasksData)
      console.log('[迁移] 任务状态迁移完成')
    } else {
      console.log('[迁移] 无需迁移任务状态')
    }
  } catch (error) {
    console.error('[迁移] 任务状态迁移失败:', error)
  }
}
