// api/news.js — Forex + BTC + Twitter/X news monitoring

const HIGH_IMPACT_KEYWORDS = [
  // Forex specific
  'eurusd', 'gbpusd', 'usdjpy', 'xauusd', 'gold', 'dollar', 'usd',
  'euro', 'pound', 'yen', 'swiss franc', 'forex', 'fx', 'currency',
  'pips', 'spread', 'liquidity', 'central bank', 'monetary policy',
  // BTC/Crypto specific
  'bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'cryptocurrency',
  'blockchain', 'altcoin', 'defi', 'nft', 'binance', 'coinbase',
  'sec', 'etf', 'halving', 'satoshi', 'whale', 'hodl',
  // Macro
  'trump', 'tariff', 'trade war', 'federal reserve', 'powell',
  'interest rate', 'rate hike', 'rate cut', 'inflation', 'cpi',
  'nfp', 'non-farm', 'gdp', 'fomc', 'ecb', 'boj',
  'recession', 'crash', 'surge', 'plunge', 'volatility',
  'war', 'conflict', 'sanctions', 'oil', 'opec',
]

const TRUMP_KEYWORDS = [
  'trump', 'tariff', 'white house', 'donald trump',
  'trade deal', 'china tariff', 'executive order', 'maga',
]

const FOREX_KEYWORDS = [
  'eurusd', 'gbpusd', 'usdjpy', 'xauusd', 'gold', 'dollar index',
  'dxy', 'forex', 'fx market', 'currency pair', 'central bank',
  'interest rate', 'fomc', 'ecb', 'boj', 'boe', 'fed',
  'inflation', 'cpi', 'nfp', 'gdp', 'pmi',
]

const BTC_KEYWORDS = [
  'bitcoin', 'btc', 'crypto', 'ethereum', 'eth', 'blockchain',
  'binance', 'coinbase', 'sec', 'etf', 'halving', 'whale',
  'altcoin', 'defi', 'stablecoin', 'usdt', 'usdc',
]

