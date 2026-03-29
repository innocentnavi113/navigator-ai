export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { symbol, interval } = req.body

  if (!symbol || !interval) {
    return res.status(400).json({ error: 'Missing symbol or interval' })
  }

  if (!process.env.TWELVEDATA_API_KEY) {
    return res.status(500).json({ error: 'TWELVEDATA_API_KEY is not set' })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY is not set' })
  }

  try {
    const cleanSymbol = symbol.trim().toUpperCase()

    // Fetch candles from Twelve Data
    const tdUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(cleanSymbol)}&interval=${interval}&outputsize=100&apikey=${process.env.TWELVEDATA_API_KEY}&format=JSON`
    const tdRes = await fetch(tdUrl)
    const tdData = await tdRes.json()

    if (tdData.status === 'error' || !tdData.values || !Array.isArray(tdData.values)) {
      // Fallback: try without slash e.g. EURUSD
      const fallback = cleanSymbol.replace('/', '')
      const fbUrl = `https://api.twelvedata.com/time_series?symbol=${fallback}&interval=${interval}&outputsize=100&apikey=${process.env.TWELVEDATA_API_KEY}&format=JSON`
      const fbRes = await fetch(fbUrl)
      const fbData = await fbRes.json()
      if (fbData.status === 'error' || !fbData.values) {
        return res.status(400).json({
          error: `Could not fetch data for "${cleanSymbol}". Try: EURUSD, BTC/USD, XAU/USD, SPY, AAPL`
        })
      }
      return await processAndRespond(fbData, cleanSymbol, interval, res)
    }

    return await processAndRespond(tdData, cleanSymbol, interval, res)

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

