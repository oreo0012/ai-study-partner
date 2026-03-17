import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLive2dStore = defineStore('live2d', () => {
  const scale = ref(1)
  const positionX = ref(0)
  const positionY = ref(0)
  const currentMotion = ref<{ group: string; index: number }>({ group: 'Idle', index: 0 })
  const currentExpression = ref<string>('')
  
  const availableMotions = ref<string[]>([
    'Idle',
    'TapBody',
    'PinchIn',
    'PinchOut',
    'Shake',
  ])
  
  const availableExpressions = ref<string[]>([
    'f01',
    'f02',
    'f03',
    'f04',
    'f05',
  ])

  const modelPath = ref('/assets/live2d/hiyori/')
  const isLoaded = ref(false)

  function setScale(newScale: number) {
    scale.value = Math.max(0.5, Math.min(2, newScale))
  }

  function setPosition(x: number, y: number) {
    positionX.value = x
    positionY.value = y
  }

  function setExpression(expression: string) {
    currentExpression.value = expression
  }

  function playMotion(group: string, index: number = 0) {
    currentMotion.value = { group, index }
  }

  function resetState() {
    scale.value = 1
    positionX.value = 0
    positionY.value = 0
    currentMotion.value = { group: 'Idle', index: 0 }
    currentExpression.value = ''
  }

  return {
    scale,
    positionX,
    positionY,
    currentMotion,
    currentExpression,
    availableMotions,
    availableExpressions,
    modelPath,
    isLoaded,
    setScale,
    setPosition,
    setExpression,
    playMotion,
    resetState,
  }
})
