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

  // ── Map entry timeframe to higher timeframe ───────────────────────
  const htfMap = {
    '1min':  '15min',
    '5min':  '1h',
    '15min': '4h',
    '30min': '4h',
    '1h':    '1day',
    '2h':    '1day',
    '4h':    '1week',
    '1day':  '1month'
  }
  const htfInterval = htfMap[interval] || '1day'

  try {
    const cleanSymbol = symbol.trim().toUpperCase()

    // ── Fetch both timeframes in parallel ────────────────────────────
    const [ltfData, htfData] = await Promise.all([
      fetchCandles(cleanSymbol, interval),
      fetchCandles(cleanSymbol, htfInterval)
    ])

    if (ltfData.error) {
      return res.status(400).json({ error: ltfData.error })
    }

    // ── Calculate indicators on both timeframes ───────────────────────
    const ltf = calcIndicators(ltfData.candles)
    const htf = calcIndicators(htfData.candles)

    if (!ltf || !htf) {
      return res.status(500).json({ error: 'Not enough data to calculate indicators' })
    }

    // ── STRATEGY LOGIC ────────────────────────────────────────────────
    // Step 1: Higher Timeframe Trend Direction
    // Trend is BULLISH if price > SMA 50 AND SMA 20 > SMA 50 on HTF
    // Trend is BEARISH if price < SMA 50 AND SMA 20 < SMA 50 on HTF
    const htfBullish = htf.latestClose > htf.sma50 && htf.sma20 > htf.sma50
    const htfBearish = htf.latestClose < htf.sma50 && htf.sma20 < htf.sma50
    const htfTrend   = htfBullish ? 'BULLISH' : htfBearish ? 'BEARISH' : 'NEUTRAL'

    // Step 2: Mean Reversion Entry on LTF
    // BUY setup:  HTF is BULLISH + LTF price pulled back to SMA 20 + RSI oversold (< 40) + bullish candle pattern
    // SELL setup: HTF is BEARISH + LTF price pulled back to SMA 20 + RSI overbought (> 60) + bearish candle pattern

    const ltfNearSMA20 = Math.abs(ltf.latestClose - ltf.sma20) / ltf.latestClose < 0.003 // within 0.3%
    const ltfBelowSMA20 = ltf.latestClose < ltf.sma20 * 1.002  // at or below SMA 20
    const ltfAboveSMA20 = ltf.latestClose > ltf.sma20 * 0.998  // at or above SMA 20

    // RSI conditions for mean reversion
    const rsiBuyZone  = ltf.rsi >= 30 && ltf.rsi <= 50  // oversold bounce zone
    const rsiSellZone = ltf.rsi >= 50 && ltf.rsi <= 70  // overbought pullback zone
    const rsiExtremeBuy  = ltf.rsi < 35  // deeply oversold
    const rsiExtremeSell = ltf.rsi > 65  // deeply overbought

    // Pullback quality score (0-100)
    let pullbackScore = 0
    if (htfBullish) {
      if (ltfBelowSMA20 || ltfNearSMA20) pullbackScore += 30
      if (rsiBuyZone || rsiExtremeBuy)   pullbackScore += 25
      if (ltf.sma8 > ltf.sma20)         pullbackScore += 15  // LTF still aligned
      if (ltf.pattern.includes('Bull') || ltf.pattern.includes('Pin') || ltf.pattern.includes('Hammer')) pullbackScore += 20
      if (ltf.latestClose > ltf.sr.supports[ltf.sr.supports.length - 1]) pullbackScore += 10
    }
    if (htfBearish) {
      if (ltfAboveSMA20 || ltfNearSMA20) pullbackScore += 30
      if (rsiSellZone || rsiExtremeSell) pullbackScore += 25
      if (ltf.sma8 < ltf.sma20)         pullbackScore += 15
      if (ltf.pattern.includes('Bear') || ltf.pattern.includes('Shooting') || ltf.pattern.includes('Engulfing')) pullbackScore += 20
      if (ltf.latestClose < ltf.sr.resistances[0]) pullbackScore += 10
    }

    // Confluence score (all signals combined)
    let mlScore = 0

    // HTF trend (40 points max)
    if (htfBullish || htfBearish) mlScore += 40

    // LTF pullback quality (30 points max)
    mlScore += Math.round(pullbackScore * 0.3)

    // RSI confluence (15 points)
    if ((htfBullish && rsiBuyZone)  || (htfBearish && rsiSellZone))  mlScore += 15
    if ((htfBullish && rsiExtremeBuy) || (htfBearish && rsiExtremeSell)) mlScore += 10

    // Candle pattern (15 points)
    if (ltf.pattern !== 'No clear pattern' && ltf.pattern !== 'None detected') mlScore += 15

    mlScore = Math.min(100, mlScore)

    // ── Signal decision ───────────────────────────────────────────────
    let direction = 'NO SIGNAL'
    if (htfBullish && pullbackScore >= 40 && mlScore >= 55) direction = 'BUY'
    if (htfBearish && pullbackScore >= 40 && mlScore >= 55) direction = 'SELL'

    // ── ATR-based SL/TP ───────────────────────────────────────────────
    const dp    = ltf.latestClose < 10 ? 5 : ltf.latestClose < 1000 ? 4 : 2
    const atr   = ltf.atr
    const price = ltf.latestClose

    // Tighter SL for mean reversion (1.5x ATR) — wider TP (2x, 3.5x, 5x ATR)
    const buySL   = (price - atr * 1.5).toFixed(dp)
    const buyTP1  = (price + atr * 2.0).toFixed(dp)
    const buyTP2  = (price + atr * 3.5).toFixed(dp)
    const buyTP3  = (price + atr * 5.0).toFixed(dp)
    const sellSL  = (price + atr * 1.5).toFixed(dp)
    const sellTP1 = (price - atr * 2.0).toFixed(dp)
    const sellTP2 = (price - atr * 3.5).toFixed(dp)
    const sellTP3 = (price - atr * 5.0).toFixed(dp)

    // ── Nearest S/R ───────────────────────────────────────────────────
    const nearestSupport    = ltf.sr.supports[ltf.sr.supports.length - 1]
    const nearestResistance = ltf.sr.resistances[0]

    // ── Build data summary for AI ─────────────────────────────────────
    const dataSummary = `
NAVIGATOR AI — MULTI-TIMEFRAME MEAN REVERSION STRATEGY
Symbol: ${cleanSymbol}

═══ HIGHER TIMEFRAME (${htfInterval}) — TREND DIRECTION ═══
- HTF Close:  ${htf.latestClose}
- HTF SMA 20: ${htf.sma20?.toFixed(dp)}
- HTF SMA 50: ${htf.sma50?.toFixed(dp)}
- HTF SMA 200:${htf.sma200?.toFixed(dp)}
- HTF RSI:    ${htf.rsi?.toFixed(2)}
- HTF Trend:  ${htfTrend}
- HTF Reason: ${htfBullish ? 'Price & SMA20 both above SMA50 — uptrend confirmed' : htfBearish ? 'Price & SMA20 both below SMA50 — downtrend confirmed' : 'Mixed signals — no clear trend'}

═══ ENTRY TIMEFRAME (${interval}) — MEAN REVERSION ENTRY ═══
- LTF Close:  ${ltf.latestClose}
- LTF SMA 8:  ${ltf.sma8?.toFixed(dp)}
- LTF SMA 20: ${ltf.sma20?.toFixed(dp)}
- LTF SMA 50: ${ltf.sma50?.toFixed(dp)}
- LTF RSI 14: ${ltf.rsi?.toFixed(2)}
- LTF ATR 14: ${ltf.atr?.toFixed(dp)}
- Near SMA 20 pullback: ${ltfNearSMA20 ? 'YES — price at mean reversion zone' : 'NO'}
- RSI Buy Zone (30-50):  ${rsiBuyZone ? 'YES' : 'NO'}
- RSI Sell Zone (50-70): ${rsiSellZone ? 'YES' : 'NO'}
- Candle Pattern: ${ltf.pattern}
- Support Levels:    ${ltf.sr.supports.map(s => s.toFixed(dp)).join(', ') || 'None'}
- Resistance Levels: ${ltf.sr.resistances.map(r => r.toFixed(dp)).join(', ') || 'None'}
- Nearest Support:    ${nearestSupport?.toFixed(dp) || 'None'}
- Nearest Resistance: ${nearestResistance?.toFixed(dp) || 'None'}

═══ STRATEGY SCORES ═══
- HTF Trend Score:    ${htfBullish || htfBearish ? '40/40' : '0/40'}
- Pullback Quality:   ${pullbackScore}/100
- ML Confluence Score: ${mlScore}/100

═══ SIGNAL ═══
- Direction: ${direction}
- Reason: ${direction === 'BUY' ? 'HTF bullish trend + LTF pullback to mean + RSI oversold bounce' : direction === 'SELL' ? 'HTF bearish trend + LTF pullback to mean + RSI overbought reversal' : 'Conditions not met for entry — waiting for pullback'}

═══ PRE-CALCULATED LEVELS ═══
BUY:  Entry ${price} | SL ${buySL} | TP1 ${buyTP1} | TP2 ${buyTP2} | TP3 ${buyTP3}
SELL: Entry ${price} | SL ${sellSL} | TP1 ${sellTP1} | TP2 ${sellTP2} | TP3 ${sellTP3}
`

    const prompt = `You are NAVIGATOR AI — an expert multi-timeframe trading analyst. You have been given REAL calculated market data. Use ONLY these numbers. Do NOT estimate or guess.

${dataSummary}

Based on the real data above, provide a complete analysis using the Multi-Timeframe Mean Reversion strategy. Be specific and reference the actual numbers.

Respond with ONLY a raw JSON object. No markdown. No text before or after. Start with { and end with }.

{
  "pair": "${cleanSymbol}",
  "timeframe": "${interval}",
  "htfTimeframe": "${htfInterval}",
  "currentPrice": "${price}",
  "direction": "${direction}",
  "setupName": "describe the exact setup e.g. HTF Bullish Trend + LTF Mean Reversion Pullback to SMA 20",
  "mlScore": ${mlScore},
  "pullbackScore": ${pullbackScore},
  "htfTrend": "${htfTrend}",
  "htfAnalysis": "2 sentences describing the HTF trend using the real HTF SMA and price values",
  "trendDirection": "Strongly Bullish or Bullish or Neutral or Bearish or Strongly Bearish",
  "trendStrength": "STRONG or MODERATE or WEAK",
  "meanReversionZone": "describe where the mean reversion entry zone is using real SMA 20 and support levels",
  "rsiReading": "describe the LTF RSI value and whether it is in buy or sell zone",
  "candlePattern": "${ltf.pattern}",
  "entryPrice": "${price}",
  "stopLoss": "${direction === 'BUY' ? buySL : sellSL}",
  "takeProfit1": "${direction === 'BUY' ? buyTP1 : sellTP1}",
  "takeProfit2": "${direction === 'BUY' ? buyTP2 : sellTP2}",
  "takeProfit3": "${direction === 'BUY' ? buyTP3 : sellTP3}",
  "riskReward": "1:3.3",
  "sentiment": "Strongly Bullish or Bullish or Neutral or Bearish or Strongly Bearish",
  "sentimentScore": ${mlScore},
  "priceAction": "2-3 sentences on LTF candle pattern pullback quality and entry zone location",
  "supportResistance": "2-3 sentences on nearest support and resistance levels and their significance",
  "technicalIndicators": "2-3 sentences on LTF SMA 8 20 50 RSI and ATR values",
  "marketSentiment": "2-3 sentences on HTF trend confirmation and overall multi-timeframe confluence",
  "summary": "3-4 sentences explaining the full trade setup — HTF trend direction, LTF pullback entry, exact SL TP levels, ML score and why this setup is valid or invalid",
  "tags": ["tag1", "tag2", "tag3"]
}`

    // ── Call AI ───────────────────────────────────────────────────────
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://navigator-ai-three.vercel.app',
        'X-Title': 'Navigator AI'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat:free',
        max_tokens: 800,
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
      // Fallback from real data
      result = buildFallbackResult({
        cleanSymbol, interval, htfInterval, price, direction,
        mlScore, pullbackScore, htfTrend, ltf, htf,
        buySL, buyTP1, buyTP2, buyTP3,
        sellSL, sellTP1, sellTP2, sellTP3, dp
      })
    }

    return res.status(200).json({ result })

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

