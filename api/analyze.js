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
    // ── Step 1: Fetch real candle data from Twelve Data ──────────────
    const tdUrl = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&outputsize=100&apikey=${process.env.TWELVEDATA_API_KEY}`
    const tdRes = await fetch(tdUrl)
    const tdData = await tdRes.json()

    if (tdData.status === 'error' || !tdData.values) {
      return res.status(400).json({ error: `Twelve Data error: ${tdData.message || 'Could not fetch data for ' + symbol}` })
    }

    // Parse candles — Twelve Data returns newest first, reverse to oldest first
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

    // ── Step 2: Calculate real indicators ────────────────────────────

    // EMA calculation
    function calcEMA(data, period) {
      const k = 2 / (period + 1)
      let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period
      const result = new Array(period - 1).fill(null)
      result.push(ema)
      for (let i = period; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k)
        result.push(ema)
      }
      return result
    }

    // RSI calculation
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

    // ATR calculation
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

    // Support & Resistance — find swing highs and lows
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
      return {
        supports:     supports.slice(-3),
        resistances:  resistances.slice(-3)
      }
    }

    // Candlestick pattern detection on last 3 candles
    function detectPattern(candles) {
      const last  = candles[candles.length - 1]
      const prev  = candles[candles.length - 2]
      const prev2 = candles[candles.length - 3]
      if (!last || !prev || !prev2) return 'None detected'

      const lastBody  = Math.abs(last.close - last.open)
      const lastRange = last.high - last.low
      const prevBody  = Math.abs(prev.close - prev.open)

      // Bullish Engulfing
      if (prev.close < prev.open && last.close > last.open &&
          last.open < prev.close && last.close > prev.open)
        return 'Bullish Engulfing'

      // Bearish Engulfing
      if (prev.close > prev.open && last.close < last.open &&
          last.open > prev.close && last.close < prev.open)
        return 'Bearish Engulfing'

      // Pin Bar / Hammer (long lower wick)
      const lowerWick = Math.min(last.open, last.close) - last.low
      const upperWick = last.high - Math.max(last.open, last.close)
      if (lowerWick > lastBody * 2 && upperWick < lastBody && last.close > last.open)
        return 'Bullish Pin Bar / Hammer'
      if (upperWick > lastBody * 2 && lowerWick < lastBody && last.close < last.open)
        return 'Bearish Shooting Star'

      // Doji
      if (lastBody < lastRange * 0.1)
        return 'Doji'

      // Marubozu
      if (lastBody > lastRange * 0.9) {
        return last.close > last.open ? 'Bullish Marubozu' : 'Bearish Marubozu'
      }

      // Inside Bar
      if (last.high < prev.high && last.low > prev.low)
        return 'Inside Bar'

      return 'No clear pattern'
    }

    // ── Compute all values ────────────────────────────────────────────
    const ema8  = calcEMA(closes, 8)
    const ema21 = calcEMA(closes, 21)
    const ema50 = calcEMA(closes, 50)
    const rsi   = calcRSI(closes, 14)
    const atr   = calcATR(highs, lows, closes, 14)
    const sr    = calcSR(highs, lows, 5)
    const pattern = detectPattern(candles)

    // Get latest values
    const latestClose  = closes[n - 1]
    const latestEMA8   = ema8[n - 1]
    const latestEMA21  = ema21[n - 1]
    const latestEMA50  = ema50[n - 1]
    const latestRSI    = rsi[n - 1]
    const latestATR    = atr[n - 1]
    const prevEMA8     = ema8[n - 2]
    const prevEMA21    = ema21[n - 2]

    // EMA crossover detection
    const emaCrossover = (() => {
      if (prevEMA8 <= prevEMA21 && latestEMA8 > latestEMA21)
        return 'Bullish EMA 8/21 Golden Cross — just crossed up'
      if (prevEMA8 >= prevEMA21 && latestEMA8 < latestEMA21)
        return 'Bearish EMA 8/21 Death Cross — just crossed down'
      if (latestEMA8 > latestEMA21 && latestEMA21 > latestEMA50)
        return 'Bullish alignment EMA 8 > 21 > 50 — strong uptrend'
      if (latestEMA8 < latestEMA21 && latestEMA21 < latestEMA50)
        return 'Bearish alignment EMA 8 < 21 < 50 — strong downtrend'
      return 'EMAs mixed — no clear crossover signal'
    })()

    // RSI status
    const rsiStatus = (() => {
      if (latestRSI >= 70) return `Overbought at ${latestRSI.toFixed(1)} — potential reversal or continuation`
      if (latestRSI <= 30) return `Oversold at ${latestRSI.toFixed(1)} — potential reversal or continuation`
      if (latestRSI > 50)  return `Bullish momentum at ${latestRSI.toFixed(1)}`
      return `Bearish momentum at ${latestRSI.toFixed(1)}`
    })()

    // SL/TP calculation
    const atrVal   = latestATR
    const buySL    = (latestClose - atrVal * 2).toFixed(5)
    const buyTP1   = (latestClose + atrVal * 1).toFixed(5)
    const buyTP2   = (latestClose + atrVal * 2).toFixed(5)
    const buyTP3   = (latestClose + atrVal * 3).toFixed(5)
    const sellSL   = (latestClose + atrVal * 2).toFixed(5)
    const sellTP1  = (latestClose - atrVal * 1).toFixed(5)
    const sellTP2  = (latestClose - atrVal * 2).toFixed(5)
    const sellTP3  = (latestClose - atrVal * 3).toFixed(5)

    // ── Step 3: Build data summary for AI ────────────────────────────
    const dataSummary = `
