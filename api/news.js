// api/news.js — uses working free news sources

const HIGH_IMPACT_KEYWORDS = [
  'trump', 'tariff', 'trade war', 'sanctions', 'executive order',
  'federal reserve', 'powell', 'interest rate', 'rate hike', 'rate cut',
  'crash', 'collapse', 'surge', 'soar', 'plunge', 'plummet', 'spike',
  'recession', 'inflation', 'cpi', 'nfp', 'non-farm', 'gdp',
  'fomc', 'ecb', 'bank of england', 'boj', 'central bank',
  'bitcoin', 'btc', 'crypto', 'sec', 'etf',
  'gold', 'oil', 'opec', 'war', 'conflict',
  'market', 'stocks', 'forex', 'volatility', 'breaking',
]

const TRUMP_KEYWORDS = [
  'trump', 'tariff', 'maga', 'white house', 'donald trump',
  'trade deal', 'china tariff', 'executive order',
]

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=120') // cache 2 mins

  const articles = []

  // ── Source 1: Currents API (free, no key needed for public endpoint) ──
  try {
    const r = await fetch(
      'https://api.currentsapi.services/v1/latest-news?language=en&category=finance',
      { signal: AbortSignal.timeout(8000) }
    )
    if (r.ok) {
      const d = await r.json()
      if (d.news) {
        for (const item of d.news.slice(0, 15)) {
          articles.push({
            title:       item.title || '',
            description: item.description || '',
            link:        item.url || '',
            pubDate:     item.published || new Date().toISOString(),
            source:      'Currents',
          })
        }
      }
    }
  } catch (e) {}

  // ── Source 2: TheNewsAPI (free tier, no key for basic) ──
  try {
    const r = await fetch(
      'https://api.thenewsapi.com/v1/news/top?locale=us&limit=10&categories=business',
      { signal: AbortSignal.timeout(8000) }
    )
    if (r.ok) {
      const d = await r.json()
      if (d.data) {
        for (const item of d.data) {
          articles.push({
            title:       item.title || '',
            description: item.description || item.snippet || '',
            link:        item.url || '',
            pubDate:     item.published_at || new Date().toISOString(),
            source:      'TheNewsAPI',
          })
        }
      }
    }
  } catch (e) {}

  // ── Source 3: HackerNews top stories (always works, free) ──
  try {
    const r = await fetch(
      'https://hacker-news.firebaseio.com/v0/topstories.json',
      { signal: AbortSignal.timeout(6000) }
    )
    if (r.ok) {
      const ids  = await r.json()
      const top  = ids.slice(0, 8)
      const items = await Promise.allSettled(
        top.map(id =>
          fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: AbortSignal.timeout(4000) })
            .then(r => r.json())
        )
      )
      for (const result of items) {
        if (result.status !== 'fulfilled') continue
        const item = result.value
        if (!item?.title) continue
        // Only include finance/market related HN posts
        const t = item.title.toLowerCase()
        if (!HIGH_IMPACT_KEYWORDS.some(kw => t.includes(kw))) continue
        articles.push({
          title:       item.title,
          description: item.text || '',
          link:        item.url || `https://news.ycombinator.com/item?id=${item.id}`,
          pubDate:     new Date(item.time * 1000).toISOString(),
          source:      'HackerNews',
        })
      }
    }
  } catch (e) {}

  // ── Source 4: Reddit r/finance + r/wallstreetbets JSON API ──
  try {
    const subs = ['finance', 'investing', 'Economics']
    for (const sub of subs) {
      const r = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?limit=8`,
        {
          headers: { 'User-Agent': 'NavigatorAI/1.0' },
          signal: AbortSignal.timeout(6000)
        }
      )
      if (!r.ok) continue
      const d = await r.json()
      for (const post of (d?.data?.children || [])) {
        const p = post.data
        if (p.stickied || p.over_18) continue
        articles.push({
          title:       p.title || '',
          description: p.selftext?.slice(0, 200) || '',
          link:        `https://reddit.com${p.permalink}`,
          pubDate:     new Date(p.created_utc * 1000).toISOString(),
          source:      `r/${sub}`,
        })
      }
    }
  } catch (e) {}

  // ── Source 5: CoinDesk RSS via public proxy (crypto news) ──
  try {
    const r = await fetch(
      'https://www.coindesk.com/arc/outboundfeeds/rss/',
      {
        headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' },
        signal: AbortSignal.timeout(6000)
      }
    )
    if (r.ok) {
      const xml   = await r.text()
      const items = parseRSSXML(xml, 'CoinDesk')
      articles.push(...items.slice(0, 10))
    }
  } catch (e) {}

  // ── If still no articles, use AI to generate market context ──
  if (articles.length === 0 && process.env.OPENROUTER_API_KEY) {
    try {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'openrouter/auto',
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: `Today is ${new Date().toDateString()}. List 5 major recent market-moving events or news headlines that forex/stock traders should know about right now. Format as JSON array: [{"title":"...","description":"...","source":"AI Market Brief","impact":"HIGH or MEDIUM","isTrump":true/false}]. Only JSON, no markdown.`
          }]
        })
      })
      const aiData = await aiRes.json()
      const text   = aiData.choices?.[0]?.message?.content || ''
      const clean  = text.replace(/```json|```/g, '').trim()
      const match  = clean.match(/\[[\s\S]*\]/)
      if (match) {
        const aiArticles = JSON.parse(match[0])
        for (const a of aiArticles) {
          articles.push({
            title:       a.title || '',
            description: a.description || '',
            link:        '',
            pubDate:     new Date().toISOString(),
            source:      'AI Market Brief',
            aiGenerated: true,
            forceImpact: a.impact,
            forceTrump:  a.isTrump,
          })
        }
      }
    } catch (e) {}
  }

  // ── Score and filter ──────────────────────────────────────────────
  const seen   = new Set()
  const unique = articles.filter(a => {
    const key = a.title?.slice(0, 50)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  const scored = unique
    .map(a => scoreArticle(a))
    .filter(a => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)

  const trumpAlerts = scored.filter(a => a.isTrump)
  const highImpact  = scored.filter(a => a.isHighImpact && !a.isTrump)
  const all         = scored

  return res.status(200).json({
    trumpAlerts,
    highImpact,
    all,
    count: all.length,
    sources: [...new Set(scored.map(a => a.source))],
    fetchedAt: new Date().toISOString(),
  })
}

function parseRSSXML(xml, source) {
  const items = []
  const chunks = xml.split('<item>')
  chunks.shift()
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
}

function extractTag(xml, tag) {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)
  )
  return match ? (match[1] || match[2] || '').trim() : ''
}

function cleanText(str) {
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
}

function scoreArticle(article) {
  const text = `${article.title} ${article.description}`.toLowerCase()
  let score  = 0
  let isTrump = article.forceTrump || false
  let isHighImpact = false
  const matchedKeywords = []

  if (article.forceImpact === 'HIGH') { score += 20; isHighImpact = true }
  if (article.forceImpact === 'MEDIUM') { score += 10; isHighImpact = true }

  for (const kw of TRUMP_KEYWORDS) {
    if (text.includes(kw)) { isTrump = true; score += 10; matchedKeywords.push(kw) }
  }

  for (const kw of HIGH_IMPACT_KEYWORDS) {
    if (text.includes(kw)) { score += 3; isHighImpact = true; matchedKeywords.push(kw) }
  }

  const ageMs    = Date.now() - new Date(article.pubDate).getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  if (ageHours < 1)       score += 8
  else if (ageHours < 3)  score += 5
  else if (ageHours < 6)  score += 2
  else if (ageHours > 48) score -= 10

  for (const u of ['breaking', 'urgent', 'alert', 'flash', 'developing', 'exclusive']) {
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