// ── Fetch candles from Twelve Data ─────────────────────────────────────
async function fetchCandles(symbol, interval) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=100&apikey=${process.env.TWELVEDATA_API_KEY}&format=JSON`
  const res  = await fetch(url)
  const data = await res.json()

  if (data.status === 'error' || !data.values || !Array.isArray(data.values)) {
    // Try without slash
    const fallback = symbol.replace('/', '')
    const fbUrl  = `https://api.twelvedata.com/time_series?symbol=${fallback}&interval=${interval}&outputsize=100&apikey=${process.env.TWELVEDATA_API_KEY}&format=JSON`
    const fbRes  = await fetch(fbUrl)
    const fbData = await fbRes.json()
    if (fbData.status === 'error' || !fbData.values) {
      return { error: `Could not fetch data for "${symbol}" on ${interval}. Try: EURUSD, BTC/USD, XAU/USD, SPY` }
    }
    return { candles: parseCandles(fbData.values) }
  }

  return { candles: parseCandles(data.values) }
}

function parseCandles(values) {
  return values.reverse().map(c => ({
    time:   c.datetime,
    open:   parseFloat(c.open),
    high:   parseFloat(c.high),
    low:    parseFloat(c.low),
    close:  parseFloat(c.close),
    volume: parseFloat(c.volume || 0)
  }))
}

