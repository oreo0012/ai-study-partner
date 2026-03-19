<script setup lang="ts">
import type { EmotionType, Live2DExpressionParams } from '@/services/emotion'
import { EMOTION_MAPPINGS } from '@/services/emotion'
import { live2dCache } from '@/services/live2d-cache'
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useMouse } from '@vueuse/core'

interface Props {
  modelPath?: string
  scale?: number
  positionX?: number
  positionY?: number
  paused?: boolean
  preloadOnMount?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelPath: '/assets/live2d/hiyori_free_zh/runtime/hiyori_free_t08.model3.json',
  scale: 1,
  positionX: 0,
  positionY: 0,
  paused: false,
  preloadOnMount: true
})

const emit = defineEmits<{
  (e: 'loaded'): void
  (e: 'error', error: Error): void
}>()

const { x, y } = useMouse()
const isLoaded = ref(false)
const loadError = ref<string | null>(null)
const useFallback = ref(false)

const eyeOffset = computed(() => {
  if (!containerRef.value) return { x: 0, y: 0 }
  const rect = containerRef.value.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  return {
    x: Math.max(-10, Math.min(10, (x.value - centerX) / 30)),
    y: Math.max(-8, Math.min(8, (y.value - centerY) / 30))
  }
})

const containerRef = ref<HTMLElement | null>(null)

let model: any = null
let app: any = null
let PIXI: any = null

onMounted(async () => {
  try {
    await loadDependencies()
    await initModel()
    isLoaded.value = true
    emit('loaded')
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
    useFallback.value = true
    isLoaded.value = true
    emit('loaded')
  }
})

onUnmounted(() => {
  if (app) {
    app.destroy(true)
    app = null
    model = null
  }
})

async function loadScript(src: string, globalVar: string): Promise<boolean> {
  if ((window as any)[globalVar]) {
    return true
  }
  
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    
    document.head.appendChild(script)
    
    setTimeout(() => resolve(false), 10000)
  })
}

async function loadDependencies() {
  const cubismCoreUrl = '/assets/live2d/core/live2dcubismcore.min.js'
  
  const sources = [
    {
      pixi: 'https://cdn.jsdelivr.net/npm/pixi.js@7.x/dist/pixi.min.js',
      cubismCore: cubismCoreUrl,
      display: 'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js'
    },
    {
      pixi: 'https://unpkg.com/pixi.js@7.x/dist/pixi.min.js',
      cubismCore: cubismCoreUrl,
      display: 'https://unpkg.com/pixi-live2d-display@0.4.0/dist/cubism4.min.js'
    },
    {
      pixi: 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.x/pixi.min.js',
      cubismCore: cubismCoreUrl,
      display: 'https://cdnjs.cloudflare.com/ajax/libs/pixi-live2d-display/0.4.0/cubism4.min.js'
    }
  ]
  
  for (const source of sources) {
    const pixiLoaded = await loadScript(source.pixi, 'PIXI')
    if (!pixiLoaded) continue
    
    const cubismLoaded = await loadScript(source.cubismCore, 'Live2DCubismCore')
    if (!cubismLoaded) continue
    
    const displayLoaded = await loadScript(source.display, 'Live2D')
    if (!displayLoaded) continue
    
    PIXI = (window as any).PIXI
    return
  }
  
  throw new Error('Live2D核心库加载失败，使用占位符角色')
}

async function initModel() {
  const canvas = containerRef.value?.querySelector('canvas')
  if (!canvas || !PIXI) return

  const Live2DModel = (window as any).PIXI?.live2d?.Live2DModel
  
  if (!Live2DModel) {
    throw new Error('Live2D not loaded')
  }

  app = new PIXI.Application({
    view: canvas,
    width: canvas.clientWidth || 400,
    height: canvas.clientHeight || 600,
    backgroundAlpha: 0,
    autoStart: !props.paused,
    resolution: window.devicePixelRatio || 1,
  })

  try {
    const cachedModel = live2dCache.getCachedModel(props.modelPath)
    
    if (cachedModel) {
      model = cachedModel
    } else {
      model = await Live2DModel.from(props.modelPath, {
        autoInteract: false,
      })
      
      live2dCache.cacheModel(props.modelPath, model)
    }

    model.anchor.set(0.5, 0.5)
    model.scale.set(props.scale * 0.25)
    model.x = app.screen.width / 2 + props.positionX
    model.y = app.screen.height * 0.75 + props.positionY

    app.stage.addChild(model)
    
    if (model.motion) {
      model.motion('Idle')
    }
  } catch (error) {
    console.warn('Live2D model load failed:', error)
    throw error
  }
}

