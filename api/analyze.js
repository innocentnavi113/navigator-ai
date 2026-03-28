export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageBase64, imageType, prompt } = req.body

  if (!imageBase64 || !imageType || !prompt) {
    return res.status(400).json({ error: 'Missing imageBase64, imageType, or prompt' })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY is not set in environment variables' })
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://navigator-ai-three.vercel.app',
        'X-Title': 'Navigator AI'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageType};base64,${imageBase64}`
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
      return res.status(response.status).json({
        error: data.error?.message || 'OpenRouter API error'
      })
    }

    // Get raw text from model
    let text = data.choices?.[0]?.message?.content || ''

    // Strip markdown code fences
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim()

    // Extract the JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(500).json({
        error: `Model returned unexpected content: "${text.slice(0, 200)}"`
      })
    }

    let jsonStr = jsonMatch[0]

    // ── Clean up common AI JSON mistakes ──────────────────────────────

    // Replace curly/smart quotes with straight quotes
    jsonStr = jsonStr
      .replace(/[\u201C\u201D]/g, '"')  // " "
      .replace(/[\u2018\u2019]/g, "'")  // ' '

    // Remove trailing commas before } or ]
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')

    // Replace literal newlines inside strings with a space
    jsonStr = jsonStr.replace(/\n/g, ' ')

    // The main fix: clean double quotes INSIDE string values
    // Strategy: parse each string value and replace inner " with '
    jsonStr = jsonStr.replace(/:\s*"([\s\S]*?)(?<!\\)"(?=\s*[,}\]])/g, (match, inner) => {
      // Replace any unescaped double quotes inside the value with single quotes
      const cleaned = inner.replace(/(?<!\\)"/g, "'")
      return `: "${cleaned}"`
    })

    let result
    try {
      result = JSON.parse(jsonStr)
    } catch (e) {
      // Last resort: try to extract key fields manually
      const extract = (key) => {
        const m = jsonStr.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`) )
        return m ? m[1] : '—'
      }
      result = {
        pair:            extract('pair'),
        timeframe:       extract('timeframe'),
        direction:       extract('direction'),
        marketStructure: extract('marketStructure'),
        structureBreak:  extract('structureBreak'),
        fvgZone:         extract('fvgZone'),
        orderBlock:      extract('orderBlock'),
        entryPrice:      extract('entryPrice'),
        stopLoss:        extract('stopLoss'),
        takeProfit1:     extract('takeProfit1'),
        takeProfit2:     extract('takeProfit2'),
        takeProfit3:     extract('takeProfit3'),
        riskReward:      extract('riskReward'),
        killZone:        extract('killZone'),
        sentiment:       extract('sentiment'),
        sentimentScore:  50,
        priceAction:     extract('priceAction'),
        supportResistance: extract('supportResistance'),
        technicalIndicators: extract('technicalIndicators'),
        marketSentiment: extract('marketSentiment'),
        summary:         extract('summary'),
        tags:            ['ICT', 'Smart Money']
      }
    }

    return res.status(200).json({ result })

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
