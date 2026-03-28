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

  const userName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split('@')[0] ||
    'Trader'

  // ── File handling ────────────────────────────────────────────────────────

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
    setImageBase64(null)
    setImageType(null)
    setPreviewUrl(null)
    setResult(null)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    loadFile(e.dataTransfer.files[0])
  }

  // ── Sign out ─────────────────────────────────────────────────────────────

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  // ── AI Analysis ──────────────────────────────────────────────────────────

  async function analyzeChart() {
    if (!imageBase64) return
    setLoading(true)
    setResult(null)
    setError('')

          const prompt = `You are NAVI V3 — an AI trading analyst based on the NAVI V3 Expert Advisor strategy. Analyze this chart using the exact same logic as the EA.

The EA uses these indicators and rules:
- ENTRY: AMA (fast, period 1) crossover above/below LWMA (slow, period 50) on M5
- CONFIRMATION: ADX > 22 with +DI/-DI direction alignment
- MOMENTUM: MACD (8,17,9) must align with direction
- TREND STRENGTH: ADX must be gaining (not falling) — consecutive rising bars
- RSI (14): Must be above 30 for BUY, below 70 for SELL
- ACCELERATOR OSCILLATOR: Must align with trade direction
- FRACTALS: Entry triggered on first fractal after crossover
- SUPPORT/RESISTANCE: Price must not be blocked at key S/R levels
- ATR (14): Used for SL (x2) and TP (x5) calculation
- BREAKEVEN: Triggered at 3x ATR profit
- RSI EXIT: Close trade if RSI reaches extreme (70/30) with profit > 300 pips
- AGGRESSIVE MODE: Requires ADX > 20, RSI > 55 bull / < 45 bear

Based on what you see in the chart, simulate what NAVI V3 would do.

You MUST respond with ONLY a JSON object. No text before or after. No markdown. Just raw JSON starting with { and ending with }.

{
  "pair": "READ the exact instrument name visible in the chart image",
  "timeframe": "detected timeframe e.g. M5",
  "direction": "BUY or SELL or NO SIGNAL",
  "crossover": "Describe the AMA/LWMA crossover status — bullish cross, bearish cross, or no cross",
  "adxStatus": "ADX value estimate and whether it is GAINING or LOSING or NEUTRAL",
  "macdAlignment": "ALIGNED or NOT ALIGNED with direction",
  "rsiValue": "estimated RSI value and status",
  "fractalSignal": "Describe any fractal pattern visible after the crossover",
  "sentiment": "Strongly Bullish or Bullish or Neutral or Bearish or Strongly Bearish",
  "sentimentScore": 50,
  "entryPrice": "price level based on current ask/bid",
  "stopLoss": "price level — ATR x2 from entry",
  "takeProfit1": "price level — ATR x2 (conservative)",
  "takeProfit2": "price level — ATR x3.5 (main target)",
  "takeProfit3": "price level — ATR x5 (EA full target)",
  "breakevenLevel": "price level where EA would move SL to breakeven (ATR x3)",
  "riskReward": "1:2.5",
  "srAnalysis": "Describe any visible support or resistance levels blocking or confirming the trade",
  "priceAction": "2-3 sentences on M5 candle structure, crossover bar, and fractal formation",
  "supportResistance": "2-3 sentences on key S/R levels the EA would detect",
  "technicalIndicators": "2-3 sentences on ADX strength, MACD alignment, RSI, and AC oscillator readings",
  "marketSentiment": "2-3 sentences on overall trend bias and whether aggressive mode would activate",
  "summary": "3-4 sentences — what NAVI V3 EA would do on this chart: entry signal, confirmation status, SL/TP placement, and any filters that would block the trade",
  "tags": ["tag1", "tag2", "tag3"]
}`

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, imageType, prompt })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'API request failed')
      }

      // api/analyze.js returns { result: { ...parsed chart data } }
      setResult(data.result)

    } catch (err) {
      setError('Analysis failed: ' + (err.message || 'Unknown error.'))
    } finally {
      setLoading(false)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

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

  // ── Render ───────────────────────────────────────────────────────────────

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
          <div className={styles.userChip}>
            <div className={styles.userAvatar}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className={styles.userName}>{userName}</span>
          </div>
          <button className={styles.signOutBtn} onClick={handleSignOut}>
            Sign Out
          </button>
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
            <button
              className={styles.browseBtn}
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
            >
              ⬆ Browse Chart
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => loadFile(e.target.files[0])}
        />
      </div>

      {/* Analyze button */}
      <div className={styles.analyzeWrap}>
        <button
          className={styles.analyzeBtn}
          onClick={analyzeChart}
          disabled={!imageBase64 || loading}
        >
          {loading ? 'Navigating...' : '🧭 Analyze Chart'}
        </button>
      </div>

      {/* Error */}
      {error && <div className={styles.errorBox}>⚠ {error}</div>}

      {/* Loading */}
      {loading && (
        <div className={styles.loadingWrap}>
          <div className={styles.pulseLoader}>
            <div className={styles.pulseCore} />
          </div>
          <div className={styles.loadingText}>Navigator AI is reading your chart...</div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className={styles.results}>

          {/* Header row */}
          <div className={styles.resultsHeader}>
            <div className={styles.resultsTitle}>Analysis Complete</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {result.pair      && <span className={styles.pairBadge}>{result.pair}</span>}
              {result.timeframe && <span className={styles.tfBadge}>{result.timeframe}</span>}
              <span className={styles.badge}>LIVE RESULT</span>
            </div>
          </div>

          {/* Trade Setup Card */}
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
                <div
                  className={styles.sentimentBar}
                  style={{
                    width: `${result.sentimentScore}%`,
                    background: getSentimentGradient(result.sentimentScore)
                  }}
                />
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
