// api/analyze.js
// Handles two modes:
// 1. Chart image analysis (imageBase64 + imageType provided)
// 2. Live market scanner (symbol + interval provided)

// ── Vercel max duration (requires Pro for >10s) ──────────────────────────────
export const config = { maxDuration: 60 }

// ── In-memory cache for candle data (60s TTL) ────────────────────────────────
const candleCache = new Map()
const CACHE_TTL = 60_000

function getCached(key) {
  const entry = candleCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { candleCache.delete(key); return null }
  return entry.data
}
function setCache(key, data) {
  candleCache.set(key, { data, ts: Date.now() })
}

// ── Fetch with timeout helper ─────────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { symbol, interval, imageBase64, imageType, prompt: customPrompt } = req.body

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY is not set' })
  }

  // ── MODE 1: Chart image analysis ─────────────────────────────────────
  if (imageBase64 && imageType) {
    try {
      const prompt = customPrompt || `You are an elite institutional trading analyst specializing in Smart Money Concepts (SMC) and Classical Technical Analysis. Analyze this trading chart screenshot with maximum precision.

You MUST respond with ONLY a JSON object. No text before or after. No markdown. No explanation. Just the raw JSON starting with { and ending with }.

Analyze using BOTH SMC and Classical TA frameworks:

SMC Framework — identify:
- Order Blocks (OB): Last bullish/bearish candle before a strong move
- Fair Value Gaps (FVG): 3-candle imbalance zones
- Break of Structure (BOS): Higher high/lower low confirmation
- Change of Character (CHoCH): First sign of trend reversal
- Liquidity sweeps: Equal highs/lows that got swept
- Premium/Discount zones: Above/below 50% of the range
- Inducement levels: Obvious levels set to trap retail

Classical TA Framework — identify:
- Candlestick patterns: Engulfing, Pin Bar, Doji, Hammer, Shooting Star, Marubozu, Inside Bar, Morning/Evening Star, Harami
- Chart patterns: Head & Shoulders, Double Top/Bottom, Triangle, Wedge, Flag, Cup & Handle
- Key S/R levels from swing highs/lows
- Moving average positions if visible
- RSI/MACD divergence if visible
- Trend lines and channels

{
  "pair": "READ exact instrument name from chart label. Do not guess.",
  "timeframe": "detected timeframe e.g. H1",
  "direction": "BUY or SELL or NO SIGNAL",
  "sentiment": "Bullish or Bearish or Neutral or Strongly Bullish or Strongly Bearish",
  "sentimentScore": 75,
  "entryPrice": "exact price level from chart",
  "stopLoss": "exact price level - place below OB or swing low for BUY, above OB or swing high for SELL",
  "takeProfit1": "first target - nearest liquidity or FVG fill",
  "takeProfit2": "second target - next significant level",
  "takeProfit3": "third target - major structural level",
  "riskReward": "e.g. 1:2.5",
  "smcAnalysis": {
    "orderBlock": "describe the key order block level and direction",
    "fvg": "describe any fair value gap present",
    "bos": "describe last break of structure",
    "choch": "describe change of character if present or none",
    "liquiditySweep": "describe any liquidity sweep visible",
    "premiumDiscount": "is price in premium or discount zone",
    "inducement": "any inducement levels visible"
  },
  "classicalAnalysis": {
    "candlePattern": "specific candlestick pattern detected",
    "chartPattern": "chart pattern if any e.g. Double Bottom or none",
    "trendStructure": "describe the trend structure",
    "keyLevels": "describe key S/R levels",
    "indicators": "describe any visible indicators"
  },
  "confluenceFactors": ["factor1", "factor2", "factor3"],
  "priceAction": "2-3 sentences combining SMC and classical price action",
  "supportResistance": "2-3 sentences on key levels from both frameworks",
  "technicalIndicators": "2-3 sentences on visible indicators and SMC zones",
  "marketSentiment": "2-3 sentences on overall bias from both SMC and classical",
  "summary": "3-4 sentences comprehensive recommendation combining both frameworks",
  "tags": ["tag1", "tag2", "tag3", "tag4"]
}`

      const aiRes = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://navigator-ai-three.vercel.app',
          'X-Title': 'Navigator AI'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${imageType};base64,${imageBase64}` } },
              { type: 'text', text: prompt }
            ]
          }]
        })
      }, 25000)

      const aiData = await aiRes.json()
      if (!aiRes.ok) return res.status(aiRes.status).json({ error: aiData.error?.message || 'AI error' })

      let text = aiData.choices?.[0]?.message?.content || ''
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim()
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return res.status(500).json({ error: `Model returned unexpected content: "${text.slice(0, 200)}"` })

      let result
      try { result = JSON.parse(jsonMatch[0]) }
      catch (e) { return res.status(500).json({ error: 'Failed to parse AI response as JSON' }) }

      return res.status(200).json({ result })

    } catch (err) {
      if (err.name === 'AbortError') return res.status(504).json({ error: 'Chart analysis timed out. Please try again.' })
      return res.status(500).json({ error: err.message || 'Chart analysis failed' })
    }
  }

  // ── MODE 2: Live market scanner ────────────────────────────────────────────
  if (!symbol || !interval) {
    return res.status(400).json({ error: 'Missing symbol or interval (or imageBase64 for chart mode)' })
  }

  if (!process.env.TWELVEDATA_API_KEY) {
    return res.status(500).json({ error: 'TWELVEDATA_API_KEY is not set' })
  }

  const htfMap = {
    '1min': '15min', '5min': '1h', '15min': '4h', '30min': '4h',
    '1h': '1day', '2h': '1day', '4h': '1week', '1day': '1month'
  }
  const htfInterval = htfMap[interval] || '1day'

  try {
    const cleanSymbol = symbol.trim().toUpperCase()

    // ── Fetch candles with caching ──────────────────────────────────────
    const ltfKey = `${cleanSymbol}:${interval}`
    const htfKey = `${cleanSymbol}:${htfInterval}`

    let ltfData = getCached(ltfKey)
    let htfData = getCached(htfKey)

    if (!ltfData || !htfData) {
      const [freshLtf, freshHtf] = await Promise.all([
        ltfData ? Promise.resolve(ltfData) : fetchCandles(cleanSymbol, interval),
        htfData ? Promise.resolve(htfData) : fetchCandles(cleanSymbol, htfInterval)
      ])
      ltfData = freshLtf
      htfData = freshHtf
      if (!ltfData.error) setCache(ltfKey, ltfData)
      if (!htfData.error) setCache(htfKey, htfData)
    }

    if (ltfData.error) return res.status(400).json({ error: ltfData.error })

    const ltf = calcIndicators(ltfData.candles)
    const htf = calcIndicators(htfData.candles)

    if (!ltf || !htf) return res.status(500).json({ error: 'Not enough candle data' })

    // ── Classical TA signals ──
    const htfBullish = htf.latestClose > htf.sma50 && htf.sma20 > htf.sma50
    const htfBearish = htf.latestClose < htf.sma50 && htf.sma20 < htf.sma50
    const htfTrend   = htfBullish ? 'BULLISH' : htfBearish ? 'BEARISH' : 'NEUTRAL'

    const ltfNearSMA20   = Math.abs(ltf.latestClose - ltf.sma20) / ltf.latestClose < 0.003
    const ltfBelowSMA20  = ltf.latestClose < ltf.sma20 * 1.002
    const ltfAboveSMA20  = ltf.latestClose > ltf.sma20 * 0.998
    const rsiBuyZone     = ltf.rsi >= 30 && ltf.rsi <= 50
    const rsiSellZone    = ltf.rsi >= 50 && ltf.rsi <= 70
    const rsiExtremeBuy  = ltf.rsi < 35
    const rsiExtremeSell = ltf.rsi > 65

    // ── SMC signals ──
    const smc = calcSMC(ltfData.candles)

    let pullbackScore = 0
    if (htfBullish) {
      if (ltfBelowSMA20 || ltfNearSMA20) pullbackScore += 25
      if (rsiBuyZone || rsiExtremeBuy)   pullbackScore += 20
      if (ltf.sma8 > ltf.sma20)         pullbackScore += 10
      if (ltf.pattern.includes('Bull') || ltf.pattern.includes('Pin')) pullbackScore += 15
      if (ltf.sr.supports.length > 0)   pullbackScore += 10
      if (smc.bullishOB)                pullbackScore += 15
      if (smc.fvg === 'BULLISH')        pullbackScore += 10
      if (smc.bos === 'BULLISH')        pullbackScore += 10
      if (smc.discount)                 pullbackScore += 5
    }
    if (htfBearish) {
      if (ltfAboveSMA20 || ltfNearSMA20) pullbackScore += 25
      if (rsiSellZone || rsiExtremeSell) pullbackScore += 20
      if (ltf.sma8 < ltf.sma20)         pullbackScore += 10
      if (ltf.pattern.includes('Bear') || ltf.pattern.includes('Shooting')) pullbackScore += 15
      if (ltf.sr.resistances.length > 0) pullbackScore += 10
      if (smc.bearishOB)                pullbackScore += 15
      if (smc.fvg === 'BEARISH')        pullbackScore += 10
      if (smc.bos === 'BEARISH')        pullbackScore += 10
      if (smc.premium)                  pullbackScore += 5
    }

    let mlScore = 0
    if (htfBullish || htfBearish) mlScore += 30
    mlScore += Math.round(pullbackScore * 0.3)
    if ((htfBullish && rsiBuyZone)  || (htfBearish && rsiSellZone))     mlScore += 10
    if ((htfBullish && rsiExtremeBuy) || (htfBearish && rsiExtremeSell)) mlScore += 8
    if (ltf.pattern !== 'No clear pattern') mlScore += 12
    if (smc.bullishOB || smc.bearishOB) mlScore += 12
    if (smc.fvg !== 'NONE')             mlScore += 8
    if (smc.bos !== 'NONE')             mlScore += 8
    if (smc.choch !== 'NONE')           mlScore += 7
    mlScore = Math.min(100, mlScore)

    let direction = 'NO SIGNAL'
    if (htfBullish && pullbackScore >= 40 && mlScore >= 55) direction = 'BUY'
    if (htfBearish && pullbackScore >= 40 && mlScore >= 55) direction = 'SELL'

    const dp    = ltf.latestClose < 10 ? 5 : ltf.latestClose < 1000 ? 4 : 2
    const atr   = ltf.atr
    const price = ltf.latestClose

    let buySL, sellSL
    if (smc.bullishOBLevel && direction === 'BUY') {
      buySL = (smc.bullishOBLevel - atr * 0.5).toFixed(dp)
    } else {
      buySL = (price - atr * 1.5).toFixed(dp)
    }
    if (smc.bearishOBLevel && direction === 'SELL') {
      sellSL = (smc.bearishOBLevel + atr * 0.5).toFixed(dp)
    } else {
      sellSL = (price + atr * 1.5).toFixed(dp)
    }

    const buyTP1  = smc.fvgHigh ? smc.fvgHigh.toFixed(dp) : (price + atr * 2.0).toFixed(dp)
    const buyTP2  = (price + atr * 3.5).toFixed(dp)
    const buyTP3  = (price + atr * 5.0).toFixed(dp)
    const sellTP1 = smc.fvgLow ? smc.fvgLow.toFixed(dp) : (price - atr * 2.0).toFixed(dp)
    const sellTP2 = (price - atr * 3.5).toFixed(dp)
    const sellTP3 = (price - atr * 5.0).toFixed(dp)

    const sl  = direction === 'BUY' ? buySL  : sellSL
    const tp1 = direction === 'BUY' ? buyTP1 : sellTP1
    const tp2 = direction === 'BUY' ? buyTP2 : sellTP2
    const tp3 = direction === 'BUY' ? buyTP3 : sellTP3

    // ── Step 1: Build instant local result (always works, zero latency) ──
    const fallbackArgs = { cleanSymbol, interval, htfInterval, price, direction, mlScore, pullbackScore, htfTrend, ltf, htf, sl, tp1, tp2, tp3, dp, smc }
    const result = buildFallback(fallbackArgs)

    // ── Step 2: Ask a fast 8b model to polish ONLY the 4 text fields ──────
    // Total budget: 7s. If it takes longer, we already have a complete result.
    const textPolishPrompt = `You are a trading analyst. Rewrite these 4 fields using ONLY the data below. Keep each under 120 chars. Reply ONLY with JSON, no markdown.

DATA:
Symbol: ${cleanSymbol} | Direction: ${direction} | HTF: ${htfTrend} on ${htfInterval}
Price: ${price} | SL: ${sl} | TP1: ${tp1} | TP2: ${tp2} | TP3: ${tp3}
Pattern: ${ltf.pattern} | RSI: ${ltf.rsi?.toFixed(1)} | ATR: ${atr?.toFixed(dp)}
SMA8: ${ltf.sma8?.toFixed(dp)} | SMA20: ${ltf.sma20?.toFixed(dp)} | SMA50: ${ltf.sma50?.toFixed(dp)}
OB: ${smc.bullishOB ? 'Bullish at '+smc.bullishOBLevel?.toFixed(dp) : smc.bearishOB ? 'Bearish at '+smc.bearishOBLevel?.toFixed(dp) : 'None'}
FVG: ${smc.fvg} | BOS: ${smc.bos} | CHoCH: ${smc.choch}
Zone: ${smc.premium ? 'Premium' : smc.discount ? 'Discount' : 'Equilibrium'}
Support: ${ltf.sr.supports.map(s=>s.toFixed(dp)).join(', ')||'none'}
Resistance: ${ltf.sr.resistances.map(r=>r.toFixed(dp)).join(', ')||'none'}
ML Score: ${mlScore}/100 | Pullback Score: ${pullbackScore}

{"priceAction":"1-2 sentences on candle pattern and SMC context","supportResistance":"1-2 sentences on key S/R and OB levels","marketSentiment":"1-2 sentences on HTF bias and SMC zone","summary":"2-3 sentences overall trade recommendation"}`

    try {
      const aiRes = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://navigator-ai-three.vercel.app',
          'X-Title': 'Navigator AI'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct:free',
          max_tokens: 400,
          messages: [{ role: 'user', content: textPolishPrompt }]
        })
      }, 9000)

      // Helper to apply polished text fields to result
      function applyPolish(text) {
        text = text.replace(/```json/gi, '').replace(/```/g, '').trim()
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) return false
        try {
          const polished = JSON.parse(jsonMatch[0])
          if (polished.priceAction)       result.priceAction       = polished.priceAction
          if (polished.supportResistance) result.supportResistance = polished.supportResistance
          if (polished.marketSentiment)   result.marketSentiment   = polished.marketSentiment
          if (polished.summary)           result.summary           = polished.summary
          return true
        } catch (e) { return false }
      }

      if (aiRes.ok) {
        const aiData = await aiRes.json()
        applyPolish(aiData.choices?.[0]?.message?.content || '')
      } else {
        // Primary model rate-limited — try fallback free models in order
        const fallbackModels = [
          'mistralai/mistral-7b-instruct:free',
          'google/gemma-3-4b-it:free',
        ]
        for (const model of fallbackModels) {
          try {
            const fbRes = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://navigator-ai-three.vercel.app',
                'X-Title': 'Navigator AI'
              },
              body: JSON.stringify({ model, max_tokens: 400, messages: [{ role: 'user', content: textPolishPrompt }] })
            }, 8000)
            if (fbRes.ok) {
              const fbData = await fbRes.json()
              const applied = applyPolish(fbData.choices?.[0]?.message?.content || '')
              if (applied) break // success — stop trying more models
            }
          } catch (e) { /* this fallback timed out — try next */ }
        }
        // If all models failed — fallback text is already set, just continue
      }
    } catch (aiErr) {
      // Timeout or network error — silently keep fallback text, still return 200
      if (aiErr.name !== 'AbortError') console.warn('AI polish error:', aiErr.message)
    }

    return res.status(200).json({ result })

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

async function fetchCandles(symbol, interval) {
  const variants = [symbol, symbol.replace('/', ''), symbol.replace('/', '') + 'T']
  for (const sym of [...new Set(variants)]) {
    try {
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=${interval}&outputsize=100&apikey=${process.env.TWELVEDATA_API_KEY}&format=JSON`
      const res  = await fetchWithTimeout(url, {}, 8000)
      const data = await res.json()
      if (data.status !== 'error' && data.values?.length > 10) {
        return { candles: data.values.reverse().map(c => ({
          time: c.datetime, open: parseFloat(c.open), high: parseFloat(c.high),
          low: parseFloat(c.low), close: parseFloat(c.close), volume: parseFloat(c.volume || 0)
        })) }
      }
    } catch (e) {}
  }
  return { error: `Could not fetch data for "${symbol}". Try: EURUSD, BTC/USD, XAU/USD, SPY` }
}

