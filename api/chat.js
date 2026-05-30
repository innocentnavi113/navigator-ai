// api/chat.js — Streaming Forex AI assistant via OpenRouter
// Accepts: { messages: [{ role: 'user'|'assistant', content: string }, ...] }
// Returns: text/event-stream (OpenAI-compatible SSE)

const SYSTEM_PROMPT = `You are Navigator AI's Forex Assistant — an expert in Smart Money Concepts (SMC), Classical TA, forex market structure, sessions, news catalysts, risk management, and trading psychology.

Rules:
- Answer ONLY forex / trading / market questions. If asked something unrelated, politely steer back.
- Be concise, institutional, and practical. Use bullet points when helpful.
- Use SMC terminology (BOS, CHoCH, OB, FVG, liquidity sweep, premium/discount) when relevant.
- Never give financial advice — frame ideas as educational analysis.
- Mention session timing in UTC when relevant (London 07:00–16:00, NY 12:30–21:00, Asia 00:00–07:00).
- Keep answers under ~200 words unless the user asks for depth.`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY is not set' });
  }

  let messages = [];
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (!messages.length) return res.status(400).json({ error: 'messages required' });

  // Sanitize + cap history
  const cleaned = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://navigator-ai.app',
        'X-Title': 'Navigator AI Forex Chat',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        stream: true,
        max_tokens: 800,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...cleaned],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const txt = await upstream.text().catch(() => '');
      if (upstream.status === 429) return res.status(429).json({ error: 'Rate limit exceeded — try again shortly.' });
      if (upstream.status === 402) return res.status(402).json({ error: 'AI credits exhausted.' });
      return res.status(500).json({ error: `Upstream error: ${txt.slice(0, 200)}` });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}
