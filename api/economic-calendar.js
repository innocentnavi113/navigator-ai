// api/economic-calendar.js
// Shows ONE row per major event (no duplicate Statement/Conference/Projections rows)

export const config = { maxDuration: 20 }

// ── Primary events only — no sub-events ──────────────────────────────────────
// We pick ONE title per event group (the most important one)
const PRIMARY_TITLES = [
  // Fed
  'FOMC Statement',
  'Fed Interest Rate Decision',
  // NFP
  'Non-Farm Employment Change',
  // CPI
  'CPI m/m',
  'Core CPI m/m',
  'CPI y/y',
  // GDP
  'GDP q/q',
  'Preliminary GDP q/q',
  'Flash GDP q/q',
  // BOE
  'Official Bank Rate',
  'MPC Official Bank Rate Votes',
  // BOJ
  'BOJ Policy Rate',
  'BOJ Outlook Report',
  // ECB
  'Main Refinancing Rate',
  'ECB Interest Rate Decision',
  // BOC
  'Overnight Rate',
  // RBA
  'Cash Rate',
  // Unemployment
  'Unemployment Rate',
  'Claimant Count Change',
  // Retail / ISM / ADP
  'Core Retail Sales m/m',
  'Retail Sales m/m',
  'ISM Manufacturing PMI',
  'ISM Services PMI',
  'ADP Non-Farm Employment Change',
  // PPI
  'PPI m/m',
  'Core PPI m/m',
]

// Fallback: if the exact title isn't matched, use keyword check
const FALLBACK_KEYWORDS = [
  'Interest Rate Decision',
  'Cash Rate',
  'Overnight Rate',
  'Fed Rate',
  'Non-Farm Employment Change',
  'Unemployment Rate',
  'CPI m/m',
  'CPI y/y',
  'GDP q/q',
  'Flash GDP',
  'Retail Sales m/m',
  'ISM Manufacturing',
  'ISM Services',
  'ADP Non-Farm',
  'PPI m/m',
]

function shouldInclude(title) {
  // Exact match first
  if (PRIMARY_TITLES.some(t => title.toLowerCase() === t.toLowerCase())) return true
  // Keyword fallback
  if (FALLBACK_KEYWORDS.some(k => title.toLowerCase().includes(k.toLowerCase()))) return true
  // FOMC Statement or BOJ Statement specifically (not Press Conference, not Projections)
  if (title === 'FOMC Statement') return true
  if (title === 'BOJ Outlook Report') return true
  return false
}

