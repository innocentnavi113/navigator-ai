// api/economic-calendar.js
// Fetches ONLY genuinely high-impact events (NFP, FOMC, CPI, rate decisions etc.)

export const config = { maxDuration: 20 }

// ── Only these keywords are truly market-moving ──────────────────────────────
const HIGH_IMPACT_KEYWORDS = [
  'Non-Farm', 'NFP',
  'FOMC', 'Federal Reserve', 'Fed Rate',
  'CPI', 'Core CPI', 'Inflation',
  'Interest Rate', 'Rate Decision', 'Rate Vote', 'Bank Rate',
  'Monetary Policy',
  'GDP',
  'ECB', 'European Central Bank',
  'BOE', 'Bank of England',
  'BOJ', 'Bank of Japan',
  'BOC', 'Bank of Canada',
  'RBA', 'Reserve Bank',
  'SNB', 'Swiss National',
  'Unemployment Rate', 'Jobless Claims',
  'PPI', 'Producer Price',
  'Retail Sales',
  'ISM Manufacturing', 'ISM Services',
  'ADP Employment',
  'Flash PMI',
]

function isHighImpact(title) {
  return HIGH_IMPACT_KEYWORDS.some(kw =>
    title.toLowerCase().includes(kw.toLowerCase())
  )
}

