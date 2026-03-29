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

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  async function analyzeChart() {
    if (!imageBase64) return
    setLoading(true)
    setResult(null)
    setError('')

    const prompt = `You are NAVIGATOR AI — an advanced multi-timeframe scalping analyst powered by machine learning pattern recognition. Analyze this chart using all of the following techniques simultaneously:

1. EMA/MA CROSSOVERS: Detect fast EMA crossing slow EMA or MA. EMA 8/21 crossover, EMA 20/50 crossover, or any visible MA cross. State direction and strength.

2. SUPPORT AND RESISTANCE BREAKOUTS: Identify key horizontal S/R levels. Detect if price has broken out above resistance or below support. Rate breakout strength as STRONG, MODERATE or WEAK.

3. RSI ANALYSIS: Estimate RSI value from price action momentum. Flag if overbought above 70, oversold below 30, or showing divergence. State if RSI confirms or rejects the trade signal.

4. CANDLESTICK PATTERNS: Identify any of these patterns visible on the chart: Bullish Engulfing, Bearish Engulfing, Pin Bar, Hammer, Shooting Star, Doji, Morning Star, Evening Star, Inside Bar, Marubozu. State exact pattern name and location.

5. MULTI-TIMEFRAME BIAS: Based on what is visible, state the higher timeframe trend direction and whether the scalp trade aligns with it.

6. MACHINE LEARNING PATTERN SCORE: Rate the overall setup probability from 0 to 100 based on confluence of all signals. Above 70 is high probability. Below 40 is low probability.

7. TREND DIRECTION AND STRENGTH: State if trend is Strongly Bullish, Bullish, Neutral, Bearish, or Strongly Bearish. Rate strength as STRONG, MODERATE, or WEAK.

8. ENTRY CALCULATION: Entry price at the pattern confirmation level. Stop Loss below the pattern low for BUY or above pattern high for SELL. TP1 at 1:1 RR, TP2 at 1:2 RR, TP3 at 1:3 RR.

Respond with ONLY a raw JSON object. No markdown. No explanation. No text before or after. Start with { and end with }.

{
  "pair": "exact instrument name from the chart",
  "timeframe": "detected timeframe",
  "direction": "BUY or SELL or NO SIGNAL",
  "setupName": "name of the detected pattern or setup e.g. Bullish Engulfing at Support or EMA 8/21 Golden Cross",
  "mlScore": 75,
  "trendDirection": "Strongly Bullish or Bullish or Neutral or Bearish or Strongly Bearish",
  "trendStrength": "STRONG or MODERATE or WEAK",
  "emaCrossover": "describe any EMA or MA crossover visible — type direction and bars since cross",
  "srBreakout": "describe any support or resistance breakout — price level and breakout strength",
  "rsiReading": "estimated RSI value and status — overbought oversold or neutral and whether it confirms the signal",
  "candlePattern": "exact candlestick pattern name detected and its location on the chart",
  "multiTimeframeBias": "higher timeframe trend direction and whether this scalp aligns with it",
  "entryPrice": "exact entry price level",
  "stopLoss": "exact SL price level with reason e.g. below pin bar low at 1.2310",
  "takeProfit1": "TP1 price at 1:1 risk reward",
  "takeProfit2": "TP2 price at 1:2 risk reward",
  "takeProfit3": "TP3 price at 1:3 risk reward",
  "riskReward": "1:3",
  "sentiment": "Strongly Bullish or Bullish or Neutral or Bearish or Strongly Bearish",
  "sentimentScore": 75,
  "priceAction": "2-3 sentences on the candlestick pattern detected trend direction and momentum",
  "supportResistance": "2-3 sentences on key S/R levels breakouts and price reaction zones",
  "technicalIndicators": "2-3 sentences on EMA/MA crossover RSI reading and indicator confluence",
  "marketSentiment": "2-3 sentences on multi-timeframe bias and ML pattern probability score",
  "summary": "3-4 sentences — the setup name signal direction entry SL all 3 TPs ML score and overall trade confidence rating",
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

      setResult(data.result)

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

  function getMlScoreColor(score) {
    if (score >= 70) return 'var(--green)'
    if (score >= 50) return 'var(--amber)'
    return 'var(--pink)'
  }

  function getTagClass(tag) {
    const t = tag.toLowerCase()
    if (/bull|buy|long|golden|cross|break|engulf|hammer|support/.test(t)) return styles.tagBull
    if (/bear|sell|short|death|cross|breakdown|shooting|resist/.test(t)) return styles.tagBear
    if (/neutral|range|doji|inside|consolid/.test(t)) return styles.tagNeutral
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
        <div className={styles.eyebrow}>◈ ML-Powered Multi-Strategy Scalper</div>
        <h1 className={styles.heroTitle}>
          Drop Your Chart,<br />
          <span className={styles.grad}>Get Your Trade Plan</span>
        </h1>
        <p className={styles.heroSub}>
          AI analyzes EMA crossovers, S/R breakouts, RSI, candlestick patterns
          and multi-timeframe bias to find high-probability scalping setups.
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
          {loading ? 'Analysing...' : '🧭 Analyze Chart'}
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
          <div className={styles.loadingText}>Navigator AI is scanning your chart...</div>
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

          {/* ML Score + Setup Name */}
          {(result.setupName || result.mlScore) && (
            <div className={styles.sentimentCard} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div className={styles.sentimentLabel}>Detected Setup</div>
                  <div style={{ fontSize: '1.1rem', fontFamily: "'Syne', sans-serif", fontWeight: 800, color: 'var(--cyan)' }}>
                    {result.setupName ?? '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={styles.sentimentLabel}>ML Probability Score</div>
                  <div style={{ fontSize: '2rem', fontFamily: "'Syne', sans-serif", fontWeight: 800, color: getMlScoreColor(result.mlScore ?? 50) }}>
                    {result.mlScore ?? '—'}<span style={{ fontSize: '1rem', opacity: 0.6 }}>/100</span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div className={styles.sentimentBarWrap}>
                  <div
                    className={styles.sentimentBar}
                    style={{
                      width: `${result.mlScore ?? 50}%`,
                      background: `linear-gradient(90deg, var(--violet), ${getMlScoreColor(result.mlScore ?? 50)})`
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: 'var(--muted)' }}>
                  TREND: <span style={{ color: 'var(--text)' }}>{result.trendDirection ?? '—'}</span>
                </span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: 'var(--muted)' }}>
                  STRENGTH: <span style={{ color: 'var(--text)' }}>{result.trendStrength ?? '—'}</span>
                </span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: 'var(--muted)' }}>
                  MTF BIAS: <span style={{ color: 'var(--cyan)' }}>{result.multiTimeframeBias?.split(' ').slice(0,3).join(' ') ?? '—'}</span>
                </span>
              </div>
            </div>
          )}

          {/* Trade Setup Card */}
          <div className={`${styles.tradeCard} ${isBuy ? styles.tradeCardBuy : styles.tradeCardSell}`}>
            <div className={styles.tradeCardTop}>
              <div>
                <div className={styles.tradeLabel}>Signal</div>
                <div className={`${styles.directionBadge} ${isBuy ? styles.directionBuy : styles.directionSell}`}>
                  {isBuy ? '▲ BUY' : result?.direction === 'SELL' ? '▼ SELL' : '— NO SIGNAL'}
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
                <div className={styles.levelLabel}>TP 1 <span className={styles.tpHint}>(1:1 RR)</span></div>
                <div className={styles.levelLine} style={{ background: 'rgba(0,245,160,0.2)' }} />
                <div className={styles.levelPrice} style={{ color: 'var(--green)', opacity: 0.7 }}>{result.takeProfit1 ?? '—'}</div>
              </div>
              <div className={styles.levelRow}>
                <div className={styles.levelDot} style={{ background: 'var(--green)' }} />
                <div className={styles.levelLabel}>TP 2 <span className={styles.tpHint}>(1:2 RR)</span></div>
                <div className={styles.levelLine} style={{ background: 'rgba(0,245,160,0.3)' }} />
                <div className={styles.levelPrice} style={{ color: 'var(--green)' }}>{result.takeProfit2 ?? '—'}</div>
              </div>
              <div className={styles.levelRow}>
                <div className={styles.levelDot} style={{ background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />
                <div className={styles.levelLabel}>TP 3 <span className={styles.tpHint}>(1:3 RR)</span></div>
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
              <div className={styles.cardTitle}>Candlestick Pattern</div>
              <div className={styles.cardContent}>{result.priceAction}</div>
            </div>
            <div className={`${styles.card} ${styles.cardViolet}`}>
              <div className={styles.cardIcon}>📐</div>
              <div className={styles.cardTitle}>Support &amp; Resistance</div>
              <div className={styles.cardContent}>{result.supportResistance}</div>
            </div>
            <div className={`${styles.card} ${styles.cardPink}`}>
              <div className={styles.cardIcon}>📊</div>
              <div className={styles.cardTitle}>EMA Cross &amp; RSI</div>
              <div className={styles.cardContent}>{result.technicalIndicators}</div>
            </div>
            <div className={`${styles.card} ${styles.cardAmber}`}>
              <div className={styles.cardIcon}>🤖</div>
              <div className={styles.cardTitle}>ML Score &amp; MTF Bias</div>
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
