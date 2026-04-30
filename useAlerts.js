import { useState, useEffect, useCallback, useRef } from 'react'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('navigator-ai', 2)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('watchlist')) db.createObjectStore('watchlist', { keyPath: 'symbol' })
      if (!db.objectStoreNames.contains('settings'))  db.createObjectStore('settings',  { keyPath: 'key' })
      if (!db.objectStoreNames.contains('seenNews'))  db.createObjectStore('seenNews',   { keyPath: 'id' })
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

async function dbGet(storeName, key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(key)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

async function dbPut(storeName, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

async function dbDelete(storeName, key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

async function dbGetAll(storeName) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll()
    req.onsuccess = e => resolve(e.target.result || [])
    req.onerror   = e => reject(e.target.error)
  })
}

export function useAlerts() {
  const [alertsEnabled, setAlertsEnabled] = useState(false)
  const [permission,    setPermission]    = useState('default')
  const [watchlist,     setWatchlist]     = useState([])
  const [minMlScore,    setMinMlScore]    = useState(60)
  const [scanning,      setScanning]      = useState(false)
  const [lastScan,      setLastScan]      = useState(null)
  const [swRegistered,  setSwRegistered]  = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const saved = await dbGet('settings', 'alertSettings')
        if (saved?.value) {
          setAlertsEnabled(saved.value.alertsEnabled || false)
          setMinMlScore(saved.value.minMlScore || 60)
        }
        const wl = await dbGetAll('watchlist')
        setWatchlist(wl)
        setPermission(Notification.permission)
      } catch (e) {}
    }
    load()
  }, [])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(() => setSwRegistered(true))
        .catch(e => console.log('SW registration failed:', e))
    }
  }, [])

  useEffect(() => {
    dbPut('settings', { key: 'alertSettings', value: { alertsEnabled, minMlScore } })
  }, [alertsEnabled, minMlScore])

  useEffect(() => {
    if (!alertsEnabled || watchlist.length === 0) return
    const interval = setInterval(() => scanWatchlist(), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [alertsEnabled, watchlist, minMlScore])

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) { alert('Notifications not supported.'); return false }
    const result = await Notification.requestPermission()
    setPermission(result)
    return result === 'granted'
  }, [])

  const toggleAlerts = useCallback(async () => {
    if (!alertsEnabled) {
      const granted = await requestPermission()
      if (!granted) return
      setAlertsEnabled(true)
      setTimeout(() => scanWatchlist(), 1000)
    } else {
      setAlertsEnabled(false)
    }
  }, [alertsEnabled, requestPermission])

  const addToWatchlist = useCallback(async (symbol, interval = '15min') => {
    const item = { symbol: symbol.toUpperCase(), interval, addedAt: Date.now() }
    await dbPut('watchlist', item)
    setWatchlist(prev => [...prev.filter(w => w.symbol !== item.symbol), item])
  }, [])

  const removeFromWatchlist = useCallback(async (symbol) => {
    await dbDelete('watchlist', symbol.toUpperCase())
    setWatchlist(prev => prev.filter(w => w.symbol !== symbol.toUpperCase()))
  }, [])

  const sendNotification = useCallback((title, body, data = {}) => {
    if (Notification.permission !== 'granted') return
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body, icon: '/icon-192.png', badge: '/icon-192.png',
          vibrate: [200, 100, 200], tag: data.tag || `nav-${Date.now()}`, data
        })
      })
    } else {
      new Notification(title, { body, icon: '/icon-192.png' })
    }
  }, [])

  const scanWatchlist = useCallback(async () => {
    if (scanning || watchlist.length === 0) return
    setScanning(true)
    setLastScan(new Date())
    for (const item of watchlist) {
      try {
        const res  = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: item.symbol, interval: item.interval })
        })
        const data = await res.json()
        if (!data.result) continue
        const { direction, pair, mlScore, entryPrice, stopLoss, takeProfit1 } = data.result
        if (direction === 'NO SIGNAL' || (mlScore || 0) < minMlScore) continue
        sendNotification(
          `🧭 Navigator AI — ${direction} Signal`,
          `${pair} | Entry: ${entryPrice} | SL: ${stopLoss} | TP1: ${takeProfit1} | ML: ${mlScore}/100`,
          { url: '/', pair, direction, tag: `signal-${pair}` }
        )
      } catch (e) {}
    }
    setScanning(false)
  }, [scanning, watchlist, minMlScore, sendNotification])

  const alertOnSignal = useCallback((result) => {
    if (!alertsEnabled || Notification.permission !== 'granted') return
    if (!result || result.direction === 'NO SIGNAL') return
    if ((result.mlScore || 0) < minMlScore) return
    sendNotification(
      `🧭 Navigator AI — ${result.direction} Signal`,
      `${result.pair} | Entry: ${result.entryPrice} | SL: ${result.stopLoss} | TP1: ${result.takeProfit1} | ML: ${result.mlScore}/100`,
      { url: '/', pair: result.pair, direction: result.direction, tag: `signal-${result.pair}` }
    )
  }, [alertsEnabled, minMlScore, sendNotification])

  return {
    alertsEnabled, permission, watchlist, minMlScore,
    scanning, lastScan, swRegistered,
    toggleAlerts,
    requestPermission, addToWatchlist, removeFromWatchlist,
    scanWatchlist, alertOnSignal, setMinMlScore,
  }
}
