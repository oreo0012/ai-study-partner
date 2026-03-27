/**
 * Kokoro TTS Web Worker Entry Point
 * This file is imported as a Web Worker
 */

import type { ErrorMessage, LoadedMessage, ProgressMessage, SuccessMessage, VoiceKey, WorkerRequest } from './types'

import type { KokoroTTS as KokoroTTSInstance } from 'kokoro-js'

let ttsModel: KokoroTTSInstance | null = null
let currentQuantization: string | null = null
let currentDevice: string | null = null
let kokoroTTSModule: typeof import('kokoro-js') | null = null

async function getKokoroTTSModule() {
  if (kokoroTTSModule)
    return kokoroTTSModule

  const maybeProcess = (globalThis as any).process
  if (maybeProcess?.versions?.node) {
    try {
      delete (globalThis as any).process
    }
    catch {
      ;(globalThis as any).process = undefined
    }
  }

  kokoroTTSModule = await import('kokoro-js')
  return kokoroTTSModule
}

interface GenerateRequest {
  text: string
  voice: VoiceKey
}

async function loadModel(quantization: string, device: string) {
  // Check if we already have the correct model loaded
  if (ttsModel && currentQuantization === quantization && currentDevice === device) {
    const message: LoadedMessage = {
      type: 'loaded',
      voices: ttsModel.voices,
    }
    globalThis.postMessage(message)
    return
  }

  // Map fp32-webgpu to fp32 for the model
  const modelQuantization = quantization === 'fp32-webgpu' ? 'fp32' : quantization

  const { KokoroTTS } = await getKokoroTTSModule()

  ttsModel = await KokoroTTS.from_pretrained(
    'onnx-community/Kokoro-82M-v1.0-ONNX',
    {
      dtype: modelQuantization as 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16',
      device: device as 'wasm' | 'webgpu' | 'cpu',
      progress_callback: (progress) => {
        const message: ProgressMessage = {
          type: 'progress',
          progress,
        }
        globalThis.postMessage(message)
      },
    },
  )

  // Store the current settings
  currentQuantization = quantization
  currentDevice = device

  const message: LoadedMessage = {
    type: 'loaded',
    voices: ttsModel.voices,
  }
  globalThis.postMessage(message)
}

async function generate(request: GenerateRequest) {
  const { text, voice } = request

  if (!ttsModel) {
    const errorMessage: ErrorMessage = {
      type: 'result',
      status: 'error',
      message: 'Kokoro TTS generation failed: No model loaded.',
    }
    globalThis.postMessage(errorMessage)
    return
  }

  // Generate audio from text
  const result = await ttsModel.generate(text, {
    voice,
  })

  const blob = await result.toBlob()
  const buffer: ArrayBuffer = await blob.arrayBuffer()

  // Send the audio buffer back to the main thread
  // Use transferable to avoid copying the buffer
  const successMessage: SuccessMessage = {
    type: 'result',
    status: 'success',
    buffer,
  }
  const transferList: ArrayBuffer[] = [buffer]
  ;(globalThis as any).postMessage(successMessage, transferList)
}

// Listen for messages from the main thread
globalThis.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data

  switch (message.type) {
    case 'load':
      await loadModel(message.data.quantization, message.data.device)
      break

    case 'generate':
      await generate(message.data)
      break

    default:
      console.warn('[Kokoro Worker] Unknown message type:', (message as any).type)
  }
})