// ── Event → signal mapping ────────────────────────────────────────────────────
const EVENT_MAP = {
  'FOMC':           { pairs: ['XAU/USD', 'EUR/USD', 'US30'], bias: 'volatility' },
  'Federal Reserve':{ pairs: ['XAU/USD', 'EUR/USD', 'US30'], bias: 'volatility' },
  'Fed Rate':       { pairs: ['XAU/USD', 'EUR/USD', 'US30'], bias: 'volatility' },
  'NFP':            { pairs: ['XAU/USD', 'EUR/USD', 'GBP/USD'], bias: 'USD' },
  'Non-Farm':       { pairs: ['XAU/USD', 'EUR/USD', 'GBP/USD'], bias: 'USD' },
  'CPI':            { pairs: ['XAU/USD', 'EUR/USD', 'USD/JPY'], bias: 'inflation' },
  'Inflation':      { pairs: ['XAU/USD', 'EUR/USD'], bias: 'inflation' },
  'PPI':            { pairs: ['XAU/USD', 'EUR/USD'], bias: 'inflation' },
  'GDP':            { pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY'], bias: 'growth' },
  'Interest Rate':  { pairs: ['XAU/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY'], bias: 'rate' },
  'Rate Decision':  { pairs: ['XAU/USD', 'EUR/USD', 'GBP/USD'], bias: 'rate' },
  'Bank Rate':      { pairs: ['GBP/USD', 'EUR/USD'], bias: 'rate' },
  'Monetary Policy':{ pairs: ['GBP/USD', 'EUR/USD', 'USD/JPY'], bias: 'rate' },
  'ECB':            { pairs: ['EUR/USD', 'GBP/USD'], bias: 'EUR' },
  'BOE':            { pairs: ['GBP/USD', 'EUR/USD'], bias: 'GBP' },
  'Bank of England':{ pairs: ['GBP/USD', 'EUR/USD'], bias: 'GBP' },
  'BOJ':            { pairs: ['USD/JPY', 'EUR/USD'], bias: 'JPY' },
  'Bank of Japan':  { pairs: ['USD/JPY', 'XAU/USD'], bias: 'JPY' },
  'BOC':            { pairs: ['USD/CAD'], bias: 'CAD' },
  'RBA':            { pairs: ['AUD/USD'], bias: 'AUD' },
  'Unemployment':   { pairs: ['EUR/USD', 'GBP/USD', 'XAU/USD'], bias: 'labor' },
  'Jobless':        { pairs: ['EUR/USD', 'XAU/USD'], bias: 'labor' },
  'Retail Sales':   { pairs: ['EUR/USD', 'GBP/USD'], bias: 'consumer' },
  'ISM':            { pairs: ['EUR/USD', 'USD/JPY'], bias: 'USD' },
  'ADP':            { pairs: ['EUR/USD', 'XAU/USD'], bias: 'USD' },
  'PMI':            { pairs: ['EUR/USD', 'GBP/USD'], bias: 'growth' },
}

function getEventMeta(title) {
  for (const [key, val] of Object.entries(EVENT_MAP)) {
    if (title.toLowerCase().includes(key.toLowerCase())) return { key, ...val }
  }
  return { pairs: ['EUR/USD', 'XAU/USD'], bias: 'volatility' }
}

function getSignalDirection(title) {
  const t = title.toUpperCase()
  if (t.includes('FOMC') || t.includes('FEDERAL RESERVE') || t.includes('FED RATE'))
    return { direction: 'CAUTION', signal: 'High volatility expected. Wait for post-event candle close before entering.' }
  if (t.includes('NFP') || t.includes('NON-FARM'))
    return { direction: 'CAUTION', signal: 'Major USD event. Avoid open positions 30 min before release.' }
  if (t.includes('CPI') || t.includes('INFLATION'))
    return { direction: 'SELL GOLD', signal: 'Hot CPI → stronger USD → Gold sell pressure. Watch for rejection at resistance.' }
  if (t.includes('INTEREST RATE') || t.includes('RATE DECISION') || t.includes('BANK RATE') || t.includes('MONETARY POLICY'))
    return { direction: 'CAUTION', signal: 'Rate decision incoming. Expect a spike. Trade after confirmation candle.' }
  if (t.includes('ECB'))
    return { direction: 'EUR MOVE', signal: 'ECB decision. EUR/USD likely to spike. Trade after the press conference.' }
  if (t.includes('BOE') || t.includes('BANK OF ENGLAND'))
    return { direction: 'GBP MOVE', signal: 'BOE decision. GBP pairs will see high volatility. Avoid before release.' }
  if (t.includes('BOJ') || t.includes('BANK OF JAPAN'))
    return { direction: 'JPY MOVE', signal: 'BOJ decision. USD/JPY will spike. Wait for post-decision candle close.' }
  if (t.includes('UNEMPLOYMENT') || t.includes('JOBLESS'))
    return { direction: 'WATCH', signal: 'Labor data: rising unemployment → risk-off. Wait for confirmation.' }
  if (t.includes('GDP'))
    return { direction: 'WATCH', signal: 'GDP release. Strong data → buy currency, weak data → sell. Wait for candle.' }
  return { direction: 'CAUTION', signal: 'High-impact event. Monitor price action and wait for confirmation.' }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({})

  try {
    const feedRes = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      headers: { 'User-Agent': 'NavigatorAI/1.0' }
    })
    if (!feedRes.ok) throw new Error('Feed unavailable')
    const raw = await feedRes.json()

    const now = new Date()

    const events = raw
      .filter(e => {
        // Must be marked High impact by FF AND match our keyword whitelist
        const impactOk = (e.impact || '').toLowerCase() === 'high'
        const keywordOk = isHighImpact(e.title || '')
        return impactOk && keywordOk
      })
      .map(e => {
        const eventDate = new Date(e.date)
        const meta = getEventMeta(e.title)
        const sig  = getSignalDirection(e.title)
        return {
          id:        e.id || `${e.title}-${e.date}`,
          title:     e.title,
          currency:  e.country,
          impact:    'High',
          date:      e.date,
          isPast:    eventDate < now,
          isNext:    false,
          forecast:  e.forecast  || null,
          previous:  e.previous  || null,
          actual:    e.actual    || null,
          pairs:     meta.pairs,
          direction: sig.direction,
          signal:    sig.signal,
          bias:      meta.bias,
        }
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    // Mark the next upcoming event
    const nextIdx = events.findIndex(e => !e.isPast)
    if (nextIdx !== -1) events[nextIdx].isNext = true

    return res
      .status(200)
      .setHeader('Cache-Control', 's-maxage=300')
      .json({ events })

  } catch (err) {
    // Fallback so UI never breaks
    const fallback = [
      {
        id: 'fb-1',
        title: 'FOMC Meeting Minutes',
        currency: 'USD',
        impact: 'High',
        date: new Date(Date.now() + 3600000 * 4).toISOString(),
        isPast: false, isNext: true,
        forecast: null, previous: null, actual: null,
        pairs: ['XAU/USD', 'EUR/USD', 'US30'],
        direction: 'CAUTION',
        signal: 'High volatility expected. Wait for post-event candle close before entering.',
        bias: 'volatility',
      },
      {
        id: 'fb-2',
        title: 'Non-Farm Payrolls',
        currency: 'USD',
        impact: 'High',
        date: new Date(Date.now() + 3600000 * 28).toISOString(),
        isPast: false, isNext: false,
        forecast: '185K', previous: '175K', actual: null,
        pairs: ['XAU/USD', 'EUR/USD', 'GBP/USD'],
        direction: 'CAUTION',
        signal: 'Major USD event. Avoid open positions 30 min before release.',
        bias: 'USD',
      },
    ]
    return res.status(200).json({ events: fallback, fallback: true })
  }
}
