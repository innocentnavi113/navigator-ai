// api/economic-calendar.js
// Dynamic BUY/SELL signals:
// - Before release: WAIT (we don't know the number yet)
// - After release:  BUY/SELL based on actual vs forecast comparison

export const config = { maxDuration: 20 }

const ALLOWED_TITLES = [
  'FOMC Statement', 'Fed Interest Rate Decision', 'FOMC Economic Projections',
  'Non-Farm Employment Change', 'ADP Non-Farm Employment Change',
  'CPI m/m', 'Core CPI m/m', 'CPI y/y', 'Core CPI y/y',
  'PPI m/m', 'Core PPI m/m',
  'GDP q/q', 'Preliminary GDP q/q', 'Flash GDP q/q', 'GDP m/m',
  'Official Bank Rate',
  'BOJ Policy Rate',
  'Main Refinancing Rate', 'ECB Interest Rate Decision',
  'Overnight Rate',
  'Cash Rate',
  'SNB Policy Rate',
  'Unemployment Rate', 'Claimant Count Change', 'Initial Jobless Claims',
  'Core Retail Sales m/m', 'Retail Sales m/m',
  'ISM Manufacturing PMI', 'ISM Services PMI',
]

function shouldInclude(title) {
  return ALLOWED_TITLES.some(t => title.trim().toLowerCase() === t.trim().toLowerCase())
}