// ── Calculate all indicators ────────────────────────────────────────────
function calcIndicators(candles) {
  if (!candles || candles.length < 55) return null

  const closes = candles.map(c => c.close)
  const highs  = candles.map(c => c.high)
  const lows   = candles.map(c => c.low)
  const n      = closes.length

  function calcSMA(data, period) {
    if (data.length < period) return null
    const result = new Array(period - 1).fill(null)
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      result.push(sum / period)
    }
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
    let avgGain = gains / period, avgLoss = losses / period
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i] - data[i - 1]
      avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period
      avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period
      result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
    }
    return result
  }

  function calcATR(highs, lows, closes, period = 14) {
    const trs = [highs[0] - lows[0]]
    for (let i = 1; i < highs.length; i++) {
      trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])))
    }
    let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
    for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period
    return atr
  }

  function calcSR(highs, lows, strength = 5) {
    const supports = [], resistances = []
    for (let i = strength; i < highs.length - strength; i++) {
      let isHigh = true, isLow = true
      for (let j = i - strength; j <= i + strength; j++) {
        if (j === i) continue
        if (highs[j] >= highs[i]) isHigh = false
        if (lows[j] <= lows[i])   isLow  = false
      }
      if (isHigh) resistances.push(highs[i])
      if (isLow)  supports.push(lows[i])
    }
    const price = closes[closes.length - 1]
    return {
      supports:     supports.filter(s => s < price).slice(-3),
      resistances:  resistances.filter(r => r > price).slice(0, 3)
    }
  }

  function detectPattern(candles) {
    const last = candles[candles.length - 1]
    const prev = candles[candles.length - 2]
    if (!last || !prev) return 'None detected'
    const lastBody  = Math.abs(last.close - last.open)
    const lastRange = last.high - last.low
    const lowerWick = Math.min(last.open, last.close) - last.low
    const upperWick = last.high - Math.max(last.open, last.close)
    if (prev.close < prev.open && last.close > last.open && last.open < prev.close && last.close > prev.open) return 'Bullish Engulfing'
    if (prev.close > prev.open && last.close < last.open && last.open > prev.close && last.close < prev.open) return 'Bearish Engulfing'
    if (lowerWick > lastBody * 2 && upperWick < lastBody && last.close > last.open) return 'Bullish Pin Bar / Hammer'
    if (upperWick > lastBody * 2 && lowerWick < lastBody && last.close < last.open) return 'Bearish Shooting Star'
    if (lastBody < lastRange * 0.1) return 'Doji — indecision'
    if (lastBody > lastRange * 0.9) return last.close > last.open ? 'Bullish Marubozu' : 'Bearish Marubozu'
    if (last.high < prev.high && last.low > prev.low) return 'Inside Bar — compression'
    return 'No clear pattern'
  }

  const sma8Arr  = calcSMA(closes, 8)
  const sma20Arr = calcSMA(closes, 20)
  const sma50Arr = calcSMA(closes, 50)
  const sma200Arr= calcSMA(closes, Math.min(200, n - 1))
  const rsiArr   = calcRSI(closes, 14)

  return {
    latestClose: closes[n - 1],
    sma8:        sma8Arr?.[n - 1]   ?? null,
    sma20:       sma20Arr?.[n - 1]  ?? null,
    sma50:       sma50Arr?.[n - 1]  ?? null,
    sma200:      sma200Arr?.[n - 1] ?? null,
    rsi:         rsiArr?.[n - 1]    ?? 50,
    atr:         calcATR(highs, lows, closes, 14),
    sr:          calcSR(highs, lows, 5),
    pattern:     detectPattern(candles)
  }
}