// Twitter/X accounts to monitor via Nitter (free, no API key)
const TWITTER_ACCOUNTS = [
  { handle: 'KathyLien',       label: 'Kathy Lien (Forex)',    type: 'forex' },
  { handle: 'BKForex',         label: 'BK Forex',              type: 'forex' },
  { handle: 'ForexLive',       label: 'ForexLive',             type: 'forex' },
  { handle: 'PeterLBrandt',    label: 'Peter Brandt',          type: 'forex' },
  { handle: 'saxobank',        label: 'Saxo Bank',             type: 'forex' },
  { handle: 'saylor',          label: 'Michael Saylor (BTC)',  type: 'btc'   },
  { handle: 'APompliano',      label: 'Anthony Pompliano',     type: 'btc'   },
  { handle: 'WhalePanda',      label: 'WhalePanda',            type: 'btc'   },
  { handle: 'woonomic',        label: 'Willy Woo (BTC)',       type: 'btc'   },
  { handle: 'DocumentingBTC',  label: 'DocumentingBTC',        type: 'btc'   },
]

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=120')

  const allArticles  = []
  const tweetResults = []

  // ── NEWS SOURCES ─────────────────────────────────────────────────────

  const newsSources = await Promise.allSettled([

    // 1. CoinDesk — BTC/Crypto news (working!)
    fetchRSS('https://www.coindesk.com/arc/outboundfeeds/rss/', 'CoinDesk', 'btc'),

    // 2. CoinTelegraph RSS — BTC news
    fetchRSS('https://cointelegraph.com/rss', 'CoinTelegraph', 'btc'),

    // 3. ForexLive RSS
    fetchRSS('https://www.forexlive.com/feed/news', 'ForexLive', 'forex'),

    // 4. Investing.com Forex News
    fetchRSS('https://www.investing.com/rss/news_25.rss', 'Investing.com Forex', 'forex'),

    // 5. FXStreet Forex News
    fetchRSS('https://www.fxstreet.com/rss/news', 'FXStreet', 'forex'),

    // 6. Reddit r/Bitcoin
    fetchReddit('Bitcoin', 'btc'),

    // 7. Reddit r/Forex
    fetchReddit('Forex', 'forex'),

    // 8. Reddit r/CryptoCurrency
    fetchReddit('CryptoCurrency', 'btc'),

    // 9. Reddit r/investing
    fetchReddit('investing', 'forex'),

    // 10. HackerNews — finance filtered
    fetchHackerNews(),

    // 11. Reuters Business via allorigins
    fetchRSSViaProxy('https://feeds.reuters.com/reuters/businessNews', 'Reuters', 'macro'),

    // 12. BBC Business
    fetchRSSViaProxy('https://feeds.bbci.co.uk/news/business/rss.xml', 'BBC Business', 'macro'),
  ])

  for (const r of newsSources) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      allArticles.push(...r.value)
    }
  }

  // ── TWITTER/X via Nitter RSS (free, no API key) ───────────────────
  const twitterSources = await Promise.allSettled(
    TWITTER_ACCOUNTS.map(acc => fetchNitterRSS(acc))
  )

  for (const r of twitterSources) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      tweetResults.push(...r.value)
    }
  }

  // ── COMBINE + DEDUPLICATE ────────────────────────────────────────────
  const combined = [...allArticles, ...tweetResults]
  const seen     = new Set()
  const unique   = combined.filter(a => {
    const key = a.title?.slice(0, 50)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  // ── AI FALLBACK if no articles ────────────────────────────────────────
  if (unique.length === 0 && process.env.OPENROUTER_API_KEY) {
    try {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'openrouter/auto',
          max_tokens: 800,
          messages: [{
            role: 'user',
            content: `Today is ${new Date().toDateString()}. List 8 current market-moving news for forex and bitcoin traders. Include Trump/tariff news if relevant. Return ONLY a JSON array, no markdown: [{"title":"...","description":"...","source":"Market Brief","category":"forex or btc or macro","impact":"HIGH or MEDIUM","isTrump":true/false}]`
          }]
        })
      })
      const aiData = await aiRes.json()
      let text = aiData.choices?.[0]?.message?.content || ''
      text = text.replace(/```json|```/g, '').trim()
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        const items = JSON.parse(match[0])
        for (const item of items) {
          unique.push({
            title:       item.title || '',
            description: item.description || '',
            link:        '',
            pubDate:     new Date().toISOString(),
            source:      'AI Market Brief',
            category:    item.category || 'macro',
            aiGenerated: true,
            forceImpact: item.impact,
            forceTrump:  item.isTrump,
          })
        }
      }
    } catch (e) {}
  }

  // ── SCORE + SORT ──────────────────────────────────────────────────────
  const scored = unique
    .map(a => scoreArticle(a))
    .filter(a => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)

  const trumpAlerts  = scored.filter(a => a.isTrump)
  const forexNews    = scored.filter(a => a.isForex && !a.isTrump)
  const btcNews      = scored.filter(a => a.isBTC && !a.isTrump)
  const tweets       = scored.filter(a => a.isTweet)
  const highImpact   = scored.filter(a => a.isHighImpact && !a.isTrump)
  const all          = scored

  return res.status(200).json({
    trumpAlerts,
    forexNews,
    btcNews,
    tweets,
    highImpact,
    all,
    count:   all.length,
    sources: [...new Set(scored.map(a => a.source))],
    fetchedAt: new Date().toISOString(),
  })
}

// ── Fetch RSS directly ─────────────────────────────────────────────────
async function fetchRSS(url, source, category) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Navigator-AI/1.0', 'Accept': 'application/rss+xml, text/xml' },
      signal: AbortSignal.timeout(8000)
    })
    if (!r.ok) return []
    const xml = await r.text()
    return parseRSSXML(xml, source, category)
  } catch (e) { return [] }
}

// ── Fetch RSS via allorigins proxy ────────────────────────────────────
async function fetchRSSViaProxy(url, source, category) {
  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
    const r     = await fetch(proxy, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const d   = await r.json()
    const xml = d.contents || ''
    return parseRSSXML(xml, source, category)
  } catch (e) { return [] }
}

// ── Fetch Twitter/X via Nitter RSS (multiple instances) ───────────────
async function fetchNitterRSS(account) {
  const instances = [
    'https://nitter.net',
    'https://nitter.privacydev.net',
    'https://nitter.poast.org',
    'https://nitter.cz',
  ]
  for (const base of instances) {
    try {
      const url = `${base}/${account.handle}/rss`
      const r   = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 Navigator-AI/1.0' },
        signal: AbortSignal.timeout(5000)
      })
      if (!r.ok) continue
      const xml   = await r.text()
      const items = parseRSSXML(xml, `@${account.handle}`, account.type)
      return items.map(item => ({
        ...item,
        isTweet:   true,
        tweetUser: account.label,
        source:    `@${account.handle}`,
      }))
    } catch (e) { continue }
  }
  return []
}

