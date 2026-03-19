export interface ModelCacheEntry {
  model: any
  timestamp: number
  lastUsed: number
}

export interface PreloadProgress {
  loaded: number
  total: number
  status: 'pending' | 'loading' | 'complete' | 'error'
  error?: string
}

export type ProgressCallback = (progress: PreloadProgress) => void

class Live2DCacheManager {
  private modelCache: Map<string, ModelCacheEntry> = new Map()
  private maxCacheSize = 3
  private cacheExpiryTime = 30 * 60 * 1000
  private preloadedModels: Set<string> = new Set()
  private preloadProgress: Map<string, PreloadProgress> = new Map()

  async preloadModels(modelPaths: string[], onProgress?: ProgressCallback): Promise<void> {
    const total = modelPaths.length
    let loaded = 0

    for (const path of modelPaths) {
      if (this.preloadedModels.has(path)) {
        loaded++
        onProgress?.({ loaded, total, status: 'loading' })
        continue
      }

      try {
        this.preloadProgress.set(path, { loaded: 0, total: 1, status: 'loading' })
        
        await this.prefetchModelResources(path)
        
        this.preloadedModels.add(path)
        this.preloadProgress.set(path, { loaded: 1, total: 1, status: 'complete' })
        loaded++
        onProgress?.({ loaded, total, status: 'loading' })
      } catch (error) {
        this.preloadProgress.set(path, { 
          loaded: 0, 
          total: 1, 
          status: 'error', 
          error: error instanceof Error ? error.message : String(error) 
        })
        loaded++
        onProgress?.({ loaded, total, status: 'loading' })
      }
    }

    onProgress?.({ loaded: total, total, status: 'complete' })
  }

  private async prefetchModelResources(modelPath: string): Promise<void> {
    try {
      const response = await fetch(modelPath)
      if (!response.ok) return
      
      const modelConfig = await response.json()
      
      const resources: string[] = []
      
      if (modelConfig.FileReferences) {
        if (modelConfig.FileReferences.Moc) {
          resources.push(this.resolvePath(modelPath, modelConfig.FileReferences.Moc))
        }
        if (modelConfig.FileReferences.Textures) {
          for (const texture of modelConfig.FileReferences.Textures) {
            resources.push(this.resolvePath(modelPath, texture))
          }
        }
        if (modelConfig.FileReferences.Physics) {
          resources.push(this.resolvePath(modelPath, modelConfig.FileReferences.Physics))
        }
      }
      
      await Promise.all(resources.map(url => this.prefetchResource(url)))
    } catch (error) {
      console.warn('Failed to prefetch model resources:', error)
    }
  }

  private resolvePath(basePath: string, relativePath: string): string {
    const baseDir = basePath.substring(0, basePath.lastIndexOf('/') + 1)
    return new URL(relativePath, baseDir).href
  }

  private async prefetchResource(url: string): Promise<void> {
    try {
      const response = await fetch(url, { method: 'GET', cache: 'force-cache' })
      if (response.ok) {
        await response.blob()
      }
    } catch {
      // Ignore prefetch errors
    }
  }

  cacheModel(path: string, model: any): void {
    if (this.modelCache.size >= this.maxCacheSize) {
      this.evictOldest()
    }

    this.modelCache.set(path, {
      model,
      timestamp: Date.now(),
      lastUsed: Date.now()
    })
  }

  getCachedModel(path: string): any | null {
    const entry = this.modelCache.get(path)
    if (!entry) return null

    if (Date.now() - entry.timestamp > this.cacheExpiryTime) {
      this.modelCache.delete(path)
      return null
    }

    entry.lastUsed = Date.now()
    return entry.model
  }

  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.modelCache) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed
        oldestKey = key
      }
    }

    if (oldestKey) {
      const entry = this.modelCache.get(oldestKey)
      if (entry?.model && typeof entry.model.destroy === 'function') {
        try {
          entry.model.destroy()
        } catch {
          // Ignore destroy errors
        }
      }
      this.modelCache.delete(oldestKey)
    }
  }

  isPreloaded(path: string): boolean {
    return this.preloadedModels.has(path)
  }

  getPreloadProgress(path: string): PreloadProgress | undefined {
    return this.preloadProgress.get(path)
  }

  clearCache(): void {
    for (const entry of this.modelCache.values()) {
      if (entry.model && typeof entry.model.destroy === 'function') {
        try {
          entry.model.destroy()
        } catch {
          // Ignore destroy errors
        }
      }
    }
    this.modelCache.clear()
    this.preloadedModels.clear()
    this.preloadProgress.clear()
  }
}

export const live2dCache = new Live2DCacheManager()

export function useLive2DCache() {
  return {
    preloadModels: live2dCache.preloadModels.bind(live2dCache),
    cacheModel: live2dCache.cacheModel.bind(live2dCache),
    getCachedModel: live2dCache.getCachedModel.bind(live2dCache),
    isPreloaded: live2dCache.isPreloaded.bind(live2dCache),
    getPreloadProgress: live2dCache.getPreloadProgress.bind(live2dCache),
    clearCache: live2dCache.clearCache.bind(live2dCache)
  }
}