watch([x, y], ([mouseX, mouseY]) => {
  if (!model || !app) return

  const canvas = containerRef.value?.querySelector('canvas')
  if (!canvas) return
  
  const rect = canvas.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  const focusX = (mouseX - centerX) / rect.width
  const focusY = (mouseY - centerY) / rect.height

  if (model.focus) {
    model.focus(focusX, -focusY)
  }
})

watch(() => props.scale, (newScale) => {
  if (model) {
    model.scale.set(newScale * 0.25)
  }
})

watch(() => props.paused, (paused) => {
  if (app) {
    if (paused) {
      app.stop()
    } else {
      app.start()
    }
  }
})

function setExpression(expressionName: string) {
  if (!model) return
  if (model.expression) {
    model.expression(expressionName)
  }
}

function playMotion(group: string, index: number = 0) {
  if (!model) return
  if (model.motion) {
    model.motion(group, index)
  }
}

function speak(audioBuffer: ArrayBuffer) {
  if (!model) return
  if (model.speak) {
    model.speak(audioBuffer)
  }
}

function setExpressionByEmotion(emotion: EmotionType, intensity: number = 1.0) {
  if (!model) return
  
  const mapping = EMOTION_MAPPINGS[emotion]
  if (!mapping) return
  
  const params = mapping.params
  const duration = mapping.transitionDuration
  
  applyExpressionParams(params, intensity, duration)
}

function applyExpressionParams(params: Live2DExpressionParams, intensity: number = 1.0, duration: number = 300) {
  if (!model || !model.internalModel) return
  
  const coreModel = model.internalModel.coreModel
  if (!coreModel) return
  
  const clampedIntensity = Math.max(0, Math.min(1, intensity))
  
  for (const [paramName, value] of Object.entries(params)) {
    if (value === undefined) continue
    
    const paramId = paramName
    const targetValue = value * clampedIntensity
    
    try {
      const currentValue = coreModel.getParameterValueById(paramId)
      animateParameter(coreModel, paramId, currentValue, targetValue, duration)
    } catch {
      // Parameter may not exist on this model
    }
  }
}

function animateParameter(
  coreModel: any,
  paramId: string,
  fromValue: number,
  toValue: number,
  duration: number
) {
  const startTime = performance.now()
  
  function updateParameter(currentTime: number) {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    
    const easeProgress = 1 - Math.pow(1 - progress, 3)
    
    const currentValue = fromValue + (toValue - fromValue) * easeProgress
    
    try {
      coreModel.setParameterValueById(paramId, currentValue)
    } catch {
      return
    }
    
    if (progress < 1) {
      requestAnimationFrame(updateParameter)
    }
  }
  
  requestAnimationFrame(updateParameter)
}

function setMouthOpenY(value: number) {
  if (!model || !model.internalModel) return
  
  const coreModel = model.internalModel.coreModel
  if (!coreModel) return
  
  try {
    coreModel.setParameterValueById('ParamMouthOpenY', Math.max(0, Math.min(1, value)))
  } catch {
    // Parameter may not exist
  }
}

function resetExpression() {
  setExpressionByEmotion('neutral', 1.0)
}

defineExpose({
  setExpression,
  playMotion,
  speak,
  setExpressionByEmotion,
  setMouthOpenY,
  resetExpression,
  isLoaded
})
</script>

