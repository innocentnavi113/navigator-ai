// api/calendar.js
// Fetches economic calendar events from Finnhub (NFP, CPI, PPI, FOMC, etc.)
// Key stays server-side — never exposed to the browser.

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.FINNHUB_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'FINNHUB_KEY not configured' })
  }

  const days = parseInt(req.query.days) || 14
  const from = new Date().toISOString().split('T')[0]
  const to = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  try {
    const url = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${apiKey}`
    const response = await fetch(url, {
      headers: { 'X-Finnhub-Token': apiKey }
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(response.status).json({ error: `Finnhub error: ${err}` })
    }

    const data = await response.json()

    // Filter to high-impact events we care about
    const KEY_EVENTS = [
      'Non-Farm Payrolls',
      'NFP',
      'CPI',
      'Consumer Price Index',
      'PPI',
      'Producer Price Index',
      'FOMC',
      'Federal Funds Rate',
      'Interest Rate Decision',
      'Unemployment Rate',
      'GDP',
      'PCE',
      'Retail Sales',
    ]

    const events = (data.economicCalendar || []).filter(e =>
      KEY_EVENTS.some(k => e.event?.toLowerCase().includes(k.toLowerCase()))
    )

    // Normalize event names for display
    const normalizeName = (name) => {
      const n = name || ''
      if (n.includes('Non-Farm') || n === 'NFP') return 'NFP (Non-Farm Payrolls)'
      if (n.includes('Consumer Price') || n === 'CPI') return 'CPI (Inflation)'
      if (n.includes('Producer Price') || n === 'PPI') return 'PPI (Producer Prices)'
      if (n.includes('FOMC') || n.includes('Federal Funds')) return 'FOMC (Rate Decision)'
      if (n.includes('Unemployment')) return 'Unemployment Rate'
      return name
    }

    const cleaned = events.map(e => ({
      id: `${e.time}-${e.event}`,
      event: normalizeName(e.event),
      country: e.country,
      date: new Date(e.time * 1000).toISOString(),
      impact: (e.impact || 'low').toLowerCase(),
      actual: e.actual ?? null,
      estimate: e.estimate ?? null,
      previous: e.prev ?? null,
      unit: e.unit || '',
      isReleased: e.actual != null,
    }))

    // Sort by date ascending
    cleaned.sort((a, b) => new Date(a.date) - new Date(b.date))

    // Cache for 15 minutes
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')

    return res.status(200).json({
      events: cleaned,
      range: { from, to },
      count: cleaned.length,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch calendar' })
  }
}
