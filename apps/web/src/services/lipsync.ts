export interface LipSyncOptions {
  smoothingFactor?: number
  minOpenValue?: number
  maxOpenValue?: number
  silenceThreshold?: number
}

export interface LipSyncResult {
  mouthOpenY: number
  isSpeaking: boolean
  volume: number
}

export class LipSyncAnalyzer {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private dataArray: Uint8Array | null = null
  private sourceNode: AudioBufferSourceNode | MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null = null
  private animationFrameId: number | null = null
  private isAnalyzing = false
  
  private smoothingFactor: number
  private minOpenValue: number
  private maxOpenValue: number
  private silenceThreshold: number
  
  private currentMouthOpenY = 0
  private smoothedMouthOpenY = 0
  private currentVolume = 0

  constructor(options: LipSyncOptions = {}) {
    this.smoothingFactor = options.smoothingFactor ?? 0.3
    this.minOpenValue = options.minOpenValue ?? 0.05
    this.maxOpenValue = options.maxOpenValue ?? 0.9
    this.silenceThreshold = options.silenceThreshold ?? 20
  }

  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
    
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.5
    
    const bufferLength = this.analyser.frequencyBinCount
    this.dataArray = new Uint8Array(bufferLength)
  }

  connectAudioBuffer(audioBuffer: AudioBuffer): Promise<void> {
    if (!this.audioContext || !this.analyser) {
      throw new Error('LipSyncAnalyzer not initialized')
    }

    this.disconnect()

    const source = this.audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.analyser)
    this.analyser.connect(this.audioContext.destination)
    
    this.sourceNode = source
    
    return new Promise((resolve) => {
      source.onended = () => {
        this.stopAnalyzing()
        resolve()
      }
      source.start()
      this.startAnalyzing()
    })
  }

  connectMediaElement(element: HTMLAudioElement): void {
    if (!this.audioContext || !this.analyser) {
      throw new Error('LipSyncAnalyzer not initialized')
    }

    this.disconnect()

    const source = this.audioContext.createMediaElementSource(element)
    source.connect(this.analyser)
    this.analyser.connect(this.audioContext.destination)
    
    this.sourceNode = source
    this.startAnalyzing()
  }

  connectMediaStream(stream: MediaStream): void {
    if (!this.audioContext || !this.analyser) {
      throw new Error('LipSyncAnalyzer not initialized')
    }

    this.disconnect()

    const source = this.audioContext.createMediaStreamSource(stream)
    source.connect(this.analyser)
    
    this.sourceNode = source
    this.startAnalyzing()
  }

  private startAnalyzing(): void {
    if (this.isAnalyzing) return
    
    this.isAnalyzing = true
    this.analyze()
  }

  private stopAnalyzing(): void {
    this.isAnalyzing = false
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  private analyze(): void {
    if (!this.isAnalyzing || !this.analyser || !this.dataArray) return

    this.analyser.getByteFrequencyData(this.dataArray)
    
    let sum = 0
    const len = this.dataArray.length
    
    for (let i = 0; i < len; i++) {
      sum += this.dataArray[i]
    }
    
    const average = sum / len
    this.currentVolume = average / 255
    
    const normalizedVolume = average / 255
    
    if (average < this.silenceThreshold) {
      this.currentMouthOpenY = 0
    } else {
      const scaledValue = normalizedVolume * 2
      this.currentMouthOpenY = Math.min(this.maxOpenValue, Math.max(this.minOpenValue, scaledValue))
    }
    
    this.smoothedMouthOpenY = this.smoothedMouthOpenY + 
      (this.currentMouthOpenY - this.smoothedMouthOpenY) * this.smoothingFactor

    this.animationFrameId = requestAnimationFrame(() => this.analyze())
  }

  getCurrentResult(): LipSyncResult {
    return {
      mouthOpenY: this.smoothedMouthOpenY,
      isSpeaking: this.currentVolume > this.silenceThreshold / 255,
      volume: this.currentVolume
    }
  }

  getMouthOpenY(): number {
    return this.smoothedMouthOpenY
  }

  isSpeaking(): boolean {
    return this.currentVolume > this.silenceThreshold / 255
  }

  disconnect(): void {
    this.stopAnalyzing()
    
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect()
      } catch {
        // Ignore disconnect errors
      }
      this.sourceNode = null
    }
    
    if (this.analyser) {
      try {
        this.analyser.disconnect()
      } catch {
        // Ignore disconnect errors
      }
    }
    
    this.currentMouthOpenY = 0
    this.smoothedMouthOpenY = 0
    this.currentVolume = 0
  }

  dispose(): void {
    this.disconnect()
    
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    
    this.analyser = null
    this.dataArray = null
  }
}

export function createLipSyncAnalyzer(options?: LipSyncOptions): LipSyncAnalyzer {
  return new LipSyncAnalyzer(options)
}
