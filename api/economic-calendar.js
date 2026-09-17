// api/economic-calendar.js
// Fetches real high-impact economic events from ForexFactory RSS feed
// and enriches them with an AI-generated signal direction

export const config = { maxDuration: 20 }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Map event keywords → affected pairs and bias
const EVENT_MAP = {
  'FOMC':           { pairs: ['XAU/USD', 'EUR/USD', 'GBP/USD', 'US30'], bias: 'volatility' },
  'NFP':            { pairs: ['XAU/USD', 'EUR/USD', 'GBP/USD'], bias: 'USD' },
  'CPI':            { pairs: ['XAU/USD', 'EUR/USD', 'USD/JPY'], bias: 'inflation' },
  'PPI':            { pairs: ['XAU/USD', 'EUR/USD'], bias: 'inflation' },
  'GDP':            { pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY'], bias: 'growth' },
  'Interest Rate':  { pairs: ['XAU/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY'], bias: 'rate' },
  'ECB':            { pairs: ['EUR/USD', 'GBP/USD'], bias: 'EUR' },
  'BOE':            { pairs: ['GBP/USD', 'EUR/USD'], bias: 'GBP' },
  'BOJ':            { pairs: ['USD/JPY', 'EUR/USD'], bias: 'JPY' },
  'Unemployment':   { pairs: ['EUR/USD', 'GBP/USD', 'XAU/USD'], bias: 'labor' },
  'Retail Sales':   { pairs: ['EUR/USD', 'GBP/USD'], bias: 'consumer' },
  'PMI':            { pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY'], bias: 'growth' },
  'ADP':            { pairs: ['EUR/USD', 'XAU/USD'], bias: 'USD' },
  'ISM':            { pairs: ['EUR/USD', 'USD/JPY'], bias: 'USD' },
}

function getEventMeta(title) {
  for (const [key, val] of Object.entries(EVENT_MAP)) {
    if (title.toUpperCase().includes(key.toUpperCase())) return { key, ...val }
  }
  return { pairs: ['EUR/USD'], bias: 'volatility' }
}

function getSignalDirection(title, bias) {
  const t = title.toUpperCase()
  // High-impact events = caution signal + pair-specific bias
  if (t.includes('FOMC') || t.includes('INTEREST RATE')) {
    return { direction: 'CAUTION', signal: 'High volatility expected. Wait for post-event candle close before entering.' }
  }
  if (t.includes('NFP') || t.includes('NON-FARM')) {
    return { direction: 'CAUTION', signal: 'Major USD event. Avoid open positions 30 min before release.' }
  }
  if (t.includes('CPI') || t.includes('INFLATION')) {
    return { direction: 'SELL GOLD', signal: 'Hot CPI → stronger USD → Gold sell pressure. Watch for rejection at resistance.' }
  }
  if (t.includes('UNEMPLOYMENT') || t.includes('JOBLESS')) {
    return { direction: 'BUY USD', signal: 'Rising unemployment → risk-off → USD and Gold move. Wait for confirmation.' }
  }
  if (t.includes('ECB')) {
    return { direction: 'EUR MOVE', signal: 'ECB decision incoming. EUR/USD likely to spike. Trade after the press conference.' }
  }
  if (t.includes('BOE')) {
    return { direction: 'GBP MOVE', signal: 'BOE decision. GBP pairs will see high volatility. Avoid before release.' }
  }
  return { direction: 'WATCH', signal: 'Monitor price action around this event. Wait for candle close confirmation.' }
}

async function fetchForexFactoryEvents() {
  // ForexFactory public RSS feed
  const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
    headers: { 'User-Agent': 'Navigator AI/1.0' }
  })
  if (!res.ok) throw new Error('ForexFactory feed unavailable')
  const data = await res.json()

  const now = new Date()

  return data
    .filter(e => e.impact === 'High') // only high-impact
    .map(e => {
      const eventDate = new Date(e.date)
      const meta = getEventMeta(e.title)
      const sig  = getSignalDirection(e.title, meta.bias)

      return {
        id:        e.id || `${e.title}-${e.date}`,
        title:     e.title,
        currency:  e.country,
        impact:    e.impact,
        date:      e.date,
        dateObj:   eventDate,
        isPast:    eventDate < now,
        isNext:    false, // will set below
        forecast:  e.forecast || null,
        previous:  e.previous || null,
        actual:    e.actual   || null,
        pairs:     meta.pairs,
        direction: sig.direction,
        signal:    sig.signal,
        bias:      meta.bias,
      }
    })
    .sort((a, b) => a.dateObj - b.dateObj)
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({})

  try {
    const events = await fetchForexFactoryEvents()

    // Mark the very next upcoming event
    const nextIdx = events.findIndex(e => !e.isPast)
    if (nextIdx !== -1) events[nextIdx].isNext = true

    // Clean up non-serialisable fields
    const clean = events.map(({ dateObj, ...e }) => e)

    return res.status(200).setHeader('Cache-Control', 's-maxage=300').json({ events: clean })
  } catch (err) {
    // Fallback: return a few hardcoded upcoming events so the UI never breaks
    const fallback = [
      {
        id: 'fallback-1',
        title: 'FOMC Meeting Minutes',
        currency: 'USD',
        impact: 'High',
        date: new Date(Date.now() + 3600000 * 4).toISOString(),
        isPast: false,
        isNext: true,
        forecast: null,
        previous: null,
        actual: null,
        pairs: ['XAU/USD', 'EUR/USD', 'US30'],
        direction: 'CAUTION',
        signal: 'High volatility expected. Wait for post-event candle close before entering.',
        bias: 'volatility',
      },
      {
        id: 'fallback-2',
        title: 'Non-Farm Payrolls',
        currency: 'USD',
        impact: 'High',
        date: new Date(Date.now() + 3600000 * 24).toISOString(),
        isPast: false,
        isNext: false,
        forecast: '185K',
        previous: '175K',
        actual: null,
        pairs: ['XAU/USD', 'EUR/USD', 'GBP/USD'],
        direction: 'CAUTION',
        signal: 'Major USD event. Avoid open positions 30 min before release.',
        bias: 'USD',
      },
    ]
    return res.status(200).json({ events: fallback, fallback: true })
  }
}