function calcIndicators(candles) {
  if (!candles || candles.length < 55) return null
  const closes = candles.map(c => c.close)
  const highs  = candles.map(c => c.high)
  const lows   = candles.map(c => c.low)
  const n      = closes.length

  function calcSMA(data, period) {
    if (data.length < period) return null
    const result = new Array(period - 1).fill(null)
    for (let i = period - 1; i < data.length; i++)
      result.push(data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period)
    return result
  }

  function calcRSI(data, period = 14) {
    if (data.length < period + 1) return null
    const result = new Array(period).fill(null)
    let gains = 0, losses = 0
    for (let i = 1; i <= period; i++) {
      const diff = data[i] - data[i - 1]
      if (diff > 0) gains += diff; else losses += Math.abs(diff)
    }
    let ag = gains / period, al = losses / period
    result.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al))
    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i] - data[i - 1]
      ag = (ag * (period - 1) + (diff > 0 ? diff : 0)) / period
      al = (al * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period
      result.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al))
    }
    return result
  }

  function calcATR(highs, lows, closes, period = 14) {
    const trs = [highs[0] - lows[0]]
    for (let i = 1; i < highs.length; i++)
      trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])))
    let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
    for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period
    return atr
  }

  function calcSR(highs, lows) {
    const supports = [], resistances = [], strength = 5
    const price = closes[closes.length - 1]
    for (let i = strength; i < highs.length - strength; i++) {
      let isHigh = true, isLow = true
      for (let j = i - strength; j <= i + strength; j++) {
        if (j === i) continue
        if (highs[j] >= highs[i]) isHigh = false
        if (lows[j]  <= lows[i])  isLow  = false
      }
      if (isHigh) resistances.push(highs[i])
      if (isLow)  supports.push(lows[i])
    }
    return { supports: supports.filter(s => s < price).slice(-3), resistances: resistances.filter(r => r > price).slice(0, 3) }
  }

  function detectPattern(candles) {
    const last = candles[candles.length - 1]
    const prev = candles[candles.length - 2]
    const prev2 = candles[candles.length - 3]
    if (!last || !prev) return 'None detected'
    const body  = Math.abs(last.close - last.open)
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

  const sma8Arr  = calcSMA(closes, 8)
  const sma20Arr = calcSMA(closes, 20)
  const sma50Arr = calcSMA(closes, 50)
  const rsiArr   = calcRSI(closes, 14)

  return {
    latestClose: closes[n - 1],
    sma8:    sma8Arr?.[n - 1]  ?? null,
    sma20:   sma20Arr?.[n - 1] ?? null,
    sma50:   sma50Arr?.[n - 1] ?? null,
    rsi:     rsiArr?.[n - 1]   ?? 50,
    atr:     calcATR(highs, lows, closes, 14),
    sr:      calcSR(highs, lows),
    pattern: detectPattern(candles)
  }
}

