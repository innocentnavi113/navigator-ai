// api/analyze.js — UPGRADED
// Drop-in replacement. Same endpoint, same two modes.
//
// What's new vs the original:
//   • Image mode: stronger model (gemini-2.5-pro w/ gpt-4o fallback), stricter JSON schema, retry on parse fail
//   • SMC: liquidity sweeps, equal highs/lows, inverse FVG (IFVG), OB mitigation, displacement candles
//   • Live mode supports SSE streaming via ?stream=1 OR Accept: text/event-stream
//       events: "instant" → computed result | "news" → headlines+score | "backtest" → win-rate | "ai" → polished text | "done"
//   • Recent setup backtest (last ~200 candles, win-rate of similar setups)
//   • Optional news/sentiment fusion (auto-on if NEWSAPI_KEY or CRYPTOPANIC_KEY present)
//   • Confidence breakdown: every score factor returned in `result.scoreBreakdown` with a reasoning trace
//
// Required env: OPENROUTER_API_KEY, TWELVEDATA_API_KEY
// Optional env: NEWSAPI_KEY (newsapi.org), CRYPTOPANIC_KEY (cryptopanic.com)

export const config = { maxDuration: 60 }

// ───────────────────── cache ─────────────────────
const candleCache = new Map()
const newsCache = new Map()
const CANDLE_TTL = 60_000
const NEWS_TTL = 5 * 60_000

function cacheGet(map, key, ttl) {
  const e = map.get(key); if (!e) return null
  if (Date.now() - e.ts > ttl) { map.delete(key); return null }
  return e.data
}
function cacheSet(map, key, data) { map.set(key, { data, ts: Date.now() }) }

// ───────────────────── fetch util ─────────────────────
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try { const r = await fetch(url, { ...options, signal: ctrl.signal }); clearTimeout(t); return r }
  catch (e) { clearTimeout(t); throw e }
}

// ───────────────────── handler ─────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { symbol, interval, imageBase64, imageType, prompt: customPrompt } = req.body || {}
  const wantStream =
    req.query?.stream === '1' ||
    (req.headers['accept'] || '').includes('text/event-stream')

  if (!process.env.OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY is not set' })

  // ── MODE 1: Chart image ────────────────────────────────────────────────
  if (imageBase64 && imageType) return analyzeImage({ imageBase64, imageType, customPrompt }, res)

  // ── MODE 2: Live scanner ───────────────────────────────────────────────
  if (!symbol || !interval) return res.status(400).json({ error: 'Missing symbol or interval (or imageBase64 for chart mode)' })
  if (!process.env.TWELVEDATA_API_KEY) return res.status(500).json({ error: 'TWELVEDATA_API_KEY is not set' })

  return wantStream
    ? runLiveScanStreaming(symbol, interval, res)
    : runLiveScan(symbol, interval, res)
}

// ═══════════════════════════════════════════════════════════════════════
//  IMAGE MODE
// ═══════════════════════════════════════════════════════════════════════
const IMAGE_PROMPT = `You are an elite institutional trading analyst (SMC + Classical TA). Analyze this chart with maximum precision.

Respond with ONLY a raw JSON object — no prose, no markdown, no code fences. Start with { and end with }.

Detect: candle patterns (Engulfing, Pin, Doji, Marubozu, Inside Bar, Star, Hammer), chart patterns (H&S, Double Top/Bottom, Triangle, Wedge, Flag, Cup&Handle), trend lines, MAs/RSI/MACD if visible. SMC: Order Blocks, FVG, Inverse FVG (IFVG), BOS, CHoCH, liquidity sweeps, equal highs/lows, displacement, premium/discount, inducement.

Schema (use exactly these keys):
{
  "pair": "exact instrument label from chart",
  "timeframe": "detected TF",
  "direction": "BUY" | "SELL" | "NO SIGNAL",
  "sentiment": "Strongly Bullish" | "Bullish" | "Neutral" | "Bearish" | "Strongly Bearish",
  "sentimentScore": 0-100,
  "entryPrice": "price",
  "stopLoss": "price",
  "takeProfit1": "price", "takeProfit2": "price", "takeProfit3": "price",
  "riskReward": "1:X.X",
  "smcAnalysis": {
    "orderBlock": "...", "fvg": "...", "ifvg": "...", "bos": "...", "choch": "...",
    "liquiditySweep": "...", "equalHighsLows": "...", "displacement": "...",
    "premiumDiscount": "...", "inducement": "..."
  },
  "classicalAnalysis": {
    "candlePattern": "...", "chartPattern": "...", "trendStructure": "...",
    "keyLevels": "...", "indicators": "..."
  },
  "confluenceFactors": ["...", "...", "..."],
  "priceAction": "2-3 sentences",
  "supportResistance": "2-3 sentences",
  "technicalIndicators": "2-3 sentences",
  "marketSentiment": "2-3 sentences",
  "summary": "3-4 sentence trade plan",
  "tags": ["tag","tag","tag","tag"]
}`

async function callORChat(body, timeoutMs = 30000) {
  return fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://navigator-ai-three.vercel.app',
      'X-Title': 'Navigator AI'
    },
    body: JSON.stringify(body)
  }, timeoutMs)
}

function extractJSON(text) {
  if (!text) return null
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const m = cleaned.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch { return null }
}