// ── Fetch Reddit JSON ──────────────────────────────────────────────────
async function fetchReddit(subreddit, category) {
  try {
    const r = await fetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=10`,
      {
        headers: { 'User-Agent': 'Navigator-AI/1.0' },
        signal: AbortSignal.timeout(7000)
      }
    )
    if (!r.ok) return []
    const d = await r.json()
    return (d?.data?.children || [])
      .filter(p => !p.data.stickied && !p.data.over_18)
      .map(p => ({
        title:       p.data.title || '',
        description: p.data.selftext?.slice(0, 200) || '',
        link:        `https://reddit.com${p.data.permalink}`,
        pubDate:     new Date(p.data.created_utc * 1000).toISOString(),
        source:      `r/${subreddit}`,
        category,
      }))
  } catch (e) { return [] }
}

// ── Fetch HackerNews ───────────────────────────────────────────────────
async function fetchHackerNews() {
  try {
    const r    = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', { signal: AbortSignal.timeout(5000) })
    if (!r.ok) return []
    const ids  = await r.json()
    const items = await Promise.allSettled(
      ids.slice(0, 15).map(id =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: AbortSignal.timeout(4000) }).then(r => r.json())
      )
    )
    return items
      .filter(r => r.status === 'fulfilled' && r.value?.title)
      .map(r => r.value)
      .filter(item => HIGH_IMPACT_KEYWORDS.some(kw => item.title.toLowerCase().includes(kw)))
      .map(item => ({
        title:    item.title,
        description: item.text || '',
        link:     item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        pubDate:  new Date(item.time * 1000).toISOString(),
        source:   'HackerNews',
        category: 'macro',
      }))
  } catch (e) { return [] }
}

// ── Parse RSS XML ──────────────────────────────────────────────────────
function parseRSSXML(xml, source, category) {
  const items  = []
  const chunks = xml.split('<item>')
  chunks.shift()
  for (const chunk of chunks.slice(0, 15)) {
    const title   = extractTag(chunk, 'title')
    const link    = extractTag(chunk, 'link') || extractTag(chunk, 'guid')
    const desc    = extractTag(chunk, 'description')
    const pubDate = extractTag(chunk, 'pubDate')
    if (!title) continue
    items.push({
      title:       cleanText(title),
      description: cleanText(desc),
      link:        link || '',
      pubDate:     pubDate || new Date().toISOString(),
      source,
      category:    category || 'macro',
    })
  }
  return items
}

function extractTag(xml, tag) {
  const m = xml.match(
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`)
  )
  return m ? (m[1] || m[2] || '').trim() : ''
}

function cleanText(str) {
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
}

// ── Score article ──────────────────────────────────────────────────────
function scoreArticle(article) {
  const text = `${article.title} ${article.description}`.toLowerCase()
  let score  = 0
  let isTrump = article.forceTrump || false
  let isForex = article.category === 'forex'
  let isBTC   = article.category === 'btc'
  let isHighImpact = false
  const matchedKeywords = []

  if (article.forceImpact === 'HIGH')   { score += 20; isHighImpact = true }
  if (article.forceImpact === 'MEDIUM') { score += 10; isHighImpact = true }

  for (const kw of TRUMP_KEYWORDS) {
    if (text.includes(kw)) { isTrump = true; score += 10; matchedKeywords.push(kw) }
  }

  for (const kw of FOREX_KEYWORDS) {
    if (text.includes(kw)) { isForex = true; score += 4; matchedKeywords.push(kw) }
  }

  for (const kw of BTC_KEYWORDS) {
    if (text.includes(kw)) { isBTC = true; score += 4; matchedKeywords.push(kw) }
  }

  for (const kw of HIGH_IMPACT_KEYWORDS) {
    if (text.includes(kw)) { score += 2; isHighImpact = true }
  }

  // Tweet boost — traders value real-time opinions
  if (article.isTweet) score += 5

  // Recency
  const ageMs    = Date.now() - new Date(article.pubDate).getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  if (ageHours < 1)       score += 8
  else if (ageHours < 3)  score += 5
  else if (ageHours < 6)  score += 2
  else if (ageHours > 48) score -= 8

  for (const u of ['breaking', 'urgent', 'alert', 'flash', 'just in', 'exclusive']) {
    if (text.includes(u)) score += 5
  }

  return {
    ...article,
    score,
    isTrump,
    isForex,
    isBTC,
    isHighImpact,
    matchedKeywords: [...new Set(matchedKeywords)].slice(0, 4),
    ageHours: Math.round(ageHours * 10) / 10,
  }
}
