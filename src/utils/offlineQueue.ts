const DB_NAME = 'FreshScanDB'
const STORE_NAME = 'scanQueue'

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function queueScan(scanData: Record<string, unknown>) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).add({ ...scanData, timestamp: Date.now() })
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingScans() {
  const db = await openDB()
  return new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result as Record<string, unknown>[])
    req.onerror = () => reject(req.error)
  })
}

export async function removeScan(id: number) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}