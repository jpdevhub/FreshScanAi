import { getPendingScans, removeScan } from './offlineQueue'

// 1. Define a clean interface for a Scan item to resolve type issues
interface ScanItem {
  id: number;
  [key: string]: unknown; // Allows any other dynamic fields
}

async function uploadScan(scan: ScanItem) {
  const response = await fetch('/api/scans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scan),
  })
  if (!response.ok) throw new Error('Upload failed')
  return response.json()
}

export async function syncOfflineScans() {
  if (!navigator.onLine) return

  // Cast the pending scans array to our ScanItem interface
  const pending = (await getPendingScans()) as ScanItem[]
  
  for (const scan of pending) {
    try {
      await uploadScan(scan)
      await removeScan(scan.id)
      console.log(`✅ Synced scan ID: ${scan.id}`)
    } catch (err) {
      console.error(`❌ Failed to sync scan ${scan.id}:`, err)
    }
  }
}

// Auto sync when internet comes back
window.addEventListener('online', () => {
  console.log('🌐 Back online – syncing offline scans...')
  syncOfflineScans()
})