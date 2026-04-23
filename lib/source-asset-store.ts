const SOURCE_ASSET_DB_NAME = 'prometheus-source-assets.v1'
const SOURCE_ASSET_STORE_NAME = 'source-assets'

type StoredSourceAssetRecord = {
  id: string
  file: Blob
  name: string
  type: string
  lastModified: number
  createdAt: string
}

function isBrowser() {
  return typeof window !== 'undefined'
}

function createAssetId() {
  return `asset_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

function openSourceAssetDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser() || typeof window.indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'))
      return
    }

    const request = window.indexedDB.open(SOURCE_ASSET_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(SOURCE_ASSET_STORE_NAME)) {
        database.createObjectStore(SOURCE_ASSET_STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open the source asset database'))
  })
}

async function withSourceAssetStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
) {
  const database = await openSourceAssetDatabase()

  return await new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(SOURCE_ASSET_STORE_NAME, mode)
    const store = transaction.objectStore(SOURCE_ASSET_STORE_NAME)

    transaction.onabort = () => {
      reject(transaction.error ?? new Error('The source asset transaction was aborted'))
    }
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('The source asset transaction failed'))
    }
    transaction.oncomplete = () => {
      database.close()
    }

    run(store, resolve, reject)
  })
}

async function readStoredSourceAssetRecord(assetId: string) {
  return await withSourceAssetStore<StoredSourceAssetRecord | null>('readonly', (store, resolve, reject) => {
    const request = store.get(assetId)
    request.onsuccess = () => {
      resolve((request.result as StoredSourceAssetRecord | undefined) ?? null)
    }
    request.onerror = () => reject(request.error ?? new Error('Unable to restore the uploaded source asset'))
  })
}

function restoreStoredSourceAssetFile(record: StoredSourceAssetRecord) {
  return new File([record.file], record.name, {
    type: record.type || record.file.type || 'application/octet-stream',
    lastModified: record.lastModified,
  })
}

export async function persistSourceAsset(file: File) {
  const assetId = createAssetId()
  const record: StoredSourceAssetRecord = {
    id: assetId,
    file,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    createdAt: new Date().toISOString(),
  }

  return await withSourceAssetStore<string>('readwrite', (store, resolve, reject) => {
    const request = store.put(record)
    request.onsuccess = () => resolve(assetId)
    request.onerror = () => reject(request.error ?? new Error('Unable to persist the uploaded source asset'))
  })
}

export async function createSourceAssetObjectUrl(assetId: string) {
  const record = await readStoredSourceAssetRecord(assetId)
  return record ? URL.createObjectURL(restoreStoredSourceAssetFile(record)) : null
}

export async function getStoredSourceAssetFile(assetId: string) {
  const record = await readStoredSourceAssetRecord(assetId)
  if (!record) return null

  return restoreStoredSourceAssetFile(record)
}
