import { useState, useRef } from 'react'
import { supabase } from '../supabase'
import styles from './Dashboard.module.css'

export default function Dashboard({ session }) {
  const [imageBase64, setImageBase64] = useState(null)
  const [imageType, setImageType]     = useState(null)
  const [previewUrl, setPreviewUrl]   = useState(null)
  const [dragOver, setDragOver]       = useState(false)
  const [loading, setLoading]         = useState(false)
  const [result, setResult]           = useState(null)
  const [error, setError]             = useState('')
  const fileInputRef = useRef(null)

  // Get the user's name from metadata, fall back to first part of email
  const userName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split('@')[0] ||
    'Trader'

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target.result
      setImageType(file.type)
      setImageBase64(dataUrl.split(',')[1])
      setPreviewUrl(dataUrl)
      setResult(null)
      setError('')
    }
    reader.readAsDataURL(file)
  }

  function clearImage(e) {
    e.stopPropagation()
    setImageBase64(null); setImageType(null); setPreviewUrl(null)
    setResult(null); setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    loadFile(e.dataTransfer.files[0])
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

async function analyzeChart() {
  if (!imageBase64) return
  setLoading(true); setResult(null); setError('')

  const prompt = `Analyze this trading chart. You MUST respond with ONLY a JSON object. No text before or after. No markdown. No explanation. Just the raw JSON object starting with { and ending with }.

{
  "pair": "detected pair e.g. EURUSD",
  "timeframe": "detected timeframe e.g. 30M",
  "direction": "BUY or SELL",
  "sentiment": "Bullish or Bearish or Neutral or Strongly Bullish or Strongly Bearish",
  "sentimentScore": 50,
  "entryPrice": "price level",
  "stopLoss": "price level",
  "takeProfit1": "price level",
  "takeProfit2": "price level",
  "takeProfit3": "price level",
  "riskReward": "1:2",
  "priceAction": "2-3 sentences",
  "supportResistance": "2-3 sentences",
  "technicalIndicators": "2-3 sentences",
  "marketSentiment": "2-3 sentences",
  "summary": "3-4 sentences",
  "tags": ["tag1", "tag2", "tag3"]
}`

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [
          {
            role: 'system',
            content: 'You are a trading analyst. You ONLY respond with raw JSON objects. Never add any text, markdown, or explanation outside the JSON.'
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${imageType};base64,${imageBase64}` } },
              { type: 'text', text: prompt }
            ]
          }
        ]
      })
    })
    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error(`Model returned: "${text.slice(0, 200)}"`)
    setResult(JSON.parse(jsonMatch[0].trim()))
  } catch (err) {
    setError('Analysis failed: ' + (err.message || 'Unknown error.'))
  } finally {
    setLoading(false)
  }
}

  function getSentimentColor(score) {
    if (score >= 65) return 'var(--green)'
    if (score <= 35) return 'var(--pink)'
    return 'var(--amber)'
  }

  function getSentimentGradient(score) {
    if (score >= 65) return 'linear-gradient(90deg, var(--green), var(--cyan))'
    if (score <= 35) return 'linear-gradient(90deg, var(--pink), var(--violet))'
    return 'linear-gradient(90deg, var(--amber), #ff9900)'
  }

  function getTagClass(tag) {
    const t = tag.toLowerCase()
    if (/bull|break|long|uptrend|buy|strong/.test(t)) return styles.tagBull
    if (/bear|sell|down|short|weak|reversal/.test(t)) return styles.tagBear
    if (/neutral|range|consolidat/.test(t)) return styles.tagNeutral
    return styles.tagCyan
  }

  const isBuy = result?.direction === 'BUY'

  return (
    <div className={styles.wrapper}>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>🧭</div>
          <span className={styles.logoNav}>NAVIGATOR</span>
          <span className={styles.logoAi}>AI</span>
        </div>
        <div className={styles.headerRight}>
          {/* Avatar + name — no email shown */}
          <div className={styles.userChip}>
            <div className={styles.userAvatar}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className={styles.userName}>{userName}</span>
          </div>
          <button className={styles.signOutBtn} onClick={handleSignOut}>Sign Out</button>
        </div>
      </header>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.eyebrow}>◈ Precision Trade Intelligence</div>
        <h1 className={styles.heroTitle}>
          Drop Your Chart,<br />
          <span className={styles.grad}>Get Your Trade Plan</span>
        </h1>
        <p className={styles.heroSub}>
          Upload any trading chart for instant AI-powered entry, stop loss,
          take profit levels and full market analysis.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        className={`${styles.dropZone} ${dragOver ? styles.dragOver : ''} ${previewUrl ? styles.hasImage : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !previewUrl && fileInputRef.current?.click()}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Chart preview" className={styles.previewImg} />
            <button className={styles.clearBtn} onClick={clearImage}>✕ Clear</button>
          </>
        ) : (
          <div className={styles.dropContent}>
            <div className={styles.dropIcon}>📊</div>
            <div className={styles.dropTitle}>Drop your chart here</div>
            <div className={styles.dropSub}>Supports PNG, JPG, WEBP — any timeframe, any pair</div>
            <button className={styles.browseBtn} onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>
              ⬆ Browse Chart
            </button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => loadFile(e.target.files[0])} />
      </div>

      {/* Analyze button */}
      <div className={styles.analyzeWrap}>
        <button className={styles.analyzeBtn} onClick={analyzeChart} disabled={!imageBase64 || loading}>
          {loading ? 'Navigating...' : '🧭 Analyze Chart'}
        </button>
      </div>

      {error && <div className={styles.errorBox}>⚠ {error}</div>}

      {loading && (
        <div className={styles.loadingWrap}>
          <div className={styles.pulseLoader}><div className={styles.pulseCore} /></div>
          <div className={styles.loadingText}>Navigator AI is reading your chart...</div>
        </div>
      )}

      {result && (
        <div className={styles.results}>

          <div className={styles.resultsHeader}>
            <div className={styles.resultsTitle}>Analysis Complete</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {result.pair && <span className={styles.pairBadge}>{result.pair}</span>}
              {result.timeframe && <span className={styles.tfBadge}>{result.timeframe}</span>}
              <span className={styles.badge}>LIVE RESULT</span>
            </div>
          </div>

          {/* ── TRADE SETUP CARD ── */}
          <div className={`${styles.tradeCard} ${isBuy ? styles.tradeCardBuy : styles.tradeCardSell}`}>
            <div className={styles.tradeCardTop}>
              <div>
                <div className={styles.tradeLabel}>Signal</div>
                <div className={`${styles.directionBadge} ${isBuy ? styles.directionBuy : styles.directionSell}`}>
                  {isBuy ? '▲ BUY' : '▼ SELL'}
                </div>
              </div>
              <div>
                <div className={styles.tradeLabel}>Entry Price</div>
                <div className={styles.tradePrice}>{result.entryPrice ?? '—'}</div>
              </div>
              <div>
                <div className={styles.tradeLabel}>Risk / Reward</div>
                <div className={styles.tradeRR}>{result.riskReward ?? '—'}</div>
              </div>
            </div>

            <div className={styles.tradeLevels}>
              <div className={styles.levelRow}>
                <div className={styles.levelDot} style={{ background: 'var(--pink)' }} />
                <div className={styles.levelLabel}>Stop Loss</div>
                <div className={styles.levelLine} style={{ background: 'rgba(255,77,166,0.3)' }} />
                <div className={styles.levelPrice} style={{ color: 'var(--pink)' }}>{result.stopLoss ?? '—'}</div>
              </div>
              <div className={styles.levelRow}>
                <div className={styles.levelDot} style={{ background: 'var(--cyan)' }} />
                <div className={styles.levelLabel}>Entry</div>
                <div className={styles.levelLine} style={{ background: 'rgba(0,229,255,0.3)' }} />
                <div className={styles.levelPrice} style={{ color: 'var(--cyan)' }}>{result.entryPrice ?? '—'}</div>
              </div>
              <div className={styles.levelRow}>
                <div className={styles.levelDot} style={{ background: 'var(--green)', opacity: 0.6 }} />
                <div className={styles.levelLabel}>TP 1 <span className={styles.tpHint}>(Conservative)</span></div>
                <div className={styles.levelLine} style={{ background: 'rgba(0,245,160,0.2)' }} />
                <div className={styles.levelPrice} style={{ color: 'var(--green)', opacity: 0.7 }}>{result.takeProfit1 ?? '—'}</div>
              </div>
              <div className={styles.levelRow}>
                <div className={styles.levelDot} style={{ background: 'var(--green)' }} />
                <div className={styles.levelLabel}>TP 2 <span className={styles.tpHint}>(Main Target)</span></div>
                <div className={styles.levelLine} style={{ background: 'rgba(0,245,160,0.3)' }} />
                <div className={styles.levelPrice} style={{ color: 'var(--green)' }}>{result.takeProfit2 ?? '—'}</div>
              </div>
              <div className={styles.levelRow}>
                <div className={styles.levelDot} style={{ background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />
                <div className={styles.levelLabel}>TP 3 <span className={styles.tpHint}>(Extended)</span></div>
                <div className={styles.levelLine} style={{ background: 'rgba(0,245,160,0.4)' }} />
                <div className={styles.levelPrice} style={{ color: 'var(--green)', fontWeight: 800 }}>{result.takeProfit3 ?? '—'}</div>
              </div>
            </div>
          </div>

          {/* Sentiment */}
          <div className={styles.sentimentCard}>
            <div className={styles.sentimentLabel}>Overall Market Sentiment</div>
            <div className={styles.sentimentRow}>
              <div className={styles.sentimentValue} style={{ color: getSentimentColor(result.sentimentScore) }}>
                {result.sentiment}
              </div>
              <div className={styles.sentimentBarWrap}>
                <div className={styles.sentimentBar} style={{ width: `${result.sentimentScore}%`, background: getSentimentGradient(result.sentimentScore) }} />
              </div>
            </div>
            <div className={styles.tagsRow}>
              {(result.tags || []).map((tag, i) => (
                <span key={i} className={`${styles.tag} ${getTagClass(tag)}`}>{tag}</span>
              ))}
            </div>
          </div>

          {/* 4-card grid */}
          <div className={styles.grid}>
            <div className={`${styles.card} ${styles.cardCyan}`}>
              <div className={styles.cardIcon}>🕯️</div>
              <div className={styles.cardTitle}>Price Action &amp; Patterns</div>
              <div className={styles.cardContent}>{result.priceAction}</div>
            </div>
            <div className={`${styles.card} ${styles.cardViolet}`}>
              <div className={styles.cardIcon}>📐</div>
              <div className={styles.cardTitle}>Support &amp; Resistance</div>
              <div className={styles.cardContent}>{result.supportResistance}</div>
            </div>
            <div className={`${styles.card} ${styles.cardPink}`}>
              <div className={styles.cardIcon}>📊</div>
              <div className={styles.cardTitle}>Technical Indicators</div>
              <div className={styles.cardContent}>{result.technicalIndicators}</div>
            </div>
            <div className={`${styles.card} ${styles.cardAmber}`}>
              <div className={styles.cardIcon}>🌐</div>
              <div className={styles.cardTitle}>Market Sentiment</div>
              <div className={styles.cardContent}>{result.marketSentiment}</div>
            </div>
          </div>

          {/* Summary */}
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>✦ AI Trade Rationale &amp; Risk Warning</div>
            <div className={styles.summaryText}>{result.summary}</div>
          </div>

        </div>
      )}
    </div>
  )
}