function calcSMC(candles) {
  if (!candles || candles.length < 20) return { bullishOB: false, bearishOB: false, fvg: 'NONE', bos: 'NONE', choch: 'NONE', premium: false, discount: false }

  const n = candles.length
  const price = candles[n - 1].close

  let bullishOB = false, bullishOBLevel = null
  let bearishOB = false, bearishOBLevel = null

  for (let i = n - 10; i < n - 2; i++) {
    const c = candles[i]
    const next = candles[i + 1]
    const next2 = candles[i + 2]
    if (c.close < c.open && next.close > next.open && next2.close > next2.open) {
      const impulseSize = next2.close - c.low
      const avgRange = candles.slice(Math.max(0, i - 10), i).reduce((s, cc) => s + (cc.high - cc.low), 0) / 10
      if (impulseSize > avgRange * 1.5) { bullishOB = true; bullishOBLevel = c.low }
    }
    if (c.close > c.open && next.close < next.open && next2.close < next2.open) {
      const impulseSize = c.high - next2.close
      const avgRange = candles.slice(Math.max(0, i - 10), i).reduce((s, cc) => s + (cc.high - cc.low), 0) / 10
      if (impulseSize > avgRange * 1.5) { bearishOB = true; bearishOBLevel = c.high }
    }
  }

  let fvg = 'NONE', fvgHigh = null, fvgLow = null
  for (let i = n - 8; i < n - 2; i++) {
    const c1 = candles[i]
    const c3 = candles[i + 2]
    if (c3.low > c1.high) { fvg = 'BULLISH'; fvgHigh = c3.low; fvgLow = c1.high; break }
    if (c3.high < c1.low) { fvg = 'BEARISH'; fvgHigh = c1.low; fvgLow = c3.high; break }
  }

  let bos = 'NONE'
  const recentHigh = Math.max(...candles.slice(n - 15, n - 1).map(c => c.high))
  const recentLow  = Math.min(...candles.slice(n - 15, n - 1).map(c => c.low))
  if (candles[n - 1].close > recentHigh) bos = 'BULLISH'
  if (candles[n - 1].close < recentLow)  bos = 'BEARISH'

  let choch = 'NONE'
  const prevTrend = candles[n - 10].close < candles[n - 5].close ? 'UP' : 'DOWN'
  if (prevTrend === 'UP' && bos === 'BEARISH') choch = 'BEARISH CHoCH'
  if (prevTrend === 'DOWN' && bos === 'BULLISH') choch = 'BULLISH CHoCH'

  const rangeHigh = Math.max(...candles.slice(n - 20).map(c => c.high))
  const rangeLow  = Math.min(...candles.slice(n - 20).map(c => c.low))
  const equilibrium = (rangeHigh + rangeLow) / 2
  const premium = price > equilibrium
  const discount = price < equilibrium

  return { bullishOB, bullishOBLevel, bearishOB, bearishOBLevel, fvg, fvgHigh, fvgLow, bos, choch, premium, discount }
}

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
    smcBOS: smc?.bos ? `${smc.bos} BOS` : 'None',
    smcCHoCH: smc?.choch || 'None',
    smcZone: smc?.premium ? 'Premium - sell zone' : smc?.discount ? 'Discount - buy zone' : 'Equilibrium',
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
