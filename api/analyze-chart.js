export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { imageBase64, symbol, timeframe } = req.body

  if (!imageBase64) return res.status(400).json({ error: 'No image provided' })

  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY

  const prompt = `You are an elite institutional trading analyst with deep expertise in Smart Money Concepts (SMC) and Classical Technical Analysis. Analyze this trading chart screenshot with extreme precision and accuracy.

Chart details: ${symbol || 'Unknown pair'} on ${timeframe || 'Unknown'} timeframe.

Perform a thorough analysis and return ONLY a valid JSON object with this exact structure:

{
  "direction": "BUY" or "SELL" or "NO SIGNAL",
  "confluenceScore": number 0-100,
  "entryPrice": "price as string",
  "stopLoss": "price as string",
  "takeProfit1": "price as string",
  "takeProfit2": "price as string",
  "takeProfit3": "price as string",
  "riskReward": "e.g. 1:2.5",
  "smcPatterns": [
    {
      "pattern": "pattern name e.g. Bearish Order Block",
      "price": "price level",
      "description": "brief explanation"
    }
  ],
  "keyLevels": {
    "majorResistance": "price",
    "majorSupport": "price",
    "currentPrice": "price from chart"
  },
  "marketStructure": {
    "trend": "BULLISH" or "BEARISH" or "RANGING",
    "lastBOS": "price of last Break of Structure",
    "lastChoch": "price of last Change of Character if visible",
    "phase": "e.g. Distribution, Accumulation, Markup, Markdown"
  },
  "liquidityZones": [
    {
      "type": "Buy-side Liquidity" or "Sell-side Liquidity",
      "price": "price level",
      "description": "brief explanation"
    }
  ],
  "fvgZones": [
    {
      "type": "Bullish FVG" or "Bearish FVG",
      "from": "price",
      "to": "price"
    }
  ],
  "classicalIndicators": {
    "trend": "description of trend from indicators",
    "momentum": "RSI/MACD assessment if visible",
    "keyMAs": "Moving average positions if visible"
  },
  "sessionContext": "London/NY/Asian session analysis if determinable",
  "tradeRationale": "2-3 sentence detailed explanation of why this trade setup is valid",
  "invalidationLevel": "price at which the setup is invalidated",
  "warnings": ["any warnings or caveats about the setup"]
}

Be extremely precise with price levels — read them directly from the chart. If you cannot determine a value, use null. Do not guess prices — only use what you can clearly see on the chart.`

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://navigator-ai-three.vercel.app',
        'X-Title': 'Navigator AI Chart Scanner'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'API request failed')
    }

    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('No response from AI')

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not parse AI response')

    const result = JSON.parse(jsonMatch[0])
    return res.status(200).json({ result })

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Analysis failed' })
  }
}
