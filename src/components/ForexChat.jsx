import { useState, useRef, useEffect } from 'react'
import styles from './ForexChat.module.css'

const SUGGESTIONS = [
  "What's the best session to trade GBP/USD?",
  'Explain liquidity sweeps in SMC',
  'How do I spot a valid order block?',
  'Risk management for a $1k account?',
]

export default function ForexChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bodyRef = useRef(null)

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages, loading])

  async function send(text) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    const userMsg = { role: 'user', content }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantSoFar = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      let done = false
      while (!done) {
        const { value, done: d } = await reader.read()
        if (d) break
        buffer += decoder.decode(value, { stream: true })
        let nl
        while ((nl = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, nl)
          buffer = buffer.slice(nl + 1)
          if (line.endsWith('\r')) line = line.slice(0, -1)
          if (!line || line.startsWith(':')) continue
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') { done = true; break }
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              assistantSoFar += delta
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = { role: 'assistant', content: assistantSoFar }
                return copy
              })
            }
          } catch {
            buffer = line + '\n' + buffer
            break
          }
        }
      }
    } catch (e) {
      setMessages(prev => [
        ...prev.filter(m => m.content !== ''),
        { role: 'assistant', content: `⚠️ ${e.message || 'Something went wrong.'}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button className={styles.fab} onClick={() => setOpen(true)} aria-label="Open AI assistant">
        💬
      </button>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>◎ Forex AI Assistant</div>
        <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close">×</button>
      </div>

      <div className={styles.body} ref={bodyRef}>
        {messages.length === 0 && (
          <div>
            <div className={styles.intro}>
              Ask me anything about forex — SMC, sessions, news, risk, or specific pairs.
            </div>
            <div className={styles.suggestGrid}>
              {SUGGESTIONS.map(s => (
                <button key={s} className={styles.suggest} onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`${styles.msgRow} ${m.role === 'user' ? styles.msgUser : styles.msgBot}`}>
            <div className={`${styles.bubble} ${m.role === 'user' ? styles.bubbleUser : styles.bubbleBot}`}>
              {m.content || '…'}
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role === 'user' && (
          <div className={styles.typing}>
            <span className={styles.dot} /> thinking…
          </div>
        )}
      </div>

      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); send() }}>
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about forex…"
          disabled={loading}
        />
        <button className={styles.send} type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