async function processAndRespond(tdData, symbol, interval, res) {

  // Parse candles oldest first
  const candles = tdData.values.reverse().map(c => ({
    time:   c.datetime,
    open:   parseFloat(c.open),
    high:   parseFloat(c.high),
    low:    parseFloat(c.low),
    close:  parseFloat(c.close),
    volume: parseFloat(c.volume || 0)
  }))

  const closes = candles.map(c => c.close)
  const highs  = candles.map(c => c.high)
  const lows   = candles.map(c => c.low)
  const n      = closes.length

  // ── SMA (Simple Moving Average) ─────────────────────────────────────
  function calcSMA(data, period) {
    const result = new Array(period - 1).fill(null)
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      result.push(sum / period)
    }
    return result
  }

  // ── RSI ──────────────────────────────────────────────────────────────
  function calcRSI(data, period = 14) {
    const result = new Array(period).fill(null)
    let gains = 0, losses = 0
    for (let i = 1; i <= period; i++) {
      const diff = data[i] - data[i - 1]
      if (diff > 0) gains += diff
      else losses += Math.abs(diff)
    }
    let avgGain = gains / period
    let avgLoss = losses / period
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i] - data[i - 1]
      avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period
      avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period
      result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
    }
    return result
  }

  // ── ATR ──────────────────────────────────────────────────────────────
  function calcATR(highs, lows, closes, period = 14) {
    const trs = [highs[0] - lows[0]]
    for (let i = 1; i < highs.length; i++) {
      trs.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      ))
    }
    let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
    const result = new Array(period - 1).fill(null)
    result.push(atr)
    for (let i = period; i < trs.length; i++) {
      atr = (atr * (period - 1) + trs[i]) / period
      result.push(atr)
    }
    return result
  }

  // ── Support & Resistance ─────────────────────────────────────────────
  function calcSR(highs, lows, strength = 5) {
    const supports = [], resistances = []
    for (let i = strength; i < highs.length - strength; i++) {
      let isHigh = true, isLow = true
      for (let j = i - strength; j <= i + strength; j++) {
        if (j === i) continue
        if (highs[j] >= highs[i]) isHigh = false
        if (lows[j] <= lows[i]) isLow = false
      }
      if (isHigh) resistances.push(highs[i])
      if (isLow) supports.push(lows[i])
    }
    return { supports: supports.slice(-3), resistances: resistances.slice(-3) }
  }

  // ── Candlestick Pattern Detection ────────────────────────────────────
  function detectPattern(candles) {
    const last  = candles[candles.length - 1]
    const prev  = candles[candles.length - 2]
    if (!last || !prev) return 'None detected'
    const lastBody  = Math.abs(last.close - last.open)
    const lastRange = last.high - last.low
    const lowerWick = Math.min(last.open, last.close) - last.low
    const upperWick = last.high - Math.max(last.open, last.close)
    if (prev.close < prev.open && last.close > last.open &&
        last.open < prev.close && last.close > prev.open) return 'Bullish Engulfing'
    if (prev.close > prev.open && last.close < last.open &&
        last.open > prev.close && last.close < prev.open) return 'Bearish Engulfing'
    if (lowerWick > lastBody * 2 && upperWick < lastBody && last.close > last.open) return 'Bullish Pin Bar'
    if (upperWick > lastBody * 2 && lowerWick < lastBody && last.close < last.open) return 'Bearish Shooting Star'
    if (lastBody < lastRange * 0.1) return 'Doji'
    if (lastBody > lastRange * 0.9) return last.close > last.open ? 'Bullish Marubozu' : 'Bearish Marubozu'
    if (last.high < prev.high && last.low > prev.low) return 'Inside Bar'
    return 'No clear pattern'
  }

  // ── Compute All Values ────────────────────────────────────────────────
  const sma8   = calcSMA(closes, 8)
  const sma21  = calcSMA(closes, 21)
  const sma50  = calcSMA(closes, 50)
  const rsi    = calcRSI(closes, 14)
  const atr    = calcATR(highs, lows, closes, 14)
  const sr     = calcSR(highs, lows, 5)
  const pattern = detectPattern(candles)

  const latestClose = closes[n - 1]
  const latestSMA8  = sma8[n - 1]
  const latestSMA21 = sma21[n - 1]
  const latestSMA50 = sma50[n - 1]
  const latestRSI   = rsi[n - 1]
  const latestATR   = atr[n - 1]
  const prevSMA8    = sma8[n - 2]
  const prevSMA21   = sma21[n - 2]

  // Decimal places based on price magnitude
  const dp = latestClose < 10 ? 5 : latestClose < 1000 ? 4 : 2

  // ── SMA Crossover Status ──────────────────────────────────────────────
  const smaCrossover = (() => {
    if (prevSMA8 !== null && prevSMA21 !== null) {
      if (prevSMA8 <= prevSMA21 && latestSMA8 > latestSMA21)
        return 'Bullish SMA 8/21 Golden Cross — just crossed up'
      if (prevSMA8 >= prevSMA21 && latestSMA8 < latestSMA21)
        return 'Bearish SMA 8/21 Death Cross — just crossed down'
    }
    if (latestSMA8 > latestSMA21 && latestSMA21 > latestSMA50)
      return 'Bullish alignment SMA 8 > 21 > 50 — strong uptrend'
    if (latestSMA8 < latestSMA21 && latestSMA21 < latestSMA50)
      return 'Bearish alignment SMA 8 < 21 < 50 — strong downtrend'
    if (latestSMA8 > latestSMA21 && latestClose > latestSMA50)
      return 'Mild bullish — SMA 8 above 21, price above SMA 50'
    if (latestSMA8 < latestSMA21 && latestClose < latestSMA50)
      return 'Mild bearish — SMA 8 below 21, price below SMA 50'
    return 'SMAs mixed — no clear crossover signal'
  })()

  // ── Trend Filter (SMA 50) ─────────────────────────────────────────────
  const trendFilter = latestClose > latestSMA50
    ? 'BULLISH — price above SMA 50, only BUY signals valid'
    : 'BEARISH — price below SMA 50, only SELL signals valid'

  // ── RSI Status ────────────────────────────────────────────────────────
  const rsiStatus = (() => {
    if (latestRSI >= 70) return `Overbought at ${latestRSI.toFixed(1)} — avoid new BUY entries`
    if (latestRSI <= 30) return `Oversold at ${latestRSI.toFixed(1)} — avoid new SELL entries`
    if (latestRSI > 55)  return `Bullish momentum at ${latestRSI.toFixed(1)}`
    if (latestRSI < 45)  return `Bearish momentum at ${latestRSI.toFixed(1)}`
    return `Neutral RSI at ${latestRSI.toFixed(1)}`
  })()

  // ── SL/TP Levels (ATR-based) ──────────────────────────────────────────
  const atrVal  = latestATR
  const buySL   = (latestClose - atrVal * 2).toFixed(dp)
  const buyTP1  = (latestClose + atrVal * 1).toFixed(dp)
  const buyTP2  = (latestClose + atrVal * 2).toFixed(dp)
  const buyTP3  = (latestClose + atrVal * 3).toFixed(dp)
  const sellSL  = (latestClose + atrVal * 2).toFixed(dp)
  const sellTP1 = (latestClose - atrVal * 1).toFixed(dp)
  const sellTP2 = (latestClose - atrVal * 2).toFixed(dp)
  const sellTP3 = (latestClose - atrVal * 3).toFixed(dp)

  // ── ML Score (confluence-based) ───────────────────────────────────────
  const isBullishTrend = latestClose > latestSMA50
  let mlScore = 0
  if (latestSMA8 > latestSMA21) mlScore += isBullishTrend ? 25 : 5
  else mlScore += isBullishTrend ? 5 : 25
  if (latestSMA21 > latestSMA50 && isBullishTrend) mlScore += 20
  else if (latestSMA21 < latestSMA50 && !isBullishTrend) mlScore += 20
  if (isBullishTrend && latestRSI > 50 && latestRSI < 70) mlScore += 20
  else if (!isBullishTrend && latestRSI < 50 && latestRSI > 30) mlScore += 20
  if (pattern !== 'No clear pattern' && pattern !== 'None detected') mlScore += 15
  if (sr.supports.length > 0 || sr.resistances.length > 0) mlScore += 20

  // ── Build data summary for AI ─────────────────────────────────────────
  const dataSummary = `
REAL MARKET DATA FOR ${symbol} on ${interval} timeframe:

LATEST 5 CANDLES:
${candles.slice(-5).map(c => `  ${c.time} | O:${c.open} H:${c.high} L:${c.low} C:${c.close}`).join('\n')}

REAL CALCULATED INDICATORS (SMA-based strategy):
- Current Price: ${latestClose}
- SMA 8:   ${latestSMA8?.toFixed(dp)}
- SMA 21:  ${latestSMA21?.toFixed(dp)}
- SMA 50:  ${latestSMA50?.toFixed(dp)}
- RSI 14:  ${latestRSI?.toFixed(2)}
- ATR 14:  ${latestATR?.toFixed(dp)}
- SMA Crossover: ${smaCrossover}
- Trend Filter:  ${trendFilter}
- RSI Status:    ${rsiStatus}
- Candle Pattern: ${pattern}
- Support Levels:    ${sr.supports.map(s => s.toFixed(dp)).join(', ') || 'None found'}
- Resistance Levels: ${sr.resistances.map(r => r.toFixed(dp)).join(', ') || 'None found'}
- ML Confluence Score: ${mlScore}/100

STRATEGY RULES:
- BUY only when: price > SMA 50 AND SMA 8 > SMA 21 AND RSI between 50-70
- SELL only when: price < SMA 50 AND SMA 8 < SMA 21 AND RSI between 30-50
- NO SIGNAL if RSI is overbought above 70 for BUY or oversold below 30 for SELL

PRE-CALCULATED SL/TP (ATR x1, x2, x3):
BUY:  Entry ${latestClose} | SL ${buySL} | TP1 ${buyTP1} | TP2 ${buyTP2} | TP3 ${buyTP3}
SELL: Entry ${latestClose} | SL ${sellSL} | TP1 ${sellTP1} | TP2 ${sellTP2} | TP3 ${sellTP3}
`

  const prompt = `You are NAVIGATOR AI — a professional trading analyst. Use ONLY the real calculated data below. Do NOT estimate any values.

${dataSummary}

Based on the real SMA crossover strategy data above, determine BUY, SELL, or NO SIGNAL. Apply the strategy rules strictly. Use the exact pre-calculated SL/TP values.

Respond with ONLY a raw JSON object. No markdown. No text before or after. Start with { and end with }.

{
  "pair": "${symbol}",
  "timeframe": "${interval}",
  "currentPrice": "${latestClose}",
  "direction": "BUY or SELL or NO SIGNAL",
  "setupName": "describe the exact SMA setup detected e.g. SMA 8/21 Golden Cross above SMA 50 with Bullish Engulfing",
  "mlScore": ${mlScore},
  "trendDirection": "Strongly Bullish or Bullish or Neutral or Bearish or Strongly Bearish",
  "trendStrength": "STRONG or MODERATE or WEAK",
  "smaCrossover": "${smaCrossover}",
  "trendFilter": "${trendFilter}",
  "rsiReading": "${rsiStatus}",
  "candlePattern": "${pattern}",
  "srLevels": "describe the real support and resistance levels",
  "entryPrice": "${latestClose}",
  "stopLoss": "use the pre-calculated SL for your direction",
  "takeProfit1": "use the pre-calculated TP1 for your direction",
  "takeProfit2": "use the pre-calculated TP2 for your direction",
  "takeProfit3": "use the pre-calculated TP3 for your direction",
  "riskReward": "1:3",
  "sentiment": "Strongly Bullish or Bullish or Neutral or Bearish or Strongly Bearish",
  "sentimentScore": 65,
  "priceAction": "2-3 sentences using the real candle data and pattern detected",
  "supportResistance": "2-3 sentences using the real S/R levels",
  "technicalIndicators": "2-3 sentences using the exact SMA RSI ATR values — mention all three SMA levels",
  "marketSentiment": "2-3 sentences on SMA confluence RSI filter and overall trade confidence",
  "summary": "3-4 sentences with exact entry SL TP1 TP2 TP3 and why the signal is valid or invalid based on the strategy rules",
  "tags": ["tag1", "tag2", "tag3"]
}`

  // ── Call AI ───────────────────────────────────────────────────────────
  const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://navigator-ai-three.vercel.app',
      'X-Title': 'Navigator AI'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const aiData = await aiRes.json()
  if (!aiRes.ok) {
    return res.status(aiRes.status).json({ error: aiData.error?.message || 'AI error' })
  }

  let text = aiData.choices?.[0]?.message?.content || ''
  text = text.replace(/```json/gi, '').replace(/```/g, '').trim()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return res.status(500).json({ error: `AI returned unexpected content: "${text.slice(0, 200)}"` })
  }

  let jsonStr = jsonMatch[0]
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')
  jsonStr = jsonStr.replace(/:\s*"([^"]*)"(?=\s*[,}])/g, (match, val) => {
    return `: "${val.replace(/"/g, "'")}"`
  })

  let result
  try {
    result = JSON.parse(jsonStr)
  } catch (e) {
    // Fallback: build result from real data directly
    const isBull = latestSMA8 > latestSMA21 && latestClose > latestSMA50 && latestRSI > 50 && latestRSI < 70
    const isSell = latestSMA8 < latestSMA21 && latestClose < latestSMA50 && latestRSI < 50 && latestRSI > 30
    const direction = isBull ? 'BUY' : isSell ? 'SELL' : 'NO SIGNAL'
    result = {
      pair: symbol,
      timeframe: interval,
      currentPrice: String(latestClose),
      direction,
      setupName: smaCrossover,
      mlScore,
      trendDirection: isBull ? 'Bullish' : isSell ? 'Bearish' : 'Neutral',
      trendStrength: mlScore >= 70 ? 'STRONG' : mlScore >= 50 ? 'MODERATE' : 'WEAK',
      smaCrossover,
      trendFilter,
      rsiReading: rsiStatus,
      candlePattern: pattern,
      srLevels: `Support: ${sr.supports.map(s=>s.toFixed(dp)).join(', ')} | Resistance: ${sr.resistances.map(r=>r.toFixed(dp)).join(', ')}`,
      entryPrice: String(latestClose),
      stopLoss:    direction === 'BUY' ? buySL : sellSL,
      takeProfit1: direction === 'BUY' ? buyTP1 : sellTP1,
      takeProfit2: direction === 'BUY' ? buyTP2 : sellTP2,
      takeProfit3: direction === 'BUY' ? buyTP3 : sellTP3,
      riskReward: '1:3',
      sentiment: isBull ? 'Bullish' : isSell ? 'Bearish' : 'Neutral',
      sentimentScore: isBull ? 65 : isSell ? 35 : 50,
      priceAction: `Price at ${latestClose}. ${pattern} on latest candle. ${trendFilter}.`,
      supportResistance: `Support: ${sr.supports.map(s=>s.toFixed(dp)).join(', ')}. Resistance: ${sr.resistances.map(r=>r.toFixed(dp)).join(', ')}.`,
      technicalIndicators: `SMA8: ${latestSMA8?.toFixed(dp)}, SMA21: ${latestSMA21?.toFixed(dp)}, SMA50: ${latestSMA50?.toFixed(dp)}, RSI: ${latestRSI?.toFixed(2)}, ATR: ${latestATR?.toFixed(dp)}.`,
      marketSentiment: `${smaCrossover}. ${rsiStatus}. ML Score: ${mlScore}/100.`,
      summary: `${direction} signal on ${symbol} ${interval}. Entry: ${latestClose}. SL: ${direction === 'BUY' ? buySL : sellSL}. TP1: ${direction === 'BUY' ? buyTP1 : sellTP1}. TP2: ${direction === 'BUY' ? buyTP2 : sellTP2}. TP3: ${direction === 'BUY' ? buyTP3 : sellTP3}.`,
      tags: [direction === 'BUY' ? 'Bullish' : direction === 'SELL' ? 'Bearish' : 'No Signal', pattern, 'SMA Strategy']
    }
  }

  return res.status(200).json({ result })
}
