export interface VADConfig {
  energyThreshold?: number
  zeroCrossingThreshold?: number
  silenceDuration?: number
  speechDuration?: number
  frameSize?: number
  smoothingFactor?: number
}

export interface VADState {
  isSpeaking: boolean
  isSpeechDetected: boolean
  energy: number
  zeroCrossingRate: number
  silenceFrames: number
  speechFrames: number
}

export type VADCallback = (state: VADState) => void

export class VADDetector {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private mediaStream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private animationFrameId: number | null = null
  private isRunning = false
  
  private energyThreshold: number
  private zeroCrossingThreshold: number
  private silenceDuration: number
  private speechDuration: number
  private frameSize: number
  private smoothingFactor: number
  
  private currentState: VADState = {
    isSpeaking: false,
    isSpeechDetected: false,
    energy: 0,
    zeroCrossingRate: 0,
    silenceFrames: 0,
    speechFrames: 0
  }
  
  private callbacks: Set<VADCallback> = new Set()
  private smoothedEnergy = 0
  private previousSample: number = 0

  constructor(config: VADConfig = {}) {
    this.energyThreshold = config.energyThreshold ?? 0.02
    this.zeroCrossingThreshold = config.zeroCrossingThreshold ?? 0.15
    this.silenceDuration = config.silenceDuration ?? 15
    this.speechDuration = config.speechDuration ?? 5
    this.frameSize = config.frameSize ?? 512
    this.smoothingFactor = config.smoothingFactor ?? 0.3
  }

  async initialize(mediaStream: MediaStream): Promise<void> {
    this.mediaStream = mediaStream
    this.audioContext = new AudioContext()
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
    
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = this.frameSize * 2
    this.analyser.smoothingTimeConstant = 0.1
    
    this.sourceNode = this.audioContext.createMediaStreamSource(mediaStream)
    this.sourceNode.connect(this.analyser)
  }

  start(): void {
    if (this.isRunning) return
    
    this.isRunning = true
    this.currentState = {
      isSpeaking: false,
      isSpeechDetected: false,
      energy: 0,
      zeroCrossingRate: 0,
      silenceFrames: 0,
      speechFrames: 0
    }
    this.smoothedEnergy = 0
    this.previousSample = 0
    
    this.analyze()
  }

  stop(): void {
    this.isRunning = false
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  private analyze(): void {
    if (!this.isRunning || !this.analyser) return

    const timeData = new Float32Array(this.analyser.fftSize)
    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
    
    this.analyser.getFloatTimeDomainData(timeData)
    this.analyser.getByteFrequencyData(frequencyData)
    
    const energy = this.calculateEnergy(timeData)
    const zeroCrossingRate = this.calculateZeroCrossingRate(timeData)
    
    this.smoothedEnergy = this.smoothedEnergy + (energy - this.smoothedEnergy) * this.smoothingFactor
    
    const isSpeechFrame = this.detectSpeechFrame(this.smoothedEnergy, zeroCrossingRate)
    
    this.updateState(isSpeechFrame, this.smoothedEnergy, zeroCrossingRate)
    this.notifyCallbacks()
    
    this.animationFrameId = requestAnimationFrame(() => this.analyze())
  }

  private calculateEnergy(samples: Float32Array): number {
    let sum = 0
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i]
    }
    return Math.sqrt(sum / samples.length)
  }

  private calculateZeroCrossingRate(samples: Float32Array): number {
    let crossings = 0
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i] >= 0 && this.previousSample < 0) || 
          (samples[i] < 0 && this.previousSample >= 0)) {
        crossings++
      }
      this.previousSample = samples[i]
    }
    return crossings / samples.length
  }

  private detectSpeechFrame(energy: number, zeroCrossingRate: number): boolean {
    if (energy > this.energyThreshold * 2) {
      return true
    }
    
    if (energy > this.energyThreshold && zeroCrossingRate < this.zeroCrossingThreshold) {
      return true
    }
    
    if (energy > this.energyThreshold * 0.5 && zeroCrossingRate < this.zeroCrossingThreshold * 0.5) {
      return true
    }
    
    return false
  }

  private updateState(isSpeechFrame: boolean, energy: number, zeroCrossingRate: number): void {
    this.currentState.energy = energy
    this.currentState.zeroCrossingRate = zeroCrossingRate
    
    if (isSpeechFrame) {
      this.currentState.speechFrames++
      this.currentState.silenceFrames = 0
      
      if (this.currentState.speechFrames >= this.speechDuration && !this.currentState.isSpeechDetected) {
        this.currentState.isSpeechDetected = true
        this.currentState.isSpeaking = true
      }
    } else {
      this.currentState.silenceFrames++
      this.currentState.speechFrames = Math.max(0, this.currentState.speechFrames - 1)
      
      if (this.currentState.silenceFrames >= this.silenceDuration && this.currentState.isSpeechDetected) {
        this.currentState.isSpeechDetected = false
        this.currentState.isSpeaking = false
      }
    }
  }

  private notifyCallbacks(): void {
    this.callbacks.forEach(callback => callback(this.currentState))
  }

  onStateChange(callback: VADCallback): () => void {
    this.callbacks.add(callback)
    return () => this.callbacks.delete(callback)
  }

  getState(): VADState {
    return { ...this.currentState }
  }

  isSpeaking(): boolean {
    return this.currentState.isSpeaking
  }

  setEnergyThreshold(threshold: number): void {
    this.energyThreshold = threshold
  }

  setSilenceDuration(duration: number): void {
    this.silenceDuration = duration
  }

  dispose(): void {
    this.stop()
    this.callbacks.clear()
    
    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }
    
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    
    this.analyser = null
    this.mediaStream = null
  }
}

export function createVADDetector(config?: VADConfig): VADDetector {
  return new VADDetector(config)
}
