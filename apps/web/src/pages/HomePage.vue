<script setup lang="ts">
import type { EmotionType } from '@/services/emotion'
import type { LipSyncResult } from '@/services/lipsync'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useConfigStore, useChatStore, useLive2dStore } from '@/stores'
import { Live2DStage, ChatArea } from '@/components'
import { useLipSync } from '@/composables/useLipSync'

const configStore = useConfigStore()
const chatStore = useChatStore()
const live2dStore = useLive2dStore()
const { updateLipSync, resetLipSync } = useLipSync()

const isLoading = ref(true)
const loadError = ref<string | null>(null)
const live2dRef = ref<InstanceType<typeof Live2DStage> | null>(null)

onMounted(async () => {
  try {
    await configStore.load()
    if (configStore.live2dConfig) {
      live2dStore.modelPath = configStore.live2dConfig.modelPath
      live2dStore.setScale(configStore.live2dConfig.scale)
      live2dStore.setPosition(configStore.live2dConfig.positionX, configStore.live2dConfig.positionY)
    }
    
    chatStore.setEmotionCallback(handleEmotionChange)
    chatStore.setTTSCallback(handleLipSync)
    chatStore.initTTSService()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '加载配置失败'
    console.error('Failed to load config:', error)
  } finally {
    isLoading.value = false
  }
})

onUnmounted(() => {
  chatStore.setEmotionCallback(null)
  chatStore.setTTSCallback(null)
  resetLipSync()
})

function handleLive2DLoaded() {
  live2dStore.isLoaded = true
}

function handleLive2DError(error: Error) {
  console.error('Live2D load error:', error)
}

function handleEmotionChange(emotion: EmotionType, intensity: number) {
  if (live2dRef.value && live2dRef.value.isLoaded) {
    live2dRef.value.setExpressionByEmotion(emotion, intensity)
  }
}

function handleLipSync(result: LipSyncResult) {
  updateLipSync(result)
  if (live2dRef.value && live2dRef.value.isLoaded) {
    live2dRef.value.setMouthOpenY(result.mouthOpenY)
  }
}

watch(() => chatStore.currentEmotion, (newEmotion) => {
  if (live2dRef.value && live2dRef.value.isLoaded) {
    live2dRef.value.setExpressionByEmotion(newEmotion, 1.0)
  }
})
</script>

<template>
  <div class="home-page relative w-screen h-screen overflow-hidden bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
    <!-- 加载状态 -->
    <div
      v-if="isLoading"
      class="loading-overlay absolute inset-0 flex items-center justify-center z-50 bg-white/80"
    >
      <div class="loading-content text-center">
        <div class="i-carbon-circle-dash animate-spin text-5xl text-indigo-500 mb-4" />
        <p class="text-lg text-gray-600">正在加载AI学伴...</p>
      </div>
    </div>

    <!-- 配置错误提示 -->
    <div
      v-else-if="loadError"
      class="error-overlay absolute inset-0 flex items-center justify-center z-50"
    >
      <div class="error-content text-center p-8 bg-white rounded-2xl shadow-xl max-w-md mx-4">
        <div class="i-carbon-warning-alt text-5xl text-red-500 mb-4" />
        <h2 class="text-xl font-bold text-gray-800 mb-2">配置加载失败</h2>
        <p class="text-gray-600 mb-4">{{ loadError }}</p>
        <p class="text-sm text-gray-400">
          请检查 <code class="bg-gray-100 px-2 py-1 rounded">public/config.json</code> 文件是否正确配置
        </p>
      </div>
    </div>

    <!-- 主界面 -->
    <template v-else>
      <!-- 顶部标题栏 -->
      <header class="header absolute top-0 left-0 right-0 z-10 p-4">
        <div class="title-bar flex items-center justify-between">
          <div class="app-title flex items-center gap-3">
            <div class="logo w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
              <span class="text-white text-xl">📚</span>
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-800">AI学伴</h1>
              <p class="text-xs text-gray-500">{{ configStore.characterConfig?.name || '小伴' }} · 儿童学习助手</p>
            </div>
          </div>
          <div class="status flex items-center gap-2">
            <div
              class="status-dot w-2 h-2 rounded-full"
              :class="configStore.isConfigured ? 'bg-green-500' : 'bg-yellow-500'"
            />
            <span class="text-xs text-gray-500">
              {{ configStore.isConfigured ? '已连接' : '未配置' }}
            </span>
          </div>
        </div>
      </header>

      <!-- 主内容区域 -->
      <div class="main-content flex h-full pt-16">
        <!-- Live2D 角色区域 -->
        <div class="character-area flex-1 relative">
          <Live2DStage
            ref="live2dRef"
            :model-path="live2dStore.modelPath"
            :scale="live2dStore.scale"
            :position-x="live2dStore.positionX"
            :position-y="live2dStore.positionY"
            @loaded="handleLive2DLoaded"
            @error="handleLive2DError"
          />
        </div>

        <!-- 聊天区域 -->
        <div class="chat-area-wrapper w-full md:w-96 h-full bg-white/80 backdrop-blur-sm shadow-lg">
          <ChatArea />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.home-page {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }

  .character-area {
    height: 40%;
  }

  .chat-area-wrapper {
    height: 60%;
    width: 100% !important;
  }
}
</style>
