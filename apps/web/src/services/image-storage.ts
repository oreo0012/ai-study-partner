import type { ExerciseImage, ImageStatus } from '@/config/types'

const DB_NAME = 'AiStudyPartner_Images'
const DB_VERSION = 1
const STORE_NAME = 'images'

let dbInstance: IDBDatabase | null = null

function getCurrentTimestamp(): string {
  return new Date().toISOString()
}

function generateId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'))
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
        store.createIndex('exerciseIds', 'exerciseIds', { unique: false, multiEntry: true })
      }
    }
  })
}

export async function saveImage(
  base64: string,
  exerciseIds: string[] = [],
  size: number = 0
): Promise<string> {
  try {
    const db = await openDatabase()
    const id = generateId()
    const image: ExerciseImage = {
      id,
      exerciseIds,
      base64,
      createdAt: getCurrentTimestamp(),
      status: 'pending',
      size
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.add(image)

      request.onsuccess = () => {
        resolve(id)
      }

      request.onerror = () => {
        reject(new Error('Failed to save image'))
      }
    })
  } catch (error) {
    console.error('Failed to save image:', error)
    throw error
  }
}

export async function getImage(id: string): Promise<ExerciseImage | null> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        reject(new Error('Failed to get image'))
      }
    })
  } catch (error) {
    console.error('Failed to get image:', error)
    throw error
  }
}

export async function deleteImages(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      ids.forEach(id => {
        store.delete(id)
      })

      transaction.oncomplete = () => {
        resolve()
      }

      transaction.onerror = () => {
        reject(new Error('Failed to delete images'))
      }
    })
  } catch (error) {
    console.error('Failed to delete images:', error)
    throw error
  }
}

export async function updateImageStatus(
  id: string,
  status: ImageStatus,
  exerciseIds?: string[]
): Promise<void> {
  try {
    const db = await openDatabase()
    const image = await getImage(id)

    if (!image) {
      throw new Error('Image not found')
    }

    const updatedImage: ExerciseImage = {
      ...image,
      status,
      ...(exerciseIds ? { exerciseIds } : {})
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(updatedImage)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to update image status'))
      }
    })
  } catch (error) {
    console.error('Failed to update image status:', error)
    throw error
  }
}

export async function getImagesByStatus(status: ImageStatus): Promise<ExerciseImage[]> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('status')
      const request = index.getAll(status)

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => {
        reject(new Error('Failed to get images by status'))
      }
    })
  } catch (error) {
    console.error('Failed to get images by status:', error)
    throw error
  }
}

export async function getAllImages(): Promise<ExerciseImage[]> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => {
        reject(new Error('Failed to get all images'))
      }
    })
  } catch (error) {
    console.error('Failed to get all images:', error)
    throw error
  }
}

export async function getTotalStorageSize(): Promise<number> {
  try {
    const images = await getAllImages()
    return images.reduce((total, img) => total + (img.size || 0), 0)
  } catch (error) {
    console.error('Failed to get total storage size:', error)
    return 0
  }
}

export async function cleanupExpiredImages(daysToKeep: number = 7): Promise<number> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    const cutoffIso = cutoffDate.toISOString()

    const allImages = await getAllImages()
    const expiredImages = allImages.filter(
      img => img.status === 'used' && img.createdAt < cutoffIso
    )

    if (expiredImages.length > 0) {
      await deleteImages(expiredImages.map(img => img.id))
      console.log(`Cleaned up ${expiredImages.length} expired images`)
    }

    return expiredImages.length
  } catch (error) {
    console.error('Failed to cleanup expired images:', error)
    return 0
  }
}

export async function cleanupByStorageLimit(maxSizeMB: number = 50): Promise<number> {
  try {
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    const totalSize = await getTotalStorageSize()

    if (totalSize <= maxSizeBytes) {
      return 0
    }

    const allImages = await getAllImages()
    const usedImages = allImages
      .filter(img => img.status === 'used')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    let deletedCount = 0
    let currentSize = totalSize
    const idsToDelete: string[] = []

    for (const img of usedImages) {
      if (currentSize <= maxSizeBytes) break
      idsToDelete.push(img.id)
      currentSize -= (img.size || 0)
      deletedCount++
    }

    if (idsToDelete.length > 0) {
      await deleteImages(idsToDelete)
      console.log(`Cleaned up ${deletedCount} images due to storage limit`)
    }

    return deletedCount
  } catch (error) {
    console.error('Failed to cleanup by storage limit:', error)
    return 0
  }
}

export async function clearAllImages(): Promise<void> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to clear all images'))
      }
    })
  } catch (error) {
    console.error('Failed to clear all images:', error)
    throw error
  }
}

export const imageStorage = {
  saveImage,
  getImage,
  deleteImages,
  updateImageStatus,
  getImagesByStatus,
  getAllImages,
  getTotalStorageSize,
  cleanupExpiredImages,
  cleanupByStorageLimit,
  clearAllImages
}

export default imageStorage
