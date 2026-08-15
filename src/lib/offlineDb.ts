// Simple offline IndexedDB manager for FreshScan AI scans queue
// Zero external dependencies to prevent compilation or bundle size overhead

const DB_NAME = 'freshscan_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'scans_queue';

export interface OfflineScan {
  id: string;
  image: Blob;
  metadata: {
    freshness_index: number;
    grade: string;
    label: string;
    confidence: number;
    timestamp: string;
    species_detected: string;
  };
  status: 'pending' | 'synced' | 'failed';
  error?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export const offlineDb = {
  async addScan(scan: OfflineScan): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(scan);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getPendingScans(): Promise<OfflineScan[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const scans = request.result as OfflineScan[];
        resolve(scans.filter(s => s.status === 'pending' || s.status === 'failed'));
      };
      request.onerror = () => reject(request.error);
    });
  },

  async updateScanStatus(id: string, status: OfflineScan['status'], error?: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const data = getReq.result as OfflineScan;
        if (data) {
          data.status = status;
          if (error) data.error = error;
          const updateReq = store.put(data);
          updateReq.onsuccess = () => resolve();
          updateReq.onerror = () => reject(updateReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },

  async deleteScan(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};
