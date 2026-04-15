// api/news.js — fetches high-impact market news + Trump/political alerts
// Uses multiple free RSS feeds — no API key needed

const HIGH_IMPACT_KEYWORDS = [
  // Trump & political
  'trump', 'tariff', 'trade war', 'sanctions', 'executive order',
  'federal reserve', 'powell', 'interest rate', 'rate hike', 'rate cut',
  // Market volatility
  'crash', 'collapse', 'surge', 'soar', 'plunge', 'plummet', 'spike',
  'recession', 'inflation', 'cpi', 'nfp', 'non-farm', 'gdp',
  'fomc', 'ecb', 'bank of england', 'boj', 'central bank',
  // Crypto
  'bitcoin', 'btc', 'crypto', 'sec', 'etf approval',
  // Gold & commodities
  'gold', 'oil', 'opec', 'war', 'conflict', 'geopolit',
  // General market
  'market', 'stocks', 'forex', 'volatility', 'vix',
]

const TRUMP_KEYWORDS = [
  'trump', 'tariff', 'maga', 'white house', 'oval office',
  'mar-a-lago', 'executive order', 'trade deal', 'china tariff',
]

// RSS feeds that return JSON via public CORS proxies
const RSS_SOURCES = [
  {
    name: 'Reuters Markets',
    url: 'https://feeds.reuters.com/reuters/businessNews',
    type: 'rss'
  },
  {
    name: 'MarketWatch',
    url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
    type: 'rss'
  },
  {
    name: 'Forex Factory',
    url: 'https://www.forexfactory.com/news',
    type: 'rss'
  }
]

// Use rss2json.com to convert RSS to JSON (free, no key needed)
const RSS_TO_JSON = 'https://api.rss2json.com/v1/api.json?rss_url='

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const allArticles = []

    // Fetch from multiple RSS sources
    const feeds = await Promise.allSettled([
      fetchRSS('https://feeds.reuters.com/reuters/businessNews', 'Reuters'),
      fetchRSS('https://feeds.marketwatch.com/marketwatch/topstories/', 'MarketWatch'),
      fetchRSS('https://rss.cnn.com/rss/money_news_international.rss', 'CNN Money'),
      fetchRSS('https://www.investing.com/rss/news.rss', 'Investing.com'),
    ])

    for (const result of feeds) {
      if (result.status === 'fulfilled' && result.value) {
        allArticles.push(...result.value)
      }
    }

    // Score each article
    const scored = allArticles
      .map(article => scoreArticle(article))
      .filter(a => a.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20) // top 20

    // Separate Trump alerts from general high-impact
    const trumpAlerts = scored.filter(a => a.isTrump)
    const highImpact  = scored.filter(a => a.isHighImpact && !a.isTrump)
    const all         = scored

    return res.status(200).json({
      trumpAlerts,
      highImpact,
      all,
      count: all.length,
      fetchedAt: new Date().toISOString()
    })

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch news' })
  }
}

async function fetchRSS(url, source) {
  try {
    const apiUrl = `${RSS_TO_JSON}${encodeURIComponent(url)}&count=20`
    const res    = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) })
    const data   = await res.json()

    if (data.status !== 'ok' || !data.items) return []

    return data.items.map(item => ({
      title:       item.title || '',
      description: item.description || item.content || '',
      link:        item.link || '',
      pubDate:     item.pubDate || new Date().toISOString(),
      source,
    }))
  } catch (e) {
    return []
  }
}

function scoreArticle(article) {
  const text  = `${article.title} ${article.description}`.toLowerCase()
  let score   = 0
  let isTrump = false
  let isHighImpact = false
  const matchedKeywords = []

  // Trump check
  for (const kw of TRUMP_KEYWORDS) {
    if (text.includes(kw)) {
      isTrump = true
      score  += 10
      matchedKeywords.push(kw)
    }
  }

  // High impact keywords
  for (const kw of HIGH_IMPACT_KEYWORDS) {
    if (text.includes(kw)) {
      score += 3
      matchedKeywords.push(kw)
      isHighImpact = true
    }
  }

  // Boost very recent articles
  const age = Date.now() - new Date(article.pubDate).getTime()
  const hoursOld = age / (1000 * 60 * 60)
  if (hoursOld < 1)  score += 5
  if (hoursOld < 3)  score += 3
  if (hoursOld < 6)  score += 1
  if (hoursOld > 24) score -= 5 // penalise old news

  // Urgency words boost
  const urgency = ['breaking', 'urgent', 'alert', 'just in', 'flash', 'developing']
  for (const u of urgency) {
    if (text.includes(u)) score += 5
  }

  return {
    ...article,
    score,
    isTrump,
    isHighImpact,
    matchedKeywords: [...new Set(matchedKeywords)],
    summary: article.title,
    ageHours: Math.round(hoursOld * 10) / 10,
  }
}