async function tryImageModel(model, dataUrl, prompt, timeoutMs) {
  const res = await callORChat({
    model, max_tokens: 2200, temperature: 0.2,
    messages: [{ role: 'user', content: [
      { type: 'image_url', image_url: { url: dataUrl } },
      { type: 'text', text: prompt }
    ]}]
  }, timeoutMs)
  if (!res.ok) return { ok: false, status: res.status, error: (await res.text()).slice(0, 300) }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content || ''
  const json = extractJSON(text)
  return json ? { ok: true, json } : { ok: false, status: 200, error: `Bad JSON: "${text.slice(0, 200)}"` }
}

async function analyzeImage({ imageBase64, imageType, customPrompt }, res) {
  try {
    const dataUrl = `data:${imageType};base64,${imageBase64}`
    const prompt = customPrompt || IMAGE_PROMPT

    // Tier 1: gemini-2.5-pro (vision flagship). Tier 2: gpt-4o. Tier 3: gemini-2.0-flash (cheap fallback).
    const tiers = [
      { model: 'google/gemini-2.5-pro', timeout: 35000 },
      { model: 'openai/gpt-4o',          timeout: 30000 },
      { model: 'google/gemini-2.0-flash-001', timeout: 20000 }
    ]

    let last
    for (const t of tiers) {
      try {
        last = await tryImageModel(t.model, dataUrl, prompt, t.timeout)
        if (last.ok) return res.status(200).json({ result: last.json, model: t.model })
        // hard-stop on auth/quota
        if (last.status === 401 || last.status === 402) break
      } catch (e) { last = { ok: false, status: 504, error: e.message } }
    }
    return res.status(502).json({ error: last?.error || 'All vision models failed' })
  } catch (err) {
    if (err.name === 'AbortError') return res.status(504).json({ error: 'Chart analysis timed out.' })
    return res.status(500).json({ error: err.message || 'Chart analysis failed' })
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  LIVE SCAN (shared core)
// ═══════════════════════════════════════════════════════════════════════
const HTF_MAP = {
  '1min':'5min','5min':'15min','15min':'1h','30min':'1h',
  '1h':'4h','2h':'4h','4h':'1day','1day':'1week'
}

async function loadCandles(cleanSymbol, interval) {
  const htfInterval = HTF_MAP[interval] || '4h'
  const ltfKey = `${cleanSymbol}:${interval}`
  const htfKey = `${cleanSymbol}:${htfInterval}`
  let ltfData = cacheGet(candleCache, ltfKey, CANDLE_TTL)
  let htfData = cacheGet(candleCache, htfKey, CANDLE_TTL)
  if (!ltfData || !htfData) {
    const [a, b] = await Promise.all([
      ltfData ? Promise.resolve(ltfData) : fetchCandles(cleanSymbol, interval, 200),
      htfData ? Promise.resolve(htfData) : fetchCandles(cleanSymbol, htfInterval, 100)
    ])
    ltfData = a; htfData = b
    if (!ltfData.error) cacheSet(candleCache, ltfKey, ltfData)
    if (!htfData.error) cacheSet(candleCache, htfKey, htfData)
  }
  return { ltfData, htfData, htfInterval }
}

function computeCore(cleanSymbol, interval, htfInterval, ltfData, htfData) {
  const ltf = calcIndicators(ltfData.candles)
  const htf = calcIndicators(htfData.candles)
  if (!ltf || !htf) throw new Error('Not enough candle data')

  const htfBullish = htf.latestClose > htf.sma50 && htf.sma20 > htf.sma50
  const htfBearish = htf.latestClose < htf.sma50 && htf.sma20 < htf.sma50
  const htfNeutral = !htfBullish && !htfBearish
  const htfTrend   = htfBullish ? 'BULLISH' : htfBearish ? 'BEARISH' : 'NEUTRAL'

  const ltfBullish = ltf.latestClose > ltf.sma20 && ltf.sma8 > ltf.sma20
  const ltfBearish = ltf.latestClose < ltf.sma20 && ltf.sma8 < ltf.sma20
  const ltfNearSMA20  = Math.abs(ltf.latestClose - ltf.sma20) / ltf.latestClose < 0.003
  const ltfBelowSMA20 = ltf.latestClose < ltf.sma20 * 1.002
  const ltfAboveSMA20 = ltf.latestClose > ltf.sma20 * 0.998
  const rsiBuyZone = ltf.rsi >= 30 && ltf.rsi <= 55
  const rsiSellZone = ltf.rsi >= 45 && ltf.rsi <= 70
  const rsiExtremeBuy = ltf.rsi < 35
  const rsiExtremeSell = ltf.rsi > 65

  const smc = calcSMC(ltfData.candles)

  // Score with full reasoning trace
  const breakdown = []
  const add = (label, pts, side) => { if (pts) breakdown.push({ label, pts, side }) }

  let pullbackScore = 0
  if (ltfBullish || smc.bos === 'BULLISH') {
    if (ltfBelowSMA20 || ltfNearSMA20) { pullbackScore += 20; add('Pullback to SMA20', 20, 'BUY') }
    if (rsiBuyZone || rsiExtremeBuy)   { pullbackScore += 20; add(`RSI in buy zone (${ltf.rsi.toFixed(1)})`, 20, 'BUY') }
    if (ltf.sma8 > ltf.sma20)         { pullbackScore += 15; add('SMA8 > SMA20', 15, 'BUY') }
    if (/Bull|Pin|Hammer/.test(ltf.pattern)) { pullbackScore += 15; add(`Pattern: ${ltf.pattern}`, 15, 'BUY') }
    if (ltf.sr.supports.length > 0)   { pullbackScore += 10; add('Support nearby', 10, 'BUY') }
    if (smc.bullishOB)                { pullbackScore += 15; add(`Bullish OB @ ${smc.bullishOBLevel}`, 15, 'BUY') }
    if (smc.fvg === 'BULLISH')        { pullbackScore += 10; add('Bullish FVG', 10, 'BUY') }
    if (smc.bos === 'BULLISH')        { pullbackScore += 10; add('Bullish BOS', 10, 'BUY') }
    if (smc.choch === 'BULLISH CHoCH'){ pullbackScore += 8;  add('Bullish CHoCH', 8, 'BUY') }
    if (smc.discount)                 { pullbackScore += 7;  add('In discount zone', 7, 'BUY') }
    if (smc.liquiditySwept === 'BUYSIDE_RECLAIMED') { pullbackScore += 10; add('Sell-side liquidity swept + reclaimed', 10, 'BUY') }
    if (smc.displacement === 'BULLISH') { pullbackScore += 6; add('Bullish displacement', 6, 'BUY') }
  }
  if (ltfBearish || smc.bos === 'BEARISH') {
    if (ltfAboveSMA20 || ltfNearSMA20) { pullbackScore += 20; add('Rally to SMA20', 20, 'SELL') }
    if (rsiSellZone || rsiExtremeSell) { pullbackScore += 20; add(`RSI in sell zone (${ltf.rsi.toFixed(1)})`, 20, 'SELL') }
    if (ltf.sma8 < ltf.sma20)         { pullbackScore += 15; add('SMA8 < SMA20', 15, 'SELL') }
    if (/Bear|Shooting|Marubozu/.test(ltf.pattern)) { pullbackScore += 15; add(`Pattern: ${ltf.pattern}`, 15, 'SELL') }
    if (ltf.sr.resistances.length > 0){ pullbackScore += 10; add('Resistance nearby', 10, 'SELL') }
    if (smc.bearishOB)                { pullbackScore += 15; add(`Bearish OB @ ${smc.bearishOBLevel}`, 15, 'SELL') }
    if (smc.fvg === 'BEARISH')        { pullbackScore += 10; add('Bearish FVG', 10, 'SELL') }
    if (smc.bos === 'BEARISH')        { pullbackScore += 10; add('Bearish BOS', 10, 'SELL') }
    if (smc.choch === 'BEARISH CHoCH'){ pullbackScore += 8;  add('Bearish CHoCH', 8, 'SELL') }
    if (smc.premium)                  { pullbackScore += 7;  add('In premium zone', 7, 'SELL') }
    if (smc.liquiditySwept === 'SELLSIDE_RECLAIMED') { pullbackScore += 10; add('Buy-side liquidity swept + reclaimed', 10, 'SELL') }
    if (smc.displacement === 'BEARISH') { pullbackScore += 6; add('Bearish displacement', 6, 'SELL') }
  }

  let mlScore = 0
  if (ltfBullish || ltfBearish) mlScore += 25
  mlScore += Math.round(pullbackScore * 0.25)
  if (ltf.pattern !== 'No clear pattern') mlScore += 12
  if (smc.bullishOB || smc.bearishOB) mlScore += 12
  if (smc.fvg !== 'NONE')   mlScore += 8
  if (smc.bos !== 'NONE')   mlScore += 8
  if (smc.choch !== 'NONE') mlScore += 7
  if (smc.equalHL)          mlScore += 5
  if (smc.ifvg !== 'NONE')  mlScore += 6
  if ((htfBullish && (ltfBullish || smc.bos === 'BULLISH')) ||
      (htfBearish && (ltfBearish || smc.bos === 'BEARISH'))) mlScore += 20
  else if (htfNeutral) mlScore += 8
  if ((ltfBullish && rsiBuyZone)    || (ltfBearish && rsiSellZone))    mlScore += 8
  if ((ltfBullish && rsiExtremeBuy) || (ltfBearish && rsiExtremeSell)) mlScore += 6
  mlScore = Math.min(100, mlScore)

  const htfAligned = (htfBullish && (ltfBullish || smc.bos === 'BULLISH')) ||
                     (htfBearish && (ltfBearish || smc.bos === 'BEARISH'))
  const threshold = htfAligned ? 50 : htfNeutral ? 50 : 70

  let direction = 'NO SIGNAL'
  const buySetup  = (ltfBullish || smc.bos === 'BULLISH') && pullbackScore >= 35 && mlScore >= threshold
  const sellSetup = (ltfBearish || smc.bos === 'BEARISH') && pullbackScore >= 35 && mlScore >= threshold
  if (buySetup)  direction = 'BUY'
  if (sellSetup) direction = 'SELL'
  if (buySetup && sellSetup) direction = htfBullish ? 'BUY' : htfBearish ? 'SELL' : 'NO SIGNAL'

  const dp    = ltf.latestClose < 10 ? 5 : ltf.latestClose < 1000 ? 4 : 2
  const atr   = ltf.atr
  const price = ltf.latestClose

  const buySL  = (smc.bullishOBLevel && direction === 'BUY')
    ? (smc.bullishOBLevel - atr * 0.5).toFixed(dp) : (price - atr * 1.5).toFixed(dp)
  const sellSL = (smc.bearishOBLevel && direction === 'SELL')
    ? (smc.bearishOBLevel + atr * 0.5).toFixed(dp) : (price + atr * 1.5).toFixed(dp)
  const buyTP1  = smc.fvgHigh ? smc.fvgHigh.toFixed(dp) : (price + atr * 2.0).toFixed(dp)
  const buyTP2  = (price + atr * 3.5).toFixed(dp)
  const buyTP3  = (price + atr * 5.0).toFixed(dp)
  const sellTP1 = smc.fvgLow  ? smc.fvgLow.toFixed(dp)  : (price - atr * 2.0).toFixed(dp)
  const sellTP2 = (price - atr * 3.5).toFixed(dp)
  const sellTP3 = (price - atr * 5.0).toFixed(dp)
  const sl  = direction === 'BUY' ? buySL  : sellSL
  const tp1 = direction === 'BUY' ? buyTP1 : sellTP1
  const tp2 = direction === 'BUY' ? buyTP2 : sellTP2
  const tp3 = direction === 'BUY' ? buyTP3 : sellTP3

  const result = buildFallback({
    cleanSymbol, interval, htfInterval, price, direction, mlScore, pullbackScore,
    htfTrend, ltf, htf, sl, tp1, tp2, tp3, dp, smc
  })
  result.scoreBreakdown = breakdown
  result.reasoningTrace = breakdown
    .filter(b => !direction || direction === 'NO SIGNAL' || b.side === direction)
    .map(b => `+${b.pts}: ${b.label}`)

  return { result, ltf, htf, smc, atr, price, sl, tp1, tp2, tp3, dp,
           direction, mlScore, pullbackScore, htfTrend, htfInterval, cleanSymbol }
}

// ═══════════════════════════════════════════════════════════════════════
//  Non-streaming live scan (drop-in compatible)
// ═══════════════════════════════════════════════════════════════════════
async function runLiveScan(symbol, interval, res) {
  try {
    const cleanSymbol = symbol.trim().toUpperCase()
    const { ltfData, htfData, htfInterval } = await loadCandles(cleanSymbol, interval)
    if (ltfData.error) return res.status(400).json({ error: ltfData.error })

    const core = computeCore(cleanSymbol, interval, htfInterval, ltfData, htfData)

    // Backtest hint (synchronous, fast)
    core.result.backtest = backtestSimilarSetups(ltfData.candles, core)

    // News fusion (best-effort, parallel with AI polish)
    const [news, polished] = await Promise.all([
      fetchNews(cleanSymbol).catch(() => null),
      polishText(core).catch(() => null)
    ])
    if (news) {
      core.result.news = news
      // Blend sentiment ±10 into mlScore
      const blended = clamp(core.result.mlScore + Math.round(news.score * 10), 0, 100)
      core.result.mlScoreBlended = blended
    }
    if (polished) Object.assign(core.result, polished)

    return res.status(200).json({ result: core.result })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Streaming live scan (SSE)
// ═══════════════════════════════════════════════════════════════════════
async function runLiveScanStreaming(symbol, interval, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  const send = (event, data) => {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }
  try {
    const cleanSymbol = symbol.trim().toUpperCase()
    const { ltfData, htfData, htfInterval } = await loadCandles(cleanSymbol, interval)
    if (ltfData.error) { send('error', { error: ltfData.error }); res.end(); return }

    const core = computeCore(cleanSymbol, interval, htfInterval, ltfData, htfData)
    send('instant', { result: core.result })

    const bt = backtestSimilarSetups(ltfData.candles, core)
    core.result.backtest = bt
    send('backtest', bt)

    const newsP = fetchNews(cleanSymbol).then(news => {
      if (!news) return
      core.result.news = news
      core.result.mlScoreBlended = clamp(core.result.mlScore + Math.round(news.score * 10), 0, 100)
      send('news', { ...news, mlScoreBlended: core.result.mlScoreBlended })
    }).catch(() => {})

    const aiP = polishText(core).then(polished => {
      if (!polished) return
      Object.assign(core.result, polished)
      send('ai', polished)
    }).catch(() => {})

    await Promise.all([newsP, aiP])
    send('done', { result: core.result })
    res.end()
  } catch (err) {
    send('error', { error: err.message || 'Internal server error' })
    res.end()
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  AI polish (4 narrative fields)
// ═══════════════════════════════════════════════════════════════════════
async function polishText(core) {
  const { cleanSymbol, direction, htfTrend, htfInterval, price, sl, tp1, tp2, tp3,
          ltf, atr, dp, smc, mlScore, pullbackScore } = core
  const prompt = `You are an institutional trading analyst. Rewrite these 4 fields using ONLY the data below. Each under 140 chars. Reply ONLY with JSON.

DATA:
Symbol: ${cleanSymbol} | Direction: ${direction} | HTF: ${htfTrend} on ${htfInterval}
Price: ${price} | SL: ${sl} | TP1: ${tp1} | TP2: ${tp2} | TP3: ${tp3}
Pattern: ${ltf.pattern} | RSI: ${ltf.rsi?.toFixed(1)} | ATR: ${atr?.toFixed(dp)}
SMA8: ${ltf.sma8?.toFixed(dp)} | SMA20: ${ltf.sma20?.toFixed(dp)} | SMA50: ${ltf.sma50?.toFixed(dp)}
OB: ${smc.bullishOB ? 'Bullish at '+smc.bullishOBLevel?.toFixed(dp) : smc.bearishOB ? 'Bearish at '+smc.bearishOBLevel?.toFixed(dp) : 'None'}
FVG: ${smc.fvg} | IFVG: ${smc.ifvg} | BOS: ${smc.bos} | CHoCH: ${smc.choch}
Liquidity: ${smc.liquiditySwept || 'None'} | EQH/EQL: ${smc.equalHL || 'None'} | Displacement: ${smc.displacement || 'None'}
Zone: ${smc.premium ? 'Premium' : smc.discount ? 'Discount' : 'Equilibrium'}
ML: ${mlScore}/100 | Pullback: ${pullbackScore}

{"priceAction":"...","supportResistance":"...","marketSentiment":"...","summary":"..."}`

  const r = await callORChat({
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    max_tokens: 450, temperature: 0.4,
    messages: [{ role: 'user', content: prompt }]
  }, 7000)
  if (!r.ok) return null
  const data = await r.json()
  const json = extractJSON(data.choices?.[0]?.message?.content || '')
  if (!json) return null
  const out = {}
  for (const k of ['priceAction', 'supportResistance', 'marketSentiment', 'summary'])
    if (json[k]) out[k] = json[k]
  return out
}

// ═══════════════════════════════════════════════════════════════════════
//  News fusion
// ═══════════════════════════════════════════════════════════════════════
const POS_WORDS = ['surge','rally','soar','beat','bullish','upgrade','growth','record','breakthrough','approve','gain','jump','rise','strong','optimism','boost','outperform']
const NEG_WORDS = ['plunge','crash','tumble','miss','bearish','downgrade','decline','loss','recession','ban','drop','fall','weak','fear','warn','underperform','probe','lawsuit']

function scoreSentiment(text) {
  const t = text.toLowerCase()
  let s = 0
  for (const w of POS_WORDS) if (t.includes(w)) s += 1
  for (const w of NEG_WORDS) if (t.includes(w)) s -= 1
  return s
}

async function fetchNews(symbol) {
  const cached = cacheGet(newsCache, symbol, NEWS_TTL); if (cached) return cached
  let headlines = []

  // Crypto: cryptopanic
  if (process.env.CRYPTOPANIC_KEY && /BTC|ETH|SOL|XRP|DOGE|ADA|BNB/.test(symbol)) {
    try {
      const base = symbol.split('/')[0]
      const url = `https://cryptopanic.com/api/v1/posts/?auth_token=${process.env.CRYPTOPANIC_KEY}&currencies=${base}&public=true`
      const r = await fetchWithTimeout(url, {}, 5000)
      if (r.ok) {
        const j = await r.json()
        headlines = (j.results || []).slice(0, 8).map(p => ({ title: p.title, url: p.url, source: p.source?.title }))
      }
    } catch {}
  }

  // Generic: NewsAPI
  if (headlines.length === 0 && process.env.NEWSAPI_KEY) {
    try {
      const q = encodeURIComponent(symbol.replace('/', ' '))
      const url = `https://newsapi.org/v2/everything?q=${q}&pageSize=8&language=en&sortBy=publishedAt&apiKey=${process.env.NEWSAPI_KEY}`
      const r = await fetchWithTimeout(url, {}, 5000)
      if (r.ok) {
        const j = await r.json()
        headlines = (j.articles || []).map(a => ({ title: a.title, url: a.url, source: a.source?.name }))
      }
    } catch {}
  }

  if (headlines.length === 0) return null
  const raw = headlines.reduce((s, h) => s + scoreSentiment(h.title || ''), 0)
  const norm = clamp(raw / Math.max(3, headlines.length), -1, 1) // -1..+1
  const out = {
    headlines: headlines.slice(0, 5),
    score: norm,
    label: norm > 0.25 ? 'Bullish' : norm < -0.25 ? 'Bearish' : 'Neutral'
  }
  cacheSet(newsCache, symbol, out)
  return out
}

// ═══════════════════════════════════════════════════════════════════════
//  Backtest: how often did similar setups hit TP1 before SL recently?
// ═══════════════════════════════════════════════════════════════════════
function backtestSimilarSetups(candles, core) {
  if (!candles || candles.length < 80) return { samples: 0, winRate: null, note: 'not enough history' }
  const lookahead = 20 // bars forward
  const { ltf } = core
  const dir = core.direction
  if (dir === 'NO SIGNAL') return { samples: 0, winRate: null, note: 'no active signal' }

  let samples = 0, wins = 0
  for (let i = 55; i < candles.length - lookahead - 1; i++) {
    const slice = candles.slice(0, i + 1)
    const ind = calcIndicators(slice); if (!ind) continue
    const smc = calcSMC(slice)
    const bull = ind.latestClose > ind.sma20 && ind.sma8 > ind.sma20
    const bear = ind.latestClose < ind.sma20 && ind.sma8 < ind.sma20

    const matches = dir === 'BUY'
      ? (bull && (smc.bullishOB || smc.fvg === 'BULLISH' || smc.bos === 'BULLISH'))
      : (bear && (smc.bearishOB || smc.fvg === 'BEARISH' || smc.bos === 'BEARISH'))
    if (!matches) continue

    const entry = ind.latestClose
    const atr = ind.atr
    const sl = dir === 'BUY' ? entry - atr * 1.5 : entry + atr * 1.5
    const tp = dir === 'BUY' ? entry + atr * 2.0 : entry - atr * 2.0

    let hit = null
    for (let k = 1; k <= lookahead && (i + k) < candles.length; k++) {
      const c = candles[i + k]
      if (dir === 'BUY')  { if (c.low  <= sl) { hit = 'sl'; break } if (c.high >= tp) { hit = 'tp'; break } }
      else                { if (c.high >= sl) { hit = 'sl'; break } if (c.low  <= tp) { hit = 'tp'; break } }
    }
    if (hit) { samples++; if (hit === 'tp') wins++ }
  }
  return {
    samples,
    winRate: samples ? Math.round((wins / samples) * 100) : null,
    lookaheadBars: lookahead,
    note: samples < 5 ? 'low sample size — treat as indicative' : 'recent in-sample fit'
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Data fetch
// ═══════════════════════════════════════════════════════════════════════
async function fetchCandles(symbol, interval, outputsize = 100) {
  const variants = [symbol, symbol.replace('/', ''), symbol.replace('/', '') + 'T']
  for (const sym of [...new Set(variants)]) {
    try {
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=${interval}&outputsize=${outputsize}&apikey=${process.env.TWELVEDATA_API_KEY}&format=JSON`
      const res  = await fetchWithTimeout(url, {}, 8000)
      const data = await res.json()
      if (data.status !== 'error' && data.values?.length > 10) {
        return { candles: data.values.reverse().map(c => ({
          time: c.datetime, open: +c.open, high: +c.high, low: +c.low, close: +c.close,
          volume: parseFloat(c.volume || 0)
        })) }
      }
    } catch {}
  }
  return { error: `Could not fetch data for "${symbol}". Try: EURUSD, BTC/USD, XAU/USD, SPY` }
}

// ═══════════════════════════════════════════════════════════════════════
//  Indicators
// ═══════════════════════════════════════════════════════════════════════
function calcIndicators(candles) {
  if (!candles || candles.length < 55) return null
  const closes = candles.map(c => c.close)
  const highs  = candles.map(c => c.high)
  const lows   = candles.map(c => c.low)
  const n = closes.length

  const sma = (data, p) => {
    if (data.length < p) return null
    const out = new Array(p - 1).fill(null)
    for (let i = p - 1; i < data.length; i++)
      out.push(data.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p)
    return out
  }
  const rsi = (data, p = 14) => {
    if (data.length < p + 1) return null
    const out = new Array(p).fill(null)
    let g = 0, l = 0
    for (let i = 1; i <= p; i++) { const d = data[i] - data[i - 1]; if (d > 0) g += d; else l += -d }
    let ag = g / p, al = l / p
    out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al))
    for (let i = p + 1; i < data.length; i++) {
      const d = data[i] - data[i - 1]
      ag = (ag * (p - 1) + (d > 0 ? d : 0)) / p
      al = (al * (p - 1) + (d < 0 ? -d : 0)) / p
      out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al))
    }
    return out
  }
  const atrCalc = (h, l, c, p = 14) => {
    const trs = [h[0] - l[0]]
    for (let i = 1; i < h.length; i++)
      trs.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])))
    let a = trs.slice(0, p).reduce((x, y) => x + y, 0) / p
    for (let i = p; i < trs.length; i++) a = (a * (p - 1) + trs[i]) / p
    return a
  }
  const sr = () => {
    const supports = [], resistances = [], k = 5
    const price = closes[closes.length - 1]
    for (let i = k; i < highs.length - k; i++) {
      let isHigh = true, isLow = true
      for (let j = i - k; j <= i + k; j++) {
        if (j === i) continue
        if (highs[j] >= highs[i]) isHigh = false
        if (lows[j]  <= lows[i])  isLow  = false
      }
      if (isHigh) resistances.push(highs[i])
      if (isLow)  supports.push(lows[i])
    }
    return {
      supports: supports.filter(s => s < price).slice(-3),
      resistances: resistances.filter(r => r > price).slice(0, 3)
    }
  }
  const pattern = () => {
    const last = candles[n - 1], prev = candles[n - 2], prev2 = candles[n - 3]
    if (!last || !prev) return 'None detected'
    const body = Math.abs(last.close - last.open)
    const range = last.high - last.low
    const lower = Math.min(last.open, last.close) - last.low
    const upper = last.high - Math.max(last.open, last.close)
    if (prev.close < prev.open && last.close > last.open && last.open < prev.close && last.close > prev.open) return 'Bullish Engulfing'
    if (prev.close > prev.open && last.close < last.open && last.open > prev.close && last.close < prev.open) return 'Bearish Engulfing'
    if (lower > body * 2 && upper < body && last.close > last.open) return 'Bullish Pin Bar'
    if (upper > body * 2 && lower < body && last.close < last.open) return 'Bearish Shooting Star'
    if (body < range * 0.1) return 'Doji'
    if (body > range * 0.9) return last.close > last.open ? 'Bullish Marubozu' : 'Bearish Marubozu'
    if (last.high < prev.high && last.low > prev.low) return 'Inside Bar'
    if (prev2 && prev.close < prev.open && last.close > last.open && prev2.close > prev2.open) return 'Morning Star'
    if (prev2 && prev.close > prev.open && last.close < last.open && prev2.close < prev2.open) return 'Evening Star'
    if (lower > body * 1.5 && upper < body * 0.5) return 'Hammer'
    return 'No clear pattern'
  }

  const sma8  = sma(closes, 8)
  const sma20 = sma(closes, 20)
  const sma50 = sma(closes, 50)
  const r14   = rsi(closes, 14)

  return {
    latestClose: closes[n - 1],
    sma8:  sma8?.[n - 1]  ?? null,
    sma20: sma20?.[n - 1] ?? null,
    sma50: sma50?.[n - 1] ?? null,
    rsi:   r14?.[n - 1]   ?? 50,
    atr:   atrCalc(highs, lows, closes, 14),
    sr:    sr(),
    pattern: pattern()
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  SMC (UPGRADED)
// ═══════════════════════════════════════════════════════════════════════
function calcSMC(candles) {
  const empty = {
    bullishOB:false, bearishOB:false, bullishOBLevel:null, bearishOBLevel:null,
    obMitigated:null, fvg:'NONE', fvgHigh:null, fvgLow:null, ifvg:'NONE',
    bos:'NONE', choch:'NONE', premium:false, discount:false,
    liquiditySwept:null, equalHL:null, displacement:null
  }
  if (!candles || candles.length < 25) return empty

  const n = candles.length
  const price = candles[n - 1].close
  const out = { ...empty }

  // ── Order Blocks (last bull/bear candle before strong impulse) ──
  for (let i = n - 12; i < n - 2; i++) {
    const c = candles[i], next = candles[i + 1], next2 = candles[i + 2]
    const avgRange = candles.slice(Math.max(0, i - 10), i)
      .reduce((s, cc) => s + (cc.high - cc.low), 0) / 10
    if (c.close < c.open && next.close > next.open && next2.close > next2.open) {
      if ((next2.close - c.low) > avgRange * 1.5) { out.bullishOB = true; out.bullishOBLevel = c.low }
    }
    if (c.close > c.open && next.close < next.open && next2.close < next2.open) {
      if ((c.high - next2.close) > avgRange * 1.5) { out.bearishOB = true; out.bearishOBLevel = c.high }
    }
  }

  // OB mitigation: did price recently revisit the OB?
  if (out.bullishOB) {
    const recentLows = candles.slice(-6).map(c => c.low)
    if (Math.min(...recentLows) <= out.bullishOBLevel * 1.001) out.obMitigated = 'BULLISH_OB_MITIGATED'
  }
  if (out.bearishOB) {
    const recentHighs = candles.slice(-6).map(c => c.high)
    if (Math.max(...recentHighs) >= out.bearishOBLevel * 0.999) out.obMitigated = 'BEARISH_OB_MITIGATED'
  }

  // ── FVG (3-candle imbalance) ──
  for (let i = n - 8; i < n - 2; i++) {
    const c1 = candles[i], c3 = candles[i + 2]
    if (c3.low > c1.high) { out.fvg = 'BULLISH'; out.fvgHigh = c3.low; out.fvgLow = c1.high; break }
    if (c3.high < c1.low) { out.fvg = 'BEARISH'; out.fvgHigh = c1.low; out.fvgLow = c3.high; break }
  }

  // ── Inverse FVG: an FVG that was filled and reclaimed (flips role) ──
  for (let i = n - 20; i < n - 5; i++) {
    const c1 = candles[i], c3 = candles[i + 2]; if (!c3) continue
    if (c3.low > c1.high) {
      // bullish FVG → if later closed below c1.high then back above, IFVG bearish-turned-bullish reclaim
      const later = candles.slice(i + 3)
      const filled = later.some(c => c.low <= c1.high)
      const reclaimed = filled && later[later.length - 1].close > c3.low
      if (filled && reclaimed) { out.ifvg = 'BULLISH_RECLAIM'; break }
    }
    if (c3.high < c1.low) {
      const later = candles.slice(i + 3)
      const filled = later.some(c => c.high >= c1.low)
      const reclaimed = filled && later[later.length - 1].close < c3.high
      if (filled && reclaimed) { out.ifvg = 'BEARISH_RECLAIM'; break }
    }
  }

  // ── BOS / CHoCH ──
  const recentHigh = Math.max(...candles.slice(n - 15, n - 1).map(c => c.high))
  const recentLow  = Math.min(...candles.slice(n - 15, n - 1).map(c => c.low))
  if (candles[n - 1].close > recentHigh) out.bos = 'BULLISH'
  if (candles[n - 1].close < recentLow)  out.bos = 'BEARISH'
  const prevTrend = candles[n - 10].close < candles[n - 5].close ? 'UP' : 'DOWN'
  if (prevTrend === 'UP'   && out.bos === 'BEARISH') out.choch = 'BEARISH CHoCH'
  if (prevTrend === 'DOWN' && out.bos === 'BULLISH') out.choch = 'BULLISH CHoCH'

  // ── Premium / Discount ──
  const rangeHigh = Math.max(...candles.slice(n - 20).map(c => c.high))
  const rangeLow  = Math.min(...candles.slice(n - 20).map(c => c.low))
  const eq = (rangeHigh + rangeLow) / 2
  out.premium = price > eq
  out.discount = price < eq

  // ── Equal Highs / Equal Lows (liquidity pools) ──
  const eqTol = (rangeHigh - rangeLow) * 0.0015
  const last20 = candles.slice(-20)
  const highs = last20.map(c => c.high).sort((a, b) => b - a)
  const lows  = last20.map(c => c.low).sort((a, b) => a - b)
  if (highs[0] - highs[1] < eqTol && highs[1] - highs[2] < eqTol) out.equalHL = 'EQUAL_HIGHS'
  else if (lows[1] - lows[0] < eqTol && lows[2] - lows[1] < eqTol) out.equalHL = 'EQUAL_LOWS'

  // ── Liquidity sweep + reclaim ──
  // Sell-side: swept previous low, then closed back above it
  const prevLow  = Math.min(...candles.slice(n - 20, n - 3).map(c => c.low))
  const prevHigh = Math.max(...candles.slice(n - 20, n - 3).map(c => c.high))
  const last3 = candles.slice(-3)
  const sweptLow  = last3.some(c => c.low  < prevLow)
  const sweptHigh = last3.some(c => c.high > prevHigh)
  if (sweptLow  && candles[n - 1].close > prevLow)  out.liquiditySwept = 'BUYSIDE_RECLAIMED'  // sell-side liq grabbed → bullish
  if (sweptHigh && candles[n - 1].close < prevHigh) out.liquiditySwept = 'SELLSIDE_RECLAIMED' // buy-side liq grabbed → bearish

  // ── Displacement (last candle range > 1.8× avg of prior 10) ──
  const avgRng = candles.slice(-11, -1).reduce((s, c) => s + (c.high - c.low), 0) / 10
  const lastRng = candles[n - 1].high - candles[n - 1].low
  if (lastRng > avgRng * 1.8) {
    out.displacement = candles[n - 1].close > candles[n - 1].open ? 'BULLISH' : 'BEARISH'
  }

  return out
}

// ═══════════════════════════════════════════════════════════════════════
//  Fallback narrative
// ═══════════════════════════════════════════════════════════════════════
function buildFallback({ cleanSymbol, interval, htfInterval, price, direction, mlScore, pullbackScore, htfTrend, ltf, htf, sl, tp1, tp2, tp3, dp, smc }) {
  return {
    pair: cleanSymbol, timeframe: interval, htfTimeframe: htfInterval,
    currentPrice: String(price), direction,
    setupName: `HTF ${htfTrend} + ${smc?.bullishOB || smc?.bearishOB ? 'OB' : 'Mean Reversion'} + ${ltf.pattern}`,
    mlScore, pullbackScore, htfTrend,
    htfAnalysis: `${htfInterval} trend is ${htfTrend}. SMA20=${htf.sma20?.toFixed(dp)} SMA50=${htf.sma50?.toFixed(dp)}.`,
    trendDirection: htfTrend === 'BULLISH' ? 'Bullish' : htfTrend === 'BEARISH' ? 'Bearish' : 'Neutral',
    trendStrength: mlScore >= 70 ? 'STRONG' : mlScore >= 50 ? 'MODERATE' : 'WEAK',
    meanReversionZone: `SMA 20 at ${ltf.sma20?.toFixed(dp)}`,
    rsiReading: `RSI ${ltf.rsi?.toFixed(1)}`,
    candlePattern: ltf.pattern,
    smcOrderBlock: smc?.bullishOB ? `Bullish OB at ${smc.bullishOBLevel?.toFixed(dp)}` : smc?.bearishOB ? `Bearish OB at ${smc.bearishOBLevel?.toFixed(dp)}` : 'None detected',
    smcFVG: smc?.fvg ? `${smc.fvg} FVG` : 'None',
    smcIFVG: smc?.ifvg && smc.ifvg !== 'NONE' ? smc.ifvg : 'None',
    smcBOS: smc?.bos ? `${smc.bos} BOS` : 'None',
    smcCHoCH: smc?.choch || 'None',
    smcZone: smc?.premium ? 'Premium - sell zone' : smc?.discount ? 'Discount - buy zone' : 'Equilibrium',
    smcLiquidity: smc?.liquiditySwept || 'None',
    smcEqualHL: smc?.equalHL || 'None',
    smcDisplacement: smc?.displacement || 'None',
    smcMitigation: smc?.obMitigated || 'None',
    entryPrice: String(price), stopLoss: sl,
    takeProfit1: tp1, takeProfit2: tp2, takeProfit3: tp3,
    riskReward: '1:3.3',
    sentiment: htfTrend === 'BULLISH' ? 'Bullish' : htfTrend === 'BEARISH' ? 'Bearish' : 'Neutral',
    sentimentScore: mlScore,
    priceAction: `${ltf.pattern} at ${price}. ${smc?.bullishOB ? 'Bullish OB confluence.' : smc?.bearishOB ? 'Bearish OB confluence.' : 'Near SMA20.'}`,
    supportResistance: `Support: ${ltf.sr.supports.map(s=>s.toFixed(dp)).join(', ')||'none'}. Resistance: ${ltf.sr.resistances.map(r=>r.toFixed(dp)).join(', ')||'none'}.`,
    technicalIndicators: `SMA8=${ltf.sma8?.toFixed(dp)} SMA20=${ltf.sma20?.toFixed(dp)} RSI=${ltf.rsi?.toFixed(1)} ATR=${ltf.atr?.toFixed(dp)}. FVG: ${smc?.fvg}. BOS: ${smc?.bos}.`,
    marketSentiment: `HTF ${htfInterval} is ${htfTrend}. SMC zone: ${smc?.premium ? 'Premium' : smc?.discount ? 'Discount' : 'Equilibrium'}. ML Score ${mlScore}/100.`,
    summary: `${direction} on ${cleanSymbol}. Entry=${price} SL=${sl} TP1=${tp1}. OB: ${smc?.bullishOB || smc?.bearishOB ? 'confirmed' : 'none'}. ML=${mlScore}/100.`,
    tags: [htfTrend, ltf.pattern.split(' ')[0], smc?.bos !== 'NONE' ? smc?.bos + ' BOS' : 'No BOS', direction === 'NO SIGNAL' ? 'Waiting' : direction]
  }
}

// ───────────────────── tiny utils ─────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
