// Navigator AI — Service Worker
// Handles background push notifications and PWA caching

const CACHE_NAME = 'navigator-ai-v1'
const STATIC_ASSETS = ['/', '/index.html']

// ── Install: cache static assets ─────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ── Activate: clean old caches ────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: serve from cache when offline ──────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})

// ── Push: show notification when signal arrives ───────────────────────
self.addEventListener('push', event => {
  let data = { title: 'Navigator AI Signal', body: 'A new trade signal is ready!', direction: 'BUY', pair: '' }

  if (event.data) {
    try { data = { ...data, ...event.data.json() } } catch (e) {}
  }

  const isBuy  = data.direction === 'BUY'
  const isSell = data.direction === 'SELL'

  const options = {
    body:    data.body || `${data.direction} signal on ${data.pair}`,
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    vibrate: [200, 100, 200],
    tag:     `signal-${data.pair}-${Date.now()}`,
    data:    { url: '/', pair: data.pair, direction: data.direction },
    actions: [
      { action: 'view',    title: '📊 View Signal' },
      { action: 'dismiss', title: '✕ Dismiss' }
    ]
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// ── Notification click: open the app ─────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()

  if (event.action === 'dismiss') return

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow('/')
    })
  )
})

// ── Background Sync: scan signals periodically ───────────────────────
self.addEventListener('periodicsync', event => {
  if (event.tag === 'navigator-signal-scan') {
    event.waitUntil(scanForSignals())
  }
})

async function scanForSignals() {
  try {
    // Get watchlist from IndexedDB
    const db = await openDB()
    const watchlist = await getWatchlist(db)
    const settings  = await getSettings(db)

    if (!settings.alertsEnabled || !watchlist.length) return

    for (const item of watchlist) {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: item.symbol, interval: item.interval })
      })
      const data = await res.json()
      if (!data.result) continue

      const { direction, pair, mlScore, entryPrice, stopLoss, takeProfit1 } = data.result
      if (direction === 'NO SIGNAL') continue
      if (mlScore < (settings.minMlScore || 60)) continue

      const isBuy = direction === 'BUY'
      await self.registration.showNotification(`🧭 Navigator AI — ${direction} Signal`, {
        body: `${pair} | Entry: ${entryPrice} | SL: ${stopLoss} | TP1: ${takeProfit1} | ML: ${mlScore}/100`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: `signal-${pair}`,
        data: { url: '/', pair, direction }
      })
    }
  } catch (e) {
    console.log('Background scan error:', e)
  }
}

// ── Simple IndexedDB helpers ──────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('navigator-ai', 1)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('watchlist')) db.createObjectStore('watchlist', { keyPath: 'symbol' })
      if (!db.objectStoreNames.contains('settings'))  db.createObjectStore('settings',  { keyPath: 'key' })
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

function getWatchlist(db) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('watchlist', 'readonly')
    const req = tx.objectStore('watchlist').getAll()
    req.onsuccess = e => resolve(e.target.result || [])
    req.onerror   = e => reject(e.target.error)
  })
}

function getSettings(db) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('settings', 'readonly')
    const req = tx.objectStore('settings').get('alertSettings')
    req.onsuccess = e => resolve(e.target.result?.value || { alertsEnabled: false, minMlScore: 60 })
    req.onerror   = e => reject(e.target.error)
  })
}