// ── Fallback result builder ─────────────────────────────────────────────
function buildFallbackResult({ cleanSymbol, interval, htfInterval, price, direction, mlScore, pullbackScore, htfTrend, ltf, htf, buySL, buyTP1, buyTP2, buyTP3, sellSL, sellTP1, sellTP2, sellTP3, dp }) {
  const isBuy  = direction === 'BUY'
  const isSell = direction === 'SELL'
  return {
    pair:            cleanSymbol,
    timeframe:       interval,
    htfTimeframe:    htfInterval,
    currentPrice:    String(price),
    direction,
    setupName:       `HTF ${htfTrend} + LTF Mean Reversion to SMA 20`,
    mlScore,
    pullbackScore,
    htfTrend,
    htfAnalysis:     `${htfInterval} trend is ${htfTrend}. HTF SMA 20: ${htf.sma20?.toFixed(dp)}, SMA 50: ${htf.sma50?.toFixed(dp)}.`,
    trendDirection:  htfTrend === 'BULLISH' ? 'Bullish' : htfTrend === 'BEARISH' ? 'Bearish' : 'Neutral',
    trendStrength:   mlScore >= 70 ? 'STRONG' : mlScore >= 50 ? 'MODERATE' : 'WEAK',
    meanReversionZone: `LTF SMA 20 at ${ltf.sma20?.toFixed(dp)}. Nearest support: ${ltf.sr.supports[ltf.sr.supports.length - 1]?.toFixed(dp) || 'N/A'}.`,
    rsiReading:      `RSI at ${ltf.rsi?.toFixed(2)} — ${ltf.rsi < 40 ? 'oversold bounce zone' : ltf.rsi > 60 ? 'overbought reversal zone' : 'neutral'}.`,
    candlePattern:   ltf.pattern,
    entryPrice:      String(price),
    stopLoss:        isBuy ? buySL : sellSL,
    takeProfit1:     isBuy ? buyTP1 : sellTP1,
    takeProfit2:     isBuy ? buyTP2 : sellTP2,
    takeProfit3:     isBuy ? buyTP3 : sellTP3,
    riskReward:      '1:3.3',
    sentiment:       htfTrend === 'BULLISH' ? 'Bullish' : htfTrend === 'BEARISH' ? 'Bearish' : 'Neutral',
    sentimentScore:  mlScore,
    priceAction:     `${ltf.pattern} detected on ${interval}. Price ${price} near SMA 20 at ${ltf.sma20?.toFixed(dp)}.`,
    supportResistance: `Support: ${ltf.sr.supports.map(s => s.toFixed(dp)).join(', ')}. Resistance: ${ltf.sr.resistances.map(r => r.toFixed(dp)).join(', ')}.`,
    technicalIndicators: `SMA 8: ${ltf.sma8?.toFixed(dp)}, SMA 20: ${ltf.sma20?.toFixed(dp)}, SMA 50: ${ltf.sma50?.toFixed(dp)}, RSI: ${ltf.rsi?.toFixed(2)}, ATR: ${ltf.atr?.toFixed(dp)}.`,
    marketSentiment: `HTF ${htfInterval} trend is ${htfTrend}. ML Confluence: ${mlScore}/100. Pullback quality: ${pullbackScore}/100.`,
    summary:         `${direction} signal on ${cleanSymbol}. HTF ${htfInterval} confirms ${htfTrend} trend. Entry: ${price}. SL: ${isBuy ? buySL : sellSL}. TP1: ${isBuy ? buyTP1 : sellTP1}. TP2: ${isBuy ? buyTP2 : sellTP2}. TP3: ${isBuy ? buyTP3 : sellTP3}. ML Score: ${mlScore}/100.`,
    tags:            [htfTrend, ltf.pattern, direction === 'NO SIGNAL' ? 'Waiting' : 'Mean Reversion']
  }
}