// ── Signal mapping ────────────────────────────────────────────────────────────
const SIGNAL_MAP = [
  { match: ['FOMC', 'Fed Rate', 'Federal'],   pairs: ['XAU/USD','EUR/USD','US30'],       direction: 'CAUTION',   signal: 'Fed rate decision. Expect extreme volatility. Wait for post-decision candle.' },
  { match: ['Non-Farm', 'NFP'],               pairs: ['XAU/USD','EUR/USD','GBP/USD'],    direction: 'CAUTION',   signal: 'NFP — biggest USD event. Avoid open trades 30 min before release.' },
  { match: ['CPI', 'Inflation'],              pairs: ['XAU/USD','EUR/USD','USD/JPY'],    direction: 'SELL GOLD', signal: 'Hot CPI = stronger USD = Gold sell pressure. Confirm with price action.' },
  { match: ['PPI'],                           pairs: ['XAU/USD','EUR/USD'],              direction: 'WATCH',     signal: 'Producer prices affect inflation outlook. Watch Gold and USD pairs.' },
  { match: ['GDP'],                           pairs: ['EUR/USD','GBP/USD','USD/JPY'],    direction: 'WATCH',     signal: 'Strong GDP = buy currency. Weak GDP = sell. Wait for candle confirmation.' },
  { match: ['Official Bank Rate', 'BOE', 'MPC'], pairs: ['GBP/USD','EUR/USD'],          direction: 'GBP MOVE',  signal: 'BOE rate decision. GBP pairs spike hard. Trade after announcement candle.' },
  { match: ['BOJ', 'Bank of Japan'],          pairs: ['USD/JPY','XAU/USD'],              direction: 'JPY MOVE',  signal: 'BOJ policy decision. USD/JPY will spike. Wait for post-decision close.' },
  { match: ['ECB', 'Refinancing'],            pairs: ['EUR/USD','GBP/USD'],              direction: 'EUR MOVE',  signal: 'ECB rate decision. EUR/USD will spike. Trade after the press conference.' },
  { match: ['Cash Rate', 'RBA'],              pairs: ['AUD/USD'],                        direction: 'AUD MOVE',  signal: 'RBA decision. AUD pairs will move. Wait for candle confirmation.' },
  { match: ['Overnight Rate', 'BOC'],         pairs: ['USD/CAD'],                        direction: 'CAD MOVE',  signal: 'BOC rate decision. CAD pairs will move. Trade after announcement.' },
  { match: ['Unemployment'],                  pairs: ['EUR/USD','GBP/USD','XAU/USD'],    direction: 'WATCH',     signal: 'Unemployment data. Rising = risk-off. Wait for confirmation candle.' },
  { match: ['Retail Sales'],                  pairs: ['EUR/USD','GBP/USD'],              direction: 'WATCH',     signal: 'Consumer spending data. Beat = buy currency. Miss = sell.' },
  { match: ['ISM'],                           pairs: ['EUR/USD','USD/JPY'],              direction: 'WATCH',     signal: 'ISM data drives USD. Above 50 = expansion. Below 50 = contraction.' },
  { match: ['ADP'],                           pairs: ['EUR/USD','XAU/USD'],              direction: 'CAUTION',   signal: 'ADP previews NFP. Strong number = USD strength ahead of Friday NFP.' },
]

function getSignal(title) {
  const t = title.toLowerCase()
  for (const s of SIGNAL_MAP) {
    if (s.match.some(m => t.includes(m.toLowerCase()))) {
      return { pairs: s.pairs, direction: s.direction, signal: s.signal }
    }
  }
  return { pairs: ['EUR/USD', 'XAU/USD'], direction: 'CAUTION', signal: 'High-impact event. Monitor and wait for confirmation.' }
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
        const impactHigh = (e.impact || '').toLowerCase() === 'high'
        const titleOk    = shouldInclude(e.title || '')
        return impactHigh && titleOk
      })
      .map(e => {
        const sig = getSignal(e.title)
        return {
          id:       e.id || `${e.title}-${e.date}`,
          title:    e.title,
          currency: e.country,
          date:     e.date,
          isPast:   new Date(e.date) < now,
          isNext:   false,
          forecast: e.forecast || null,
          previous: e.previous || null,
          actual:   e.actual   || null,
          pairs:    sig.pairs,
          direction:sig.direction,
          signal:   sig.signal,
        }
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    // Mark next upcoming
    const nextIdx = events.findIndex(e => !e.isPast)
    if (nextIdx !== -1) events[nextIdx].isNext = true

    return res.status(200)
      .setHeader('Cache-Control', 's-maxage=60')
      .json({ events })

  } catch (err) {
    const fallback = [
      {
        id: 'fb-1', title: 'FOMC Statement', currency: 'USD',
        date: new Date(Date.now() + 3600000 * 4).toISOString(),
        isPast: false, isNext: true,
        forecast: null, previous: null, actual: null,
        pairs: ['XAU/USD', 'EUR/USD', 'US30'],
        direction: 'CAUTION',
        signal: 'Fed rate decision. Expect extreme volatility. Wait for post-decision candle.',
      },
      {
        id: 'fb-2', title: 'Non-Farm Employment Change', currency: 'USD',
        date: new Date(Date.now() + 3600000 * 28).toISOString(),
        isPast: false, isNext: false,
        forecast: '185K', previous: '175K', actual: null,
        pairs: ['XAU/USD', 'EUR/USD', 'GBP/USD'],
        direction: 'CAUTION',
        signal: 'NFP — biggest USD event. Avoid open trades 30 min before release.',
      },
    ]
    return res.status(200).json({ events: fallback, fallback: true })
  }
}