// Parse numeric value from strings like "185K", "2.3%", "0.50%", "3-0-6"
function parseVal(str) {
  if (!str || str === '') return null
  // Vote format like "3-0-6" — not comparable numerically
  if (/^\d+-\d+-\d+$/.test(str.trim())) return null
  const n = parseFloat(str.replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? null : n
}

// ── Core logic: given event title + actual/forecast, return BUY/SELL/WAIT ────
function resolveSignal(title, actual, forecast, previous, isPast) {
  const t = title.toLowerCase()

  const actualVal   = parseVal(actual)
  const forecastVal = parseVal(forecast)
  const prevVal     = parseVal(previous)

  // If actual not yet released → WAIT
  const hasActual = actual && actual.trim() !== ''

  // Helper: did actual beat forecast?
  function beat()  { return actualVal !== null && forecastVal !== null && actualVal > forecastVal }
  function missed(){ return actualVal !== null && forecastVal !== null && actualVal < forecastVal }
  // If no forecast, compare to previous
  function abovePrev() { return actualVal !== null && prevVal !== null && actualVal > prevVal }
  function belowPrev() { return actualVal !== null && prevVal !== null && actualVal < prevVal }

  // ── USD events ──
  if (t.includes('non-farm') || t.includes('nfp') || t.includes('adp')) {
    if (!hasActual) return { direction: 'WAIT', signal: 'Waiting for NFP release. Strong beat = SELL Gold / BUY USD. Miss = BUY Gold / SELL USD.' }
    if (beat() || abovePrev())  return { direction: 'SELL GOLD', signal: `NFP beat (${actual} vs ${forecast} forecast) → USD strength → SELL Gold, BUY EUR/USD short.` }
    if (missed() || belowPrev()) return { direction: 'BUY GOLD',  signal: `NFP miss (${actual} vs ${forecast} forecast) → USD weakness → BUY Gold, SELL USD pairs.` }
    return { direction: 'WATCH', signal: `NFP in line with forecast (${actual}). Mixed reaction — wait for price action confirmation.` }
  }

  if (t.includes('fomc') || t.includes('fed interest rate')) {
    if (!hasActual) return { direction: 'WAIT', signal: 'Waiting for FOMC decision. Hike/hawkish = SELL Gold. Cut/dovish = BUY Gold.' }
    // Rate decisions: higher rate = USD bullish = Gold bearish
    if (beat() || abovePrev())  return { direction: 'SELL GOLD', signal: `Fed hiked/hawkish (${actual}) → USD strength → SELL Gold, BUY USD pairs.` }
    if (missed() || belowPrev()) return { direction: 'BUY GOLD',  signal: `Fed cut/dovish (${actual}) → USD weakness → BUY Gold, SELL USD pairs.` }
    return { direction: 'WATCH', signal: `Fed held rates at ${actual}. Watch for press conference tone — hawkish = SELL Gold, dovish = BUY Gold.` }
  }

  if (t.includes('cpi') || t.includes('inflation') || t.includes('ppi')) {
    if (!hasActual) return { direction: 'WAIT', signal: 'Waiting for CPI. Hot print = SELL Gold (USD strength). Cool print = BUY Gold (USD weakness).' }
    if (beat() || abovePrev())  return { direction: 'SELL GOLD', signal: `Hot CPI (${actual} vs ${forecast} forecast) → Fed stays hawkish → USD up → SELL Gold.` }
    if (missed() || belowPrev()) return { direction: 'BUY GOLD',  signal: `Cool CPI (${actual} vs ${forecast} forecast) → Fed turns dovish → USD down → BUY Gold.` }
    return { direction: 'WATCH', signal: `CPI in line (${actual}). Limited market reaction expected. Watch price action.` }
  }

  if (t.includes('gdp')) {
    if (!hasActual) return { direction: 'WAIT', signal: 'Waiting for GDP. Strong beat = buy that currency. Miss = sell.' }
    if (beat() || abovePrev())  return { direction: 'BUY',  signal: `GDP beat (${actual} vs ${forecast}) → economic strength → BUY that currency pair.` }
    if (missed() || belowPrev()) return { direction: 'SELL', signal: `GDP miss (${actual} vs ${forecast}) → economic weakness → SELL that currency pair.` }
    return { direction: 'WATCH', signal: `GDP in line (${actual}). Watch for follow-through in price action.` }
  }

  // ── BOE ──
  if (t.includes('official bank rate')) {
    if (!hasActual) return { direction: 'WAIT', signal: 'Waiting for BOE decision. Hike/hold = BUY GBP/USD. Cut = SELL GBP/USD.' }
    if (beat() || abovePrev())  return { direction: 'BUY GBP/USD',  signal: `BOE hiked to ${actual} → GBP strength → BUY GBP/USD. Enter after announcement candle.` }
    if (missed() || belowPrev()) return { direction: 'SELL GBP/USD', signal: `BOE cut to ${actual} → GBP weakness → SELL GBP/USD. Enter after announcement candle.` }
    return { direction: 'BUY GBP/USD', signal: `BOE held at ${actual}. GBP reaction depends on statement tone. Watch 15min candle.` }
  }

  // ── BOJ ──
  if (t.includes('boj policy rate')) {
    if (!hasActual) return { direction: 'WAIT', signal: 'Waiting for BOJ decision. Hike = SELL USD/JPY. Hold = BUY USD/JPY.' }
    if (beat() || abovePrev())  return { direction: 'SELL USD/JPY', signal: `BOJ hiked to ${actual} → JPY strength → SELL USD/JPY. Enter after candle close.` }
    if (missed() || belowPrev()) return { direction: 'BUY USD/JPY',  signal: `BOJ cut/held dovish at ${actual} → JPY weakness → BUY USD/JPY.` }
    return { direction: 'WATCH', signal: `BOJ held at ${actual}. Watch statement tone for direction. Trade after press conference.` }
  }

  // ── ECB ──
  if (t.includes('refinancing') || t.includes('ecb interest')) {
    if (!hasActual) return { direction: 'WAIT', signal: 'Waiting for ECB decision. Hike/hold = BUY EUR/USD. Cut = SELL EUR/USD.' }
    if (beat() || abovePrev())  return { direction: 'BUY EUR/USD',  signal: `ECB hiked to ${actual} → EUR strength → BUY EUR/USD. Trade after press conference.` }
    if (missed() || belowPrev()) return { direction: 'SELL EUR/USD', signal: `ECB cut to ${actual} → EUR weakness → SELL EUR/USD. Trade after press conference.` }
    return { direction: 'WATCH', signal: `ECB held at ${actual}. Watch Lagarde press conference for tone direction.` }
  }

  // ── Unemployment ──
  if (t.includes('unemployment')) {
    if (!hasActual) return { direction: 'WAIT', signal: 'Waiting for unemployment data. Higher = currency sell. Lower = currency buy.' }
    // Higher unemployment = bad = currency sell
    if (beat() || abovePrev())  return { direction: 'SELL',     signal: `Unemployment rose to ${actual} (vs ${forecast}) → economic weakness → SELL that currency, BUY Gold.` }
    if (missed() || belowPrev()) return { direction: 'BUY GOLD', signal: `Unemployment fell to ${actual} → labor strength → BUY that currency, SELL Gold.` }
    return { direction: 'WATCH', signal: `Unemployment in line at ${actual}. Limited reaction expected.` }
  }

  // ── Jobless claims ──
  if (t.includes('jobless') || t.includes('claimant')) {
    if (!hasActual) return { direction: 'WAIT', signal: 'Waiting for jobless claims. High claims = USD weakness = BUY Gold. Low = USD strength.' }
    if (beat() || abovePrev())  return { direction: 'BUY GOLD',  signal: `Claims higher than expected (${actual}) → USD weakness → BUY Gold.` }
    if (missed() || belowPrev()) return { direction: 'SELL GOLD', signal: `Claims lower than expected (${actual}) → USD strength → SELL Gold.` }
    return { direction: 'WATCH', signal: `Claims in line (${actual}). Watch for price action confirmation.` }
  }

  // ── Retail Sales ──
  if (t.includes('retail sales')) {
    if (!hasActual) return { direction: 'WAIT', signal: 'Waiting for retail sales. Beat = BUY that currency. Miss = SELL.' }
    if (beat() || abovePrev())  return { direction: 'BUY',  signal: `Retail sales beat (${actual} vs ${forecast}) → consumer strength → BUY that currency.` }
    if (missed() || belowPrev()) return { direction: 'SELL', signal: `Retail sales miss (${actual} vs ${forecast}) → consumer weakness → SELL that currency.` }
    return { direction: 'WATCH', signal: `Retail sales in line (${actual}). Limited reaction expected.` }
  }

  // ── ISM ──
  if (t.includes('ism')) {
    if (!hasActual) return { direction: 'WAIT', signal: 'Waiting for ISM. Above 50 = expansion = USD BUY. Below 50 = contraction = USD SELL / Gold BUY.' }
    const val = parseVal(actual)
    if (val !== null && val > 50 && beat()) return { direction: 'SELL GOLD', signal: `ISM above 50 and beat forecast (${actual}) → USD expansion → SELL Gold, BUY USD.` }
    if (val !== null && val < 50)           return { direction: 'BUY GOLD',  signal: `ISM below 50 (${actual}) → contraction → SELL USD → BUY Gold opportunity.` }
    return { direction: 'WATCH', signal: `ISM at ${actual}. Above 50 = expansion, below 50 = contraction. Watch USD pairs.` }
  }

  // Default fallback
  if (!hasActual) return { direction: 'WAIT', signal: 'Waiting for release. Monitor price action after the number drops.' }
  return { direction: 'WATCH', signal: `Result: ${actual}. Monitor price action for direction confirmation.` }
}

// Pairs per event type
function getPairs(title) {
  const t = title.toLowerCase()
  if (t.includes('non-farm') || t.includes('nfp') || t.includes('adp') || t.includes('fomc') || t.includes('cpi') || t.includes('ppi')) return ['XAU/USD', 'EUR/USD', 'GBP/USD']
  if (t.includes('official bank rate')) return ['GBP/USD', 'EUR/USD', 'XAU/USD']
  if (t.includes('boj')) return ['USD/JPY', 'XAU/USD']
  if (t.includes('ecb') || t.includes('refinancing')) return ['EUR/USD', 'GBP/USD']
  if (t.includes('overnight') || t.includes('boc')) return ['USD/CAD']
  if (t.includes('cash rate') || t.includes('rba')) return ['AUD/USD']
  if (t.includes('gdp')) return ['EUR/USD', 'GBP/USD', 'USD/JPY']
  if (t.includes('unemployment') || t.includes('jobless')) return ['EUR/USD', 'GBP/USD', 'XAU/USD']
  return ['EUR/USD', 'XAU/USD']
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
      .filter(e => (e.impact || '').toLowerCase() === 'high' && shouldInclude(e.title || ''))
      .map(e => {
        const isPast = new Date(e.date) < now
        const sig    = resolveSignal(e.title, e.actual, e.forecast, e.previous, isPast)
        return {
          id:        e.id || `${e.title}-${e.date}`,
          title:     e.title,
          currency:  e.country,
          date:      e.date,
          isPast,
          isNext:    false,
          forecast:  e.forecast || null,
          previous:  e.previous || null,
          actual:    e.actual   || null,
          pairs:     getPairs(e.title),
          direction: sig.direction,
          signal:    sig.signal,
        }
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    const nextIdx = events.findIndex(e => !e.isPast)
    if (nextIdx !== -1) events[nextIdx].isNext = true

    return res.status(200)
      .setHeader('Cache-Control', 's-maxage=30') // short cache so actuals update fast
      .json({ events })

  } catch (err) {
    const fallback = [
      {
        id: 'fb-1', title: 'Official Bank Rate', currency: 'GBP',
        date: new Date(Date.now() + 3600000).toISOString(),
        isPast: false, isNext: true,
        forecast: '4.25%', previous: '4.50%', actual: null,
        pairs: ['GBP/USD', 'EUR/USD', 'XAU/USD'],
        direction: 'WAIT',
        signal: 'Waiting for BOE decision. Hike/hold = BUY GBP/USD. Cut = SELL GBP/USD.',
      },
      {
        id: 'fb-2', title: 'BOJ Policy Rate', currency: 'JPY',
        date: new Date(Date.now() + 3600000 * 16).toISOString(),
        isPast: false, isNext: false,
        forecast: '0.50%', previous: '0.50%', actual: null,
        pairs: ['USD/JPY', 'XAU/USD'],
        direction: 'WAIT',
        signal: 'Waiting for BOJ decision. Hike = SELL USD/JPY. Hold = BUY USD/JPY.',
      },
    ]
    return res.status(200).json({ events: fallback, fallback: true })
  }
}
