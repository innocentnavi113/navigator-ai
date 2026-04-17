// api/analyze.js
// Handles two modes:
// 1. Chart image analysis (imageBase64 + imageType provided)
// 2. Live market scanner (symbol + interval provided)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { symbol, interval, imageBase64, imageType, prompt: customPrompt } = req.body

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY is not set' })
  }

  // ── MODE 1: Chart image analysis ─────────────────────────────────────
  if (imageBase64 && imageType) {
    try {
      const prompt = customPrompt || `Analyze this trading chart. You MUST respond with ONLY a JSON object. No text before or after. No markdown. No explanation. Just the raw JSON object starting with { and ending with }.

{
  "pair": "READ the exact instrument name from the chart label or title visible in the image. Do not guess.",
  "timeframe": "detected timeframe e.g. H1",
  "direction": "BUY or SELL",
  "sentiment": "Bullish or Bearish or Neutral or Strongly Bullish or Strongly Bearish",
  "sentimentScore": 50,
  "entryPrice": "price level",
  "stopLoss": "price level",
  "takeProfit1": "price level",
  "takeProfit2": "price level",
  "takeProfit3": "price level",
  "riskReward": "1:2",
  "priceAction": "2-3 sentences on candlestick patterns and trend",
  "supportResistance": "2-3 sentences on key S/R levels",
  "technicalIndicators": "2-3 sentences on visible indicators",
  "marketSentiment": "2-3 sentences on overall market sentiment",
  "summary": "3-4 sentences comprehensive recommendation",
  "tags": ["tag1", "tag2", "tag3"]
}`

      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://navigator-ai-three.vercel.app',
          'X-Title': 'Navigator AI'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-maverick:free',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${imageType};base64,${imageBase64}` } },
              { type: 'text', text: prompt }
            ]
          }]
        })
      })

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
      return res.status(500).json({ error: err.message || 'Chart analysis failed' })
    }
  }

  // ── MODE 2: Live market scanner ────────────────────────────────────────
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

    const [ltfData, htfData] = await Promise.all([
      fetchCandles(cleanSymbol, interval),
      fetchCandles(cleanSymbol, htfInterval)
    ])

    if (ltfData.error) return res.status(400).json({ error: ltfData.error })

    const ltf = calcIndicators(ltfData.candles)
    const htf = calcIndicators(htfData.candles)

    if (!ltf || !htf) return res.status(500).json({ error: 'Not enough candle data' })

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

    let pullbackScore = 0
    if (htfBullish) {
      if (ltfBelowSMA20 || ltfNearSMA20) pullbackScore += 30
      if (rsiBuyZone || rsiExtremeBuy)   pullbackScore += 25
      if (ltf.sma8 > ltf.sma20)         pullbackScore += 15
      if (ltf.pattern.includes('Bull') || ltf.pattern.includes('Pin')) pullbackScore += 20
      if (ltf.sr.supports.length > 0)   pullbackScore += 10
    }
    if (htfBearish) {
      if (ltfAboveSMA20 || ltfNearSMA20) pullbackScore += 30
      if (rsiSellZone || rsiExtremeSell) pullbackScore += 25
      if (ltf.sma8 < ltf.sma20)         pullbackScore += 15
      if (ltf.pattern.includes('Bear') || ltf.pattern.includes('Shooting')) pullbackScore += 20
      if (ltf.sr.resistances.length > 0) pullbackScore += 10
    }

    let mlScore = 0
    if (htfBullish || htfBearish) mlScore += 40
    mlScore += Math.round(pullbackScore * 0.3)
    if ((htfBullish && rsiBuyZone)  || (htfBearish && rsiSellZone))     mlScore += 15
    if ((htfBullish && rsiExtremeBuy) || (htfBearish && rsiExtremeSell)) mlScore += 10
    if (ltf.pattern !== 'No clear pattern') mlScore += 15
    mlScore = Math.min(100, mlScore)

    let direction = 'NO SIGNAL'
    if (htfBullish && pullbackScore >= 40 && mlScore >= 55) direction = 'BUY'
    if (htfBearish && pullbackScore >= 40 && mlScore >= 55) direction = 'SELL'

    const dp    = ltf.latestClose < 10 ? 5 : ltf.latestClose < 1000 ? 4 : 2
    const atr   = ltf.atr
    const price = ltf.latestClose
    const buySL   = (price - atr * 1.5).toFixed(dp)
    const buyTP1  = (price + atr * 2.0).toFixed(dp)
    const buyTP2  = (price + atr * 3.5).toFixed(dp)
    const buyTP3  = (price + atr * 5.0).toFixed(dp)
    const sellSL  = (price + atr * 1.5).toFixed(dp)
    const sellTP1 = (price - atr * 2.0).toFixed(dp)
    const sellTP2 = (price - atr * 3.5).toFixed(dp)
    const sellTP3 = (price - atr * 5.0).toFixed(dp)

    const sl  = direction === 'BUY' ? buySL  : sellSL
    const tp1 = direction === 'BUY' ? buyTP1 : sellTP1
    const tp2 = direction === 'BUY' ? buyTP2 : sellTP2
    const tp3 = direction === 'BUY' ? buyTP3 : sellTP3

    const summary = `
SYMBOL: ${cleanSymbol} | LTF: ${interval} | HTF: ${htfInterval}
HTF: Close=${htf.latestClose} SMA20=${htf.sma20?.toFixed(dp)} SMA50=${htf.sma50?.toFixed(dp)} TREND=${htfTrend}
LTF: Close=${price} SMA8=${ltf.sma8?.toFixed(dp)} SMA20=${ltf.sma20?.toFixed(dp)} SMA50=${ltf.sma50?.toFixed(dp)} RSI=${ltf.rsi?.toFixed(1)} ATR=${atr?.toFixed(dp)}
PATTERN: ${ltf.pattern}
SUPPORT: ${ltf.sr.supports.map(s=>s.toFixed(dp)).join(',')||'none'}
RESISTANCE: ${ltf.sr.resistances.map(r=>r.toFixed(dp)).join(',')||'none'}
SIGNAL: ${direction} | ML=${mlScore} | PULLBACK=${pullbackScore}
${direction==='BUY' ?`BUY:  Entry=${price} SL=${sl} TP1=${tp1} TP2=${tp2} TP3=${tp3}`:''}
${direction==='SELL'?`SELL: Entry=${price} SL=${sl} TP1=${tp1} TP2=${tp2} TP3=${tp3}`:''}
`

    const aiPrompt = `You are NAVIGATOR AI trading analyst. Use ONLY this real data:
${summary}

Reply with ONLY this JSON. Keep ALL string values SHORT (max 80 chars). No markdown.

{"pair":"${cleanSymbol}","timeframe":"${interval}","htfTimeframe":"${htfInterval}","currentPrice":"${price}","direction":"${direction}","setupName":"brief setup name","mlScore":${mlScore},"pullbackScore":${pullbackScore},"htfTrend":"${htfTrend}","htfAnalysis":"1 short sentence on HTF trend","trendDirection":"${htfBullish?'Bullish':htfBearish?'Bearish':'Neutral'}","trendStrength":"${mlScore>=70?'STRONG':mlScore>=50?'MODERATE':'WEAK'}","meanReversionZone":"brief description","rsiReading":"RSI ${ltf.rsi?.toFixed(1)} status","candlePattern":"${ltf.pattern}","entryPrice":"${price}","stopLoss":"${sl}","takeProfit1":"${tp1}","takeProfit2":"${tp2}","takeProfit3":"${tp3}","riskReward":"1:3.3","sentiment":"${htfBullish?'Bullish':htfBearish?'Bearish':'Neutral'}","sentimentScore":${mlScore},"priceAction":"1-2 sentences on candle and pullback","supportResistance":"1-2 sentences on S/R levels","technicalIndicators":"1-2 sentences on SMA RSI ATR","marketSentiment":"1-2 sentences on MTF confluence","summary":"2-3 sentences on trade setup","tags":["${htfTrend}","${ltf.pattern.split(' ')[0]}","${direction==='NO SIGNAL'?'Waiting':direction}"]}`

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://navigator-ai-three.vercel.app',
        'X-Title': 'Navigator AI'
      },
      body: JSON.stringify({
        model: 'openrouter/auto',
        max_tokens: 1000,
        messages: [{ role: 'user', content: aiPrompt }]
      })
    })

    const aiData = await aiRes.json()
    if (!aiRes.ok) return res.status(aiRes.status).json({ error: aiData.error?.message || 'AI error' })

    let text = aiData.choices?.[0]?.message?.content || ''
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return res.status(500).json({ error: `AI returned unexpected content: "${text.slice(0, 200)}"` })

    let jsonStr = jsonMatch[0]
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')
    jsonStr = jsonStr.replace(/:\s*"([^"]*)"(?=\s*[,}])/g, (match, val) => `: "${val.replace(/"/g, "'")}"`)

    let result
    try { result = JSON.parse(jsonStr) }
    catch (e) {
      result = buildFallback({ cleanSymbol, interval, htfInterval, price, direction, mlScore, pullbackScore, htfTrend, ltf, htf, sl, tp1, tp2, tp3, dp })
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
      const res  = await fetch(url)
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

function buildFallback({ cleanSymbol, interval, htfInterval, price, direction, mlScore, pullbackScore, htfTrend, ltf, htf, sl, tp1, tp2, tp3, dp }) {
  return {
    pair: cleanSymbol, timeframe: interval, htfTimeframe: htfInterval,
    currentPrice: String(price), direction,
    setupName: `HTF ${htfTrend} + LTF Mean Reversion`,
    mlScore, pullbackScore, htfTrend,
    htfAnalysis: `${htfInterval} trend is ${htfTrend}. SMA20=${htf.sma20?.toFixed(dp)} SMA50=${htf.sma50?.toFixed(dp)}.`,
    trendDirection: htfTrend === 'BULLISH' ? 'Bullish' : htfTrend === 'BEARISH' ? 'Bearish' : 'Neutral',
    trendStrength: mlScore >= 70 ? 'STRONG' : mlScore >= 50 ? 'MODERATE' : 'WEAK',
    meanReversionZone: `SMA 20 at ${ltf.sma20?.toFixed(dp)}`,
    rsiReading: `RSI ${ltf.rsi?.toFixed(1)}`,
    candlePattern: ltf.pattern,
    entryPrice: String(price), stopLoss: sl,
    takeProfit1: tp1, takeProfit2: tp2, takeProfit3: tp3,
    riskReward: '1:3.3',
    sentiment: htfTrend === 'BULLISH' ? 'Bullish' : htfTrend === 'BEARISH' ? 'Bearish' : 'Neutral',
    sentimentScore: mlScore,
    priceAction: `${ltf.pattern} at ${price}. Near SMA20 ${ltf.sma20?.toFixed(dp)}.`,
    supportResistance: `Support: ${ltf.sr.supports.map(s=>s.toFixed(dp)).join(', ')||'none'}. Resistance: ${ltf.sr.resistances.map(r=>r.toFixed(dp)).join(', ')||'none'}.`,
    technicalIndicators: `SMA8=${ltf.sma8?.toFixed(dp)} SMA20=${ltf.sma20?.toFixed(dp)} SMA50=${ltf.sma50?.toFixed(dp)} RSI=${ltf.rsi?.toFixed(1)} ATR=${ltf.atr?.toFixed(dp)}`,
    marketSentiment: `HTF ${htfInterval} is ${htfTrend}. ML Score ${mlScore}/100.`,
    summary: `${direction} on ${cleanSymbol}. Entry=${price} SL=${sl} TP1=${tp1} TP2=${tp2} TP3=${tp3}. ML=${mlScore}/100.`,
    tags: [htfTrend, ltf.pattern.split(' ')[0], direction === 'NO SIGNAL' ? 'Waiting' : direction]
  }
}