REAL MARKET DATA FOR ${symbol} on ${interval} timeframe:

PRICE DATA (latest 5 candles):
${candles.slice(-5).map(c => `  ${c.time} | O:${c.open} H:${c.high} L:${c.low} C:${c.close}`).join('\n')}

CALCULATED INDICATORS (real values, not estimates):
- Current Price: ${latestClose}
- EMA 8:  ${latestEMA8?.toFixed(5)}
- EMA 21: ${latestEMA21?.toFixed(5)}
- EMA 50: ${latestEMA50?.toFixed(5)}
- RSI 14: ${latestRSI?.toFixed(2)}
- ATR 14: ${latestATR?.toFixed(5)}
- EMA Crossover Status: ${emaCrossover}
- RSI Status: ${rsiStatus}
- Candlestick Pattern: ${pattern}
- Support Levels:    ${sr.supports.map(s => s.toFixed(5)).join(', ') || 'None found'}
- Resistance Levels: ${sr.resistances.map(r => r.toFixed(5)).join(', ') || 'None found'}

PRE-CALCULATED SL/TP LEVELS (ATR x1/2/3):
BUY scenario:  Entry ${latestClose} | SL ${buySL} | TP1 ${buyTP1} | TP2 ${buyTP2} | TP3 ${buyTP3}
SELL scenario: Entry ${latestClose} | SL ${sellSL} | TP1 ${sellTP1} | TP2 ${sellTP2} | TP3 ${sellTP3}
`

    // ── Step 4: Send to AI for interpretation ─────────────────────────
    const prompt = `You are NAVIGATOR AI — an expert trading analyst. You have been given REAL calculated market data below. Use ONLY these real numbers to make your analysis. Do NOT estimate or guess any values.

${dataSummary}

Based on the real data above, provide a complete trading analysis and signal.

Rules:
- Use the exact indicator values provided above
- Determine BUY, SELL, or NO SIGNAL based on confluence of EMA alignment, RSI, candlestick pattern, and S/R levels
- Use the pre-calculated SL/TP levels provided
- ML Score 0-100: based on how many indicators agree (each indicator worth ~20 points)
- Be specific and reference the actual numbers

Respond with ONLY a raw JSON object. No markdown. No text before or after. Start with { and end with }.

