<script setup lang="ts">
import { onMounted } from 'vue'
import { cleanupExpiredExercises, archiveCompletedExercises } from '@/services/data-service'

onMounted(async () => {
  try {
    await cleanupExpiredExercises()
    await archiveCompletedExercises()
    console.log('[App] Exercise cleanup and archive completed on startup')
  } catch (error) {
    console.error('[App] Failed to cleanup/archive exercises:', error)
  }
})
</script>

<template>
  <div class="app-container" min-h-screen>
    <router-view />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app-container {
  width: 100%;
  height: 100vh;
}
</style>
