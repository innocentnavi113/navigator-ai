// api/news.js — fetches high-impact market news using reliable free sources

const HIGH_IMPACT_KEYWORDS = [
  'trump', 'tariff', 'trade war', 'sanctions', 'executive order',
  'federal reserve', 'powell', 'interest rate', 'rate hike', 'rate cut',
  'crash', 'collapse', 'surge', 'soar', 'plunge', 'plummet', 'spike',
  'recession', 'inflation', 'cpi', 'nfp', 'non-farm', 'gdp',
  'fomc', 'ecb', 'bank of england', 'boj', 'central bank',
  'bitcoin', 'btc', 'crypto', 'sec', 'etf',
  'gold', 'oil', 'opec', 'war', 'conflict', 'geopolit',
  'market', 'stocks', 'forex', 'volatility', 'vix',
  'breaking', 'urgent', 'alert', 'flash',
]

const TRUMP_KEYWORDS = [
  'trump', 'tariff', 'maga', 'white house', 'oval office',
  'mar-a-lago', 'trade deal', 'china tariff', 'donald trump',
]

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const allArticles = []

    // Fetch from multiple reliable RSS-to-JSON APIs
    const results = await Promise.allSettled([
      fetchViaRSS2JSON('https://feeds.reuters.com/reuters/businessNews', 'Reuters'),
      fetchViaRSS2JSON('https://feeds.marketwatch.com/marketwatch/topstories/', 'MarketWatch'),
      fetchViaRSS2JSON('https://rss.cnn.com/rss/money_news_international.rss', 'CNN Money'),
      fetchViaRSS2JSON('https://finance.yahoo.com/news/rssindex', 'Yahoo Finance'),
      fetchViaRSS2JSON('https://feeds.bbci.co.uk/news/business/rss.xml', 'BBC Business'),
    ])

    for (const r of results) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        allArticles.push(...r.value)
      }
    }

    // If all RSS failed, use fallback static high-impact news template
    if (allArticles.length === 0) {
      return res.status(200).json({
        trumpAlerts: [],
        highImpact: [],
        all: [],
        count: 0,
        error: 'RSS feeds temporarily unavailable',
        fetchedAt: new Date().toISOString()
      })
    }

    // Remove duplicates by title
    const seen   = new Set()
    const unique = allArticles.filter(a => {
      const key = a.title?.slice(0, 60)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Score articles
    const scored = unique
      .map(a => scoreArticle(a))
      .filter(a => a.score > 0)
      .sort((a, b) => b.score - a.score)

    const trumpAlerts = scored.filter(a => a.isTrump).slice(0, 5)
    const highImpact  = scored.filter(a => a.isHighImpact && !a.isTrump).slice(0, 10)
    const all         = scored.slice(0, 20)

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

// Method 1: rss2json.com (primary)
async function fetchViaRSS2JSON(rssUrl, source) {
  try {
    const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=15&api_key=`
    const res  = await fetch(url, {
      headers: { 'User-Agent': 'Navigator-AI/1.0' },
      signal: AbortSignal.timeout(10000)
    })
    if (!res.ok) return []
    const data = await res.json()
    if (data.status !== 'ok' || !Array.isArray(data.items)) return []

    return data.items.map(item => ({
      title:       cleanText(item.title || ''),
      description: cleanText(item.description || item.content || ''),
      link:        item.link || '',
      pubDate:     item.pubDate || new Date().toISOString(),
      source,
    }))
  } catch (e) {
    // Try backup method
    return fetchViaFeedParser(rssUrl, source)
  }
}

// Method 2: allorigins CORS proxy to parse RSS directly
async function fetchViaFeedParser(rssUrl, source) {
  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`
    const res   = await fetch(proxy, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data  = await res.json()
    const xml   = data.contents || ''
    return parseRSSXML(xml, source)
  } catch (e) {
    return []
  }
}

// Simple RSS XML parser
function parseRSSXML(xml, source) {
  try {
    const items  = []
    const chunks = xml.split('<item>')
    chunks.shift() // remove header

    for (const chunk of chunks.slice(0, 15)) {
      const title   = extractTag(chunk, 'title')
      const link    = extractTag(chunk, 'link')
      const desc    = extractTag(chunk, 'description')
      const pubDate = extractTag(chunk, 'pubDate')

      if (!title) continue
      items.push({
        title:       cleanText(title),
        description: cleanText(desc),
        link:        link || '',
        pubDate:     pubDate || new Date().toISOString(),
        source,
      })
    }
    return items
  } catch (e) {
    return []
  }
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
  return match ? (match[1] || match[2] || '').trim() : ''
}

function cleanText(str) {
  return str
    .replace(/<[^>]*>/g, '')           // strip HTML
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreArticle(article) {
  const text  = `${article.title} ${article.description}`.toLowerCase()
  let score   = 0
  let isTrump = false
  let isHighImpact = false
  const matchedKeywords = []

  for (const kw of TRUMP_KEYWORDS) {
    if (text.includes(kw)) {
      isTrump = true
      score += 10
      matchedKeywords.push(kw)
    }
  }

  for (const kw of HIGH_IMPACT_KEYWORDS) {
    if (text.includes(kw)) {
      score += 3
      isHighImpact = true
      if (!matchedKeywords.includes(kw)) matchedKeywords.push(kw)
    }
  }

  // Recency boost
  const ageMs   = Date.now() - new Date(article.pubDate).getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  if (ageHours < 1)  score += 8
  else if (ageHours < 3)  score += 5
  else if (ageHours < 6)  score += 2
  else if (ageHours > 24) score -= 10

  // Urgency words
  const urgency = ['breaking', 'urgent', 'alert', 'just in', 'flash', 'developing', 'exclusive']
  for (const u of urgency) {
    if (text.includes(u)) score += 5
  }

  return {
    ...article,
    score,
    isTrump,
    isHighImpact,
    matchedKeywords: [...new Set(matchedKeywords)].slice(0, 4),
    ageHours: Math.round(ageHours * 10) / 10,
  }
}
