// /api/news.js  — Next.js API route (or adapt to Express)
// Combines: Forex Factory RSS feed + NewsAPI financial headlines

const FF_RSS_URL = 'https://www.forexfactory.com/ff_calendar_thisweek.xml'
const NEWSAPI_URL = 'https://newsapi.org/v2/everything'

// Parse RSS XML into article objects
function parseRSS(xml) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const get = (tag) => {
      const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
      return m ? (m[1] || m[2] || '').trim() : ''
    }

    const title = get('title')
    const link  = get('link')
    const desc  = get('description')
    const date  = get('pubDate')

    if (title) {
      items.push({
        title,
        url: link,
        description: desc,
        publishedAt: date ? new Date(date).toISOString() : new Date().toISOString(),
        source: { name: 'Forex Factory' },
        urlToImage: null,
      })
    }
  }

  return items
}

async function fetchForexFactory() {
  try {
    // Use a CORS proxy for client-side, or fetch directly server-side
    const res = await fetch(FF_RSS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error('FF RSS failed')
    const xml = await res.text()
    return parseRSS(xml)
  } catch (err) {
    console.warn('Forex Factory RSS error:', err.message)
    // Fallback: fetch news from marketwatch RSS
    try {
      const fallback = await fetch('https://feeds.marketwatch.com/marketwatch/topstories/', {
        signal: AbortSignal.timeout(5000),
      })
      const xml = await fallback.text()
      return parseRSS(xml)
    } catch {
      return []
    }
  }
}

async function fetchNewsAPI(apiKey) {
  if (!apiKey) return []
  try {
    const params = new URLSearchParams({
      q: 'forex OR gold OR "federal reserve" OR trump OR "interest rate" OR inflation OR "trade war"',
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: '20',
      apiKey,
    })
    const res = await fetch(`${NEWSAPI_URL}?${params}`, {
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return data.articles || []
  } catch (err) {
    console.warn('NewsAPI error:', err.message)
    return []
  }
}

function deduplicateArticles(articles) {
  const seen = new Set()
  return articles.filter(a => {
    const key = (a.title || '').toLowerCase().slice(0, 60)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const NEWSAPI_KEY = process.env.NEWSAPI_KEY || ''

  const [ffArticles, naArticles] = await Promise.all([
    fetchForexFactory(),
    fetchNewsAPI(NEWSAPI_KEY),
  ])

  const combined = deduplicateArticles([...ffArticles, ...naArticles])
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 40)

  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60')
  res.status(200).json({ articles: combined, fetchedAt: new Date().toISOString() })
}
