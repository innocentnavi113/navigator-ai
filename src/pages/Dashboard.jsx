import { useState } from 'react'
import { supabase } from '../supabase'
import styles from './Dashboard.module.css'

const INTERVALS = ['1min', '5min', '15min', '30min', '1h', '2h', '4h', '1day']

const POPULAR = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD',
  'BTC/USD', 'ETH/USD', 'SPY',     'ETH/BTC'
]

export default function Dashboard({ session }) {
  const [symbol,   setSymbol]   = useState('')
  const [interval, setInterval] = useState('15min')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState('')

  const userName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split('@')[0] ||
    'Trader'

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  async function analyzeSymbol() {
    if (!symbol.trim()) return
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.trim().toUpperCase(), interval })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'API request failed')
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

  function getMlColor(score) {
    if (score >= 70) return 'var(--green)'
    if (score >= 50) return 'var(--amber)'
    return 'var(--pink)'
  }

  function getTagClass(tag) {
    const t = tag.toLowerCase()
    if (/bull|buy|long|golden|engulf|hammer|support/.test(t)) return styles.tagBull
    if (/bear|sell|short|death|shooting|resist/.test(t)) return styles.tagBear
    if (/neutral|range|doji|no signal/.test(t)) return styles.tagNeutral
    return styles.tagCyan
  }

  const isBuy  = result?.direction === 'BUY'
  const isSell = result?.direction === 'SELL'

  return (
    <div className={styles.wrapper}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>🧭</div>
          <span className={styles.logoNav}>NAVIGATOR</span>
          <span className={styles.logoAi}>AI</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.userChip}>
            <div className={styles.userAvatar}>{userName.charAt(0).toUpperCase()}</div>
            <span className={styles.userName}>{userName}</span>
          </div>
          <button className={styles.signOutBtn} onClick={handleSignOut}>Sign Out</button>
        </div>
      </header>

      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.eyebrow}>◈ NAVIGATOR AI — SMA Crossover Strategy</div>
        <h1 className={styles.heroTitle}>
          Enter Any Symbol,<br />
          <span className={styles.grad}>Get Real AI Analysis</span>
        </h1>
        <p className={styles.heroSub}>
          Live market data fetched automatically. Real SMA 8/21/50, RSI, ATR
          and S/R levels calculated for high-probability trade signals.
        </p>
      </div>

      {/* ── Input Card ── */}
      <div className={styles.inputCard}>
        <div className={styles.popularRow}>
          {POPULAR.map(p => (
            <button
              key={p}
              className={`${styles.popularBtn} ${symbol === p ? styles.popularBtnActive : ''}`}
              onClick={() => setSymbol(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <div className={styles.inputRow}>
          <input
            className={styles.symbolInput}
            type="text"
            placeholder="e.g. EUR/USD, BTC/USD, XAU/USD, SPY"
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && analyzeSymbol()}
          />
          <select
            className={styles.intervalSelect}
            value={interval}
            onChange={e => setInterval(e.target.value)}
          >
            {INTERVALS.map(i => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          <button
            className={styles.analyzeBtn}
            onClick={analyzeSymbol}
            disabled={!symbol.trim() || loading}
          >
            {loading ? 'Scanning...' : '🧭 Scan'}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && <div className={styles.errorBox}>⚠ {error}</div>}

      {/* ── Loading ── */}
      {loading && (
        <div className={styles.loadingWrap}>
          <div className={styles.pulseLoader}><div className={styles.pulseCore} /></div>
          <div className={styles.loadingText}>Fetching live data and calculating SMA indicators...</div>
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div className={styles.results}>

          {/* Header row */}
          <div className={styles.resultsHeader}>
            <div className={styles.resultsTitle}>Analysis Complete</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={styles.pairBadge}>{result.pair}</span>
              <span className={styles.tfBadge}>{result.timeframe}</span>
              {result.currentPrice && <span className={styles.tfBadge}>@ {result.currentPrice}</span>}
              <span className={styles.badge}>LIVE DATA</span>
            </div>
          </div>

          {/* ML Score + Setup */}
          <div className={styles.sentimentCard} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div className={styles.sentimentLabel}>Detected Setup</div>
                <div style={{ fontSize: '1rem', fontFamily: "'Syne', sans-serif", fontWeight: 800, color: 'var(--cyan)', marginTop: 4 }}>
                  {result.setupName ?? '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={styles.sentimentLabel}>ML Score</div>
                <div style={{ fontSize: '2rem', fontFamily: "'Syne', sans-serif", fontWeight: 800, color: getMlColor(result.mlScore ?? 50) }}>
                  {result.mlScore ?? '—'}<span style={{ fontSize: '1rem', opacity: 0.6 }}>/100</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className={styles.sentimentBarWrap}>
                <div className={styles.sentimentBar} style={{
                  width: `${result.mlScore ?? 50}%`,
                  background: `linear-gradient(90deg, var(--violet), ${getMlColor(result.mlScore ?? 50)})`
                }} />
              </div>
            </div>
            {/* SMA values row */}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              {[
                { label: 'TREND', val: result.trendDirection },
                { label: 'STRENGTH', val: result.trendStrength },
                { label: 'PATTERN', val: result.candlePattern },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 12px', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', color: 'var(--text)' }}>{val ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SMA Trend Filter Banner */}
          {result.trendFilter && (
            <div style={{
              background: isBuy ? 'rgba(0,245,160,0.08)' : isSell ? 'rgba(255,77,166,0.08)' : 'rgba(255,190,11,0.08)',
              border: `1px solid ${isBuy ? 'rgba(0,245,160,0.25)' : isSell ? 'rgba(255,77,166,0.25)' : 'rgba(255,190,11,0.25)'}`,
              borderRadius: 12,
              padding: '12px 18px',
              marginBottom: 16,
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.78rem',
              color: isBuy ? 'var(--green)' : isSell ? 'var(--pink)' : 'var(--amber)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span>{isBuy ? '▲' : isSell ? '▼' : '◆'}</span>
              <span>SMA 50 TREND FILTER: {result.trendFilter}</span>
            </div>
          )}

          {/* Trade Setup Card */}
          <div className={`${styles.tradeCard} ${isBuy ? styles.tradeCardBuy : styles.tradeCardSell}`}>
            <div className={styles.tradeCardTop}>
              <div>
                <div className={styles.tradeLabel}>Signal</div>
                <div className={`${styles.directionBadge} ${isBuy ? styles.directionBuy : styles.directionSell}`}>
                  {isBuy ? '▲ BUY' : isSell ? '▼ SELL' : '— NO SIGNAL'}
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
                <div className={styles.levelLabel}>TP 1 <span className={styles.tpHint}>(ATR x1)</span></div>
                <div className={styles.levelLine} style={{ background: 'rgba(0,245,160,0.2)' }} />
                <div className={styles.levelPrice} style={{ color: 'var(--green)', opacity: 0.7 }}>{result.takeProfit1 ?? '—'}</div>
              </div>
              <div className={styles.levelRow}>
                <div className={styles.levelDot} style={{ background: 'var(--green)' }} />
                <div className={styles.levelLabel}>TP 2 <span className={styles.tpHint}>(ATR x2)</span></div>
                <div className={styles.levelLine} style={{ background: 'rgba(0,245,160,0.3)' }} />
                <div className={styles.levelPrice} style={{ color: 'var(--green)' }}>{result.takeProfit2 ?? '—'}</div>
              </div>
              <div className={styles.levelRow}>
                <div className={styles.levelDot} style={{ background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />
                <div className={styles.levelLabel}>TP 3 <span className={styles.tpHint}>(ATR x3)</span></div>
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
                <div className={styles.sentimentBar} style={{
                  width: `${result.sentimentScore}%`,
                  background: getSentimentGradient(result.sentimentScore)
                }} />
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
              <div className={styles.cardTitle}>Candle Pattern</div>
              <div className={styles.cardContent}>{result.priceAction}</div>
            </div>
            <div className={`${styles.card} ${styles.cardViolet}`}>
              <div className={styles.cardIcon}>📐</div>
              <div className={styles.cardTitle}>Support &amp; Resistance</div>
              <div className={styles.cardContent}>{result.supportResistance}</div>
            </div>
            <div className={`${styles.card} ${styles.cardPink}`}>
              <div className={styles.cardIcon}>📊</div>
              <div className={styles.cardTitle}>SMA Cross &amp; RSI</div>
              <div className={styles.cardContent}>{result.technicalIndicators}</div>
            </div>
            <div className={`${styles.card} ${styles.cardAmber}`}>
              <div className={styles.cardIcon}>🤖</div>
              <div className={styles.cardTitle}>ML Score &amp; Confluence</div>
              <div className={styles.cardContent}>{result.marketSentiment}</div>
            </div>
          </div>

          {/* Summary */}
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>✦ NAVIGATOR AI — Trade Rationale &amp; Risk Warning</div>
            <div className={styles.summaryText}>{result.summary}</div>
          </div>

        </div>
      )}
    </div>
  )
}
