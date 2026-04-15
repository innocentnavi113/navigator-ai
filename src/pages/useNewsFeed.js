import { useState, useEffect, useRef, useCallback } from 'react'

const HIGH_IMPACT_KEYWORDS = [
  // Geopolitical
  'trump', 'iran', 'war', 'attack', 'strike', 'sanction', 'nato', 'nuclear',
  'tariff', 'trade war', 'china', 'russia', 'ukraine', 'israel', 'hamas',
  // Economic
  'fed', 'federal reserve', 'fomc', 'powell', 'rate hike', 'rate cut',
  'nfp', 'non-farm', 'cpi', 'inflation', 'recession', 'gdp',
  'ecb', 'bank of england', 'boe', 'boj', 'bank of japan',
  // Market
  'crash', 'crisis', 'volatility', 'gold', 'oil', 'spike', 'collapse',
  'emergency', 'intervention', 'halt', 'circuit breaker',
]

const VOLATILITY_KEYWORDS = [
  'trump', 'war', 'attack', 'crash', 'crisis', 'emergency', 'nuclear',
  'rate hike', 'rate cut', 'nfp', 'fomc', 'spike', 'collapse',
]

function scoreArticle(article) {
  const text = `${article.title} ${article.description || ''}`.toLowerCase()
  let score = 0
  let matchedKeywords = []

  HIGH_IMPACT_KEYWORDS.forEach(kw => {
    if (text.includes(kw)) {
      score += VOLATILITY_KEYWORDS.includes(kw) ? 3 : 1
      matchedKeywords.push(kw)
    }
  })

  return { score, matchedKeywords }
}

function getImpactLevel(score) {
  if (score >= 6) return 'critical'
  if (score >= 3) return 'high'
  if (score >= 1) return 'medium'
  return 'low'
}

function getImpactColor(level) {
  if (level === 'critical') return '#ff1744'
  if (level === 'high')     return '#ff9100'
  if (level === 'medium')   return '#ffd600'
  return '#888'
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function useNewsFeed({ enabled = true, minScore = 1 } = {}) {
  const [articles,     setArticles]     = useState([])
  const [loading,      setLoading]      = useState(false)
  const [lastFetched,  setLastFetched]  = useState(null)
  const [notifications, setNotifications] = useState([])
  const seenIds = useRef(new Set())
  const pollTimer = useRef(null)

  const fetchNews = useCallback(async () => {
    if (!enabled) return
    setLoading(true)

    try {
      const res = await fetch('/api/news')
      const data = await res.json()
      const raw = data.articles || []

      const enriched = raw
        .map(a => {
          const { score, matchedKeywords } = scoreArticle(a)
          return {
            ...a,
            id: a.url || a.title,
            score,
            matchedKeywords,
            impact: getImpactLevel(score),
            impactColor: getImpactColor(getImpactLevel(score)),
            timeAgo: timeAgo(a.publishedAt || a.pubDate || new Date()),
          }
        })
        .filter(a => a.score >= minScore)
        .sort((a, b) => b.score - a.score)

      // Find new high-impact articles for notifications
      const newHighImpact = enriched.filter(
        a => (a.impact === 'critical' || a.impact === 'high') && !seenIds.current.has(a.id)
      )

      newHighImpact.forEach(a => seenIds.current.add(a.id))

      if (newHighImpact.length > 0) {
        setNotifications(prev => [...newHighImpact, ...prev].slice(0, 10))

        // Browser push notification
        if (Notification.permission === 'granted') {
          newHighImpact.slice(0, 2).forEach(a => {
            new Notification(`⚡ ${a.impact.toUpperCase()} IMPACT`, {
              body: a.title,
              icon: '/icon-192.png',
              tag: a.id,
              requireInteraction: a.impact === 'critical',
            })
          })
        }
      }

      setArticles(enriched)
      setLastFetched(new Date())
    } catch (err) {
      console.error('News fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [enabled, minScore])

  useEffect(() => {
    if (!enabled) return
    fetchNews()
    pollTimer.current = setInterval(fetchNews, 3 * 60 * 1000) // every 3 min
    return () => clearInterval(pollTimer.current)
  }, [fetchNews, enabled])

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAllNotifications = useCallback(() => setNotifications([]), [])

  return {
    articles,
    loading,
    lastFetched,
    notifications,
    dismissNotification,
    clearAllNotifications,
    refresh: fetchNews,
  }
}