<template>
  <div ref="containerRef" class="live2d-stage relative w-full h-full">
    <!-- Live2D Canvas -->
    <canvas v-if="!useFallback" class="live2d-canvas w-full h-full" />
    
    <!-- CSS占位符角色 -->
    <div 
      v-else 
      class="character-fallback absolute inset-0 flex items-center justify-center"
      :style="{ transform: `scale(${scale}) translate(${positionX}px, ${positionY}px)` }"
    >
      <div class="character-container relative">
        <!-- 身体 -->
        <div class="body absolute rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600 shadow-lg" />
        
        <!-- 头部 -->
        <div class="head absolute rounded-full bg-gradient-to-b from-amber-300 to-amber-400 shadow-lg">
          <!-- 眼睛 -->
          <div class="eyes absolute flex gap-6">
            <div 
              class="eye left-eye relative"
              :style="{ transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)` }"
            >
              <div class="eye-white rounded-full bg-white" />
              <div class="eye-pupil rounded-full bg-slate-800" />
              <div class="eye-highlight rounded-full bg-white" />
            </div>
            <div 
              class="eye right-eye relative"
              :style="{ transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)` }"
            >
              <div class="eye-white rounded-full bg-white" />
              <div class="eye-pupil rounded-full bg-slate-800" />
              <div class="eye-highlight rounded-full bg-white" />
            </div>
          </div>
          
          <!-- 腮红 -->
          <div class="blush left-blush absolute rounded-full bg-pink-300 opacity-60" />
          <div class="blush right-blush absolute rounded-full bg-pink-300 opacity-60" />
          
          <!-- 嘴巴 -->
          <div class="mouth absolute rounded-full bg-rose-400" />
        </div>
        
        <!-- 手臂 -->
        <div class="arm left-arm absolute rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600" />
        <div class="arm right-arm absolute rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600" />
      </div>
    </div>
    
    <!-- 加载状态 -->
    <div 
      v-if="!isLoaded" 
      class="loading-overlay absolute inset-0 flex items-center justify-center bg-white/50"
    >
      <div class="loading-spinner i-carbon-circle-dash animate-spin text-4xl text-indigo-500" />
    </div>
  </div>
</template>

<style scoped>
.live2d-stage {
  background: transparent;
}

.live2d-canvas {
  display: block;
}

/* 占位符角色样式 */
.character-fallback {
  animation: float 3s ease-in-out infinite;
}

.character-container {
  width: 200px;
  height: 280px;
  position: relative;
}

.body {
  width: 120px;
  height: 160px;
  left: 40px;
  top: 100px;
}

.head {
  width: 140px;
  height: 140px;
  left: 30px;
  top: 0;
}

.eyes {
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
}

.eye {
  width: 28px;
  height: 28px;
}

.eye-white {
  width: 28px;
  height: 28px;
  position: absolute;
  top: 0;
  left: 0;
}

.eye-pupil {
  width: 14px;
  height: 14px;
  position: absolute;
  top: 7px;
  left: 7px;
}

.eye-highlight {
  width: 5px;
  height: 5px;
  position: absolute;
  top: 9px;
  left: 9px;
}

.blush {
  width: 24px;
  height: 16px;
  top: 75px;
}

.left-blush {
  left: 15px;
}

.right-blush {
  right: 15px;
}

.mouth {
  width: 20px;
  height: 10px;
  top: 95px;
  left: 50%;
  transform: translateX(-50%);
}

.arm {
  width: 30px;
  height: 80px;
}

.left-arm {
  left: 15px;
  top: 120px;
  transform: rotate(15deg);
  animation: wave-left 2s ease-in-out infinite;
}

.right-arm {
  right: 15px;
  top: 120px;
  transform: rotate(-15deg);
  animation: wave-right 2s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes wave-left {
  0%, 100% {
    transform: rotate(15deg);
  }
  50% {
    transform: rotate(20deg);
  }
}

@keyframes wave-right {
  0%, 100% {
    transform: rotate(-15deg);
  }
  50% {
    transform: rotate(-20deg);
  }
}
</style>