{
  "pair": "${symbol}",
  "timeframe": "${interval}",
  "currentPrice": "${latestClose}",
  "direction": "BUY or SELL or NO SIGNAL",
  "setupName": "name the exact setup detected using the real data",
  "mlScore": 75,
  "trendDirection": "Strongly Bullish or Bullish or Neutral or Bearish or Strongly Bearish",
  "trendStrength": "STRONG or MODERATE or WEAK",
  "emaCrossover": "use the real EMA crossover status from the data",
  "rsiReading": "use the real RSI value from the data",
  "candlePattern": "use the detected pattern from the data",
  "srLevels": "describe the real support and resistance levels from the data",
  "entryPrice": "${latestClose}",
  "stopLoss": "use the pre-calculated SL matching your direction",
  "takeProfit1": "use the pre-calculated TP1 matching your direction",
  "takeProfit2": "use the pre-calculated TP2 matching your direction",
  "takeProfit3": "use the pre-calculated TP3 matching your direction",
  "riskReward": "1:3",
  "sentiment": "Strongly Bullish or Bullish or Neutral or Bearish or Strongly Bearish",
  "sentimentScore": 65,
  "priceAction": "2-3 sentences using the real candle data and pattern detected",
  "supportResistance": "2-3 sentences using the real S/R levels calculated",
  "technicalIndicators": "2-3 sentences using the exact EMA RSI ATR values provided",
  "marketSentiment": "2-3 sentences on overall confluence and trade confidence",
  "summary": "3-4 sentences with exact entry SL TP1 TP2 TP3 values and ML score reasoning",
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
      const isBull = latestEMA8 > latestEMA21 && latestRSI > 50
      result = {
        pair: symbol,
        timeframe: interval,
        currentPrice: String(latestClose),
        direction: isBull ? 'BUY' : 'SELL',
        setupName: emaCrossover,
        mlScore: Math.round((
          (latestEMA8 > latestEMA21 ? 20 : 0) +
          (latestEMA21 > latestEMA50 ? 20 : 0) +
          (latestRSI > 50 && latestRSI < 70 ? 20 : 0) +
          (pattern !== 'No clear pattern' ? 20 : 0) +
          (sr.supports.length > 0 ? 20 : 0)
        )),
        trendDirection: isBull ? 'Bullish' : 'Bearish',
        trendStrength: 'MODERATE',
        emaCrossover,
        rsiReading: rsiStatus,
        candlePattern: pattern,
        srLevels: `Support: ${sr.supports.map(s=>s.toFixed(5)).join(', ')} | Resistance: ${sr.resistances.map(r=>r.toFixed(5)).join(', ')}`,
        entryPrice: String(latestClose),
        stopLoss: isBull ? buySL : sellSL,
        takeProfit1: isBull ? buyTP1 : sellTP1,
        takeProfit2: isBull ? buyTP2 : sellTP2,
        takeProfit3: isBull ? buyTP3 : sellTP3,
        riskReward: '1:3',
        sentiment: isBull ? 'Bullish' : 'Bearish',
        sentimentScore: isBull ? 65 : 35,
        priceAction: `Price at ${latestClose}. ${pattern} detected on latest candle.`,
        supportResistance: `Support: ${sr.supports.map(s=>s.toFixed(5)).join(', ')}. Resistance: ${sr.resistances.map(r=>r.toFixed(5)).join(', ')}.`,
        technicalIndicators: `EMA8: ${latestEMA8?.toFixed(5)}, EMA21: ${latestEMA21?.toFixed(5)}, RSI: ${latestRSI?.toFixed(2)}, ATR: ${latestATR?.toFixed(5)}.`,
        marketSentiment: `${emaCrossover}. ${rsiStatus}.`,
        summary: `${isBull ? 'BUY' : 'SELL'} signal on ${symbol} ${interval}. Entry: ${latestClose}. SL: ${isBull ? buySL : sellSL}. TP1: ${isBull ? buyTP1 : sellTP1}. TP2: ${isBull ? buyTP2 : sellTP2}. TP3: ${isBull ? buyTP3 : sellTP3}.`,
        tags: [isBull ? 'Bullish' : 'Bearish', pattern, 'Real Data']
      }
    }

    return res.status(200).json({ result })

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
