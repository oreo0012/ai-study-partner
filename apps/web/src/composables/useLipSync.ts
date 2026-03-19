import type { LipSyncResult } from '@/services/lipsync'
import { ref, onMounted, onUnmounted } from 'vue'

const mouthOpenY = ref(0)
const isSpeaking = ref(false)
const callbacks = new Set<(result: LipSyncResult) => void>()

export function useLipSync() {
  function updateLipSync(result: LipSyncResult) {
    mouthOpenY.value = result.mouthOpenY
    isSpeaking.value = result.isSpeaking
    callbacks.forEach(cb => cb(result))
  }

  function onLipSyncUpdate(callback: (result: LipSyncResult) => void) {
    callbacks.add(callback)
    return () => callbacks.delete(callback)
  }

  function resetLipSync() {
    mouthOpenY.value = 0
    isSpeaking.value = false
  }

  return {
    mouthOpenY,
    isSpeaking,
    updateLipSync,
    onLipSyncUpdate,
    resetLipSync
  }
}

export function useLipSyncCallback(callback: (result: LipSyncResult) => void) {
  let unsubscribe: (() => void) | null = null

  onMounted(() => {
    unsubscribe = callbacks.add(callback) ? () => callbacks.delete(callback) : null
  })

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })
}
