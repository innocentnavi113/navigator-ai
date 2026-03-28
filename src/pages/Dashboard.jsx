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

       const prompt = `You are ULTRAVENOM AI — a trading analyst that uses the exact same logic as the ULTRAVENOM AI scalper pro Expert Advisor. Analyze this M15 chart using these exact rules:

STRATEGY RULES:
1. MARKET STRUCTURE: Identify if price is BULLISH (above SMA 80) or BEARISH (below SMA 80)
2. BREAK OF STRUCTURE (BoS): Bullish BoS = price breaks above recent swing high. Bearish BoS = price breaks below recent swing low
3. CHANGE OF CHARACTER (CHoCH): In downtrend price breaks swing high = bullish reversal. In uptrend price breaks swing low = bearish reversal
4. FAIR VALUE GAP (FVG): 3-candle pattern where candle 1 high and candle 3 low dont overlap (bullish FVG) or candle 1 low and candle 3 high dont overlap (bearish FVG). Minimum 5 pips
5. ORDER BLOCK: Last bearish candle before strong bullish move (bullish OB) or last bullish candle before strong bearish move (bearish OB)
6. ENTRY: Only enter when price PULLS BACK into the FVG or Order Block after BoS or CHoCH
7. SL: ATR(14) x 2.0 from entry price
8. TP1: ATR(14) x 2.0 from entry (conservative)
9. TP2: ATR(14) x 3.5 from entry (main target)
10. TP3: ATR(14) x 5.0 from entry (full EA target)
11. KILL ZONES: London (8-12 GMT) and New York (13-19 GMT) sessions only
12. NO TRADE if price is not pulling back into FVG or OB zone

Based on what you see in this chart, simulate exactly what ULTRAVENOM AI EA would do.

You MUST respond with ONLY a JSON object. No text before or after. No markdown. Just raw JSON starting with { and ending with }.

{
  "pair": "READ the exact instrument name visible in the chart image",
  "timeframe": "M15",
  "direction": "BUY or SELL or NO SIGNAL",
  "marketStructure": "BULLISH or BEARISH or RANGING — based on price vs SMA 80",
  "structureBreak": "Describe the BoS or CHoCH detected — e.g. Bullish BoS: price broke above swing high at 1.2345",
  "fvgZone": "Describe the FVG zone detected — upper and lower levels e.g. FVG between 1.2310 and 1.2325",
  "orderBlock": "Describe the Order Block detected — upper and lower levels e.g. Bullish OB between 1.2290 and 1.2310",
  "entryZone": "Price level where EA would enter — inside the FVG or OB zone e.g. 1.2315",
  "entryPrice": "Exact entry price level",
  "stopLoss": "Exact SL price — ATR x 2.0 below entry for BUY or above entry for SELL",
  "takeProfit1": "TP1 price — ATR x 2.0 from entry (conservative, 1:1 RR)",
  "takeProfit2": "TP2 price — ATR x 3.5 from entry (main target, 1:1.75 RR)",
  "takeProfit3": "TP3 price — ATR x 5.0 from entry (EA full target, 1:2.5 RR)",
  "riskReward": "1:2.5",
  "killZone": "LONDON or NEW YORK or OUTSIDE KILL ZONE",
  "sentiment": "Strongly Bullish or Bullish or Neutral or Bearish or Strongly Bearish",
  "sentimentScore": 50,
  "priceAction": "2-3 sentences on market structure, BoS or CHoCH location, and pullback status",
  "supportResistance": "2-3 sentences on the FVG and Order Block zones visible on the chart",
  "technicalIndicators": "2-3 sentences on SMA 80 position, ATR value estimate, and price relationship to SMA",
  "marketSentiment": "2-3 sentences on overall ICT bias and whether a valid pullback entry exists",
  "summary": "3-4 sentences — exactly what ULTRAVENOM AI would do: entry zone, SL, TP levels, and any reasons it would NOT trade",
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
              <div className={styles.cardIcon}>📊</div>
              <div className={styles.cardTitle}>Market Structure & BoS/CHoCH</div>
              <div className={styles.cardContent}>{result.priceAction}</div>
            </div>
            <div className={`${styles.card} ${styles.cardViolet}`}>
              <div className={styles.cardIcon}>🧱</div>
              <div className={styles.cardTitle}>FVG & Order Block Zones</div>
              <div className={styles.cardContent}>{result.supportResistance}</div>
            </div>
            <div className={`${styles.card} ${styles.cardPink}`}>
              <div className={styles.cardIcon}>📈</div>
              <div className={styles.cardTitle}>SMA 80 & ATR Readings</div>
              <div className={styles.cardContent}>{result.technicalIndicators}</div>
            </div>
            <div className={`${styles.card} ${styles.cardAmber}`}>
              <div className={styles.cardIcon}>🎯</div>
              <div className={styles.cardTitle}>ICT Bias & Entry Signal</div>
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
