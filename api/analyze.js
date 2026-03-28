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
        model: 'meta-llama/llama-4-maverick:free',
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

    const text = data.choices?.[0]?.message?.content || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(500).json({
        error: `Model returned unexpected content: "${text.slice(0, 200)}"`
      })
    }

    const result = JSON.parse(jsonMatch[0].trim())
    return res.status(200).json({ result })

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
