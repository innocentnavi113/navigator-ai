import { useState } from 'react'
import { supabase } from '../supabase'
import { useAlerts } from '../useAlerts'
import styles from './Dashboard.module.css'

const INTERVALS = ['1min', '5min', '15min', '30min', '1h', '2h', '4h', '1day']

const POPULAR = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD',
  'BTC/USD', 'ETH/USD', 'SPY',     'ETH/BTC'
]

const HTF_MAP = {
  '1min': '15min', '5min': '1h', '15min': '4h', '30min': '4h',
  '1h': '1day', '2h': '1day', '4h': '1week', '1day': '1month'
}

export default function Dashboard({ session }) {
  const [symbol,        setSymbol]        = useState('')
  const [interval,      setInterval]      = useState('15min')
  const [loading,       setLoading]       = useState(false)
  const [result,        setResult]        = useState(null)
  const [error,         setError]         = useState('')
  const [showSettings,  setShowSettings]  = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)

  const {
    alertsEnabled, permission, watchlist, minMlScore,
    scanning, lastScan, toggleAlerts, addToWatchlist,
    removeFromWatchlist, scanWatchlist, alertOnSignal, setMinMlScore
  } = useAlerts()

  const userName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split('@')[0] ||
    'Trader'

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault()
      setInstallPrompt(e)
    })
  }

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstallPrompt(null)
  }

  async function handleSignOut() { await supabase.auth.signOut() }

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
      if (data.result) alertOnSignal(data.result)
    } catch (err) {
      setError('Analysis failed: ' + (err.message || 'Unknown error.'))
    } finally {
      setLoading(false)
    }
  }

  const isInWatchlist = watchlist.some(w => w.symbol === symbol.trim().toUpperCase())
  const htfLabel = HTF_MAP[interval] || '1day'

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
    if (/bull|buy|long|engulf|hammer|support|reversion/.test(t)) return styles.tagBull
    if (/bear|sell|short|shooting|resist/.test(t)) return styles.tagBear
    if (/neutral|range|doji|waiting|no signal/.test(t)) return styles.tagNeutral
    return styles.tagCyan
  }

  function getTrendColor(trend) {
    if (!trend) return 'var(--muted)'
    if (trend === 'BULLISH') return 'var(--green)'
    if (trend === 'BEARISH') return 'var(--pink)'
    return 'var(--amber)'
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
          {installPrompt && (
            <button className={styles.installBtn} onClick={handleInstall}>📲 Install App</button>
          )}
          <button
            className={`${styles.alertBtn} ${alertsEnabled ? styles.alertBtnOn : ''}`}
            onClick={() => setShowSettings(!showSettings)}
          >
            {alertsEnabled ? '🔔' : '🔕'}
            <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>{alertsEnabled ? 'ON' : 'OFF'}</span>
          </button>
          <div className={styles.userChip}>
            <div className={styles.userAvatar}>{userName.charAt(0).toUpperCase()}</div>
            <span className={styles.userName}>{userName}</span>
          </div>
          <button className={styles.signOutBtn} onClick={handleSignOut}>Sign Out</button>
        </div>
      </header>

      {/* ── Alert Settings Panel ── */}
      {showSettings && (
        <div className={styles.settingsPanel}>
          <div className={styles.settingsHeader}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1rem' }}>🔔 Alert Settings</div>
            <button className={styles.closeBtn} onClick={() => setShowSettings(false)}>✕</button>
          </div>
          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingLabel}>Push Notifications</div>
              <div className={styles.settingDesc}>
                {permission === 'granted' ? '✓ Permission granted' : permission === 'denied' ? '✗ Denied — check browser settings' : 'Click enable to request permission'}
              </div>
            </div>
            <button className={`${styles.toggleBtn} ${alertsEnabled ? styles.toggleBtnOn : ''}`} onClick={toggleAlerts}>
              {alertsEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingLabel}>Minimum ML Score</div>
              <div className={styles.settingDesc}>Only alert when ML score is above this</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" min="40" max="90" value={minMlScore} onChange={e => setMinMlScore(Number(e.target.value))} style={{ width: 80 }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.8rem', color: 'var(--cyan)', minWidth: 30 }}>{minMlScore}</span>
            </div>
          </div>
          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingLabel}>Manual Scan</div>
              <div className={styles.settingDesc}>{lastScan ? `Last scan: ${lastScan.toLocaleTimeString()}` : 'Not scanned yet'}</div>
            </div>
            <button className={styles.scanBtn} onClick={scanWatchlist} disabled={scanning || watchlist.length === 0}>
              {scanning ? '⏳ Scanning...' : '▶ Scan Now'}
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className={styles.settingLabel} style={{ marginBottom: 10 }}>Watchlist ({watchlist.length} pairs)</div>
            {watchlist.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '0.82rem', fontFamily: "'DM Mono', monospace" }}>
                No pairs added. Scan a symbol and click + Watch to add it.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {watchlist.map(w => (
                  <div key={w.symbol} className={styles.watchItem}>
                    <span>{w.symbol}</span>
                    <span style={{ opacity: 0.6, fontSize: '0.65rem' }}>{w.interval}</span>
                    <button className={styles.watchRemove} onClick={() => removeFromWatchlist(w.symbol)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={styles.iosInstall}>
            <div className={styles.settingLabel}>📱 Install on iPhone/iPad</div>
            <div className={styles.settingDesc}>Open in Safari → tap Share → tap "Add to Home Screen"</div>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.eyebrow}>◈ NAVIGATOR AI — Multi-Timeframe Mean Reversion</div>
        <h1 className={styles.heroTitle}>
          Enter Any Symbol,<br />
          <span className={styles.grad}>Get Real AI Analysis</span>
        </h1>
        <p className={styles.heroSub}>
          Higher timeframe trend confirmation + lower timeframe mean reversion entry.
          The most accurate and consistent strategy in algorithmic trading.
        </p>
      </div>

      {/* ── Strategy Info Banner ── */}
      <div style={{
        background: 'rgba(0,229,255,0.05)',
        border: '1px solid rgba(0,229,255,0.15)',
        borderRadius: 14,
        padding: '14px 18px',
        marginBottom: 20,
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: 'var(--cyan)', letterSpacing: '0.08em' }}>
          HOW IT WORKS
        </div>
        {[
          { step: '1', label: 'HTF Trend', desc: `${htfLabel} SMA 20/50` },
          { step: '2', label: 'LTF Pullback', desc: `${interval} to SMA 20` },
          { step: '3', label: 'RSI Zone', desc: '30-50 buy / 50-70 sell' },
          { step: '4', label: 'Entry Signal', desc: 'Candle confirmation' },
        ].map(({ step, label, desc }) => (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: 'rgba(0,229,255,0.15)',
              border: '1px solid rgba(0,229,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--cyan)'
            }}>{step}</div>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: 'var(--text)' }}>{label}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', color: 'var(--muted)' }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Input Card ── */}
      <div className={styles.inputCard}>
        <div className={styles.popularRow}>
          {POPULAR.map(p => (
            <button
              key={p}
              className={`${styles.popularBtn} ${symbol === p ? styles.popularBtnActive : ''}`}
              onClick={() => setSymbol(p)}
            >{p}</button>
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
          <select className={styles.intervalSelect} value={interval} onChange={e => setInterval(e.target.value)}>
            {INTERVALS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <button className={styles.analyzeBtn} onClick={analyzeSymbol} disabled={!symbol.trim() || loading}>
            {loading ? 'Scanning...' : '🧭 Scan'}
          </button>
        </div>
        {symbol.trim() && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className={`${styles.watchBtn} ${isInWatchlist ? styles.watchBtnActive : ''}`}
              onClick={() => isInWatchlist ? removeFromWatchlist(symbol.trim().toUpperCase()) : addToWatchlist(symbol.trim(), interval)}
            >
              {isInWatchlist ? '✓ Watching' : '+ Watch & Alert'}
            </button>
            {isInWatchlist && (
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: 'var(--green)' }}>
                Will alert on signal
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && <div className={styles.errorBox}>⚠ {error}</div>}

      {/* ── Loading ── */}
      {loading && (
        <div className={styles.loadingWrap}>
          <div className={styles.pulseLoader}><div className={styles.pulseCore} /></div>
          <div className={styles.loadingText}>Fetching {htfLabel} trend + {interval} entry data...</div>
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

          {/* ── HTF TREND CARD ── */}
          <div style={{
            background: 'var(--card)',
            border: `1px solid ${result.htfTrend === 'BULLISH' ? 'rgba(0,245,160,0.25)' : result.htfTrend === 'BEARISH' ? 'rgba(255,77,166,0.25)' : 'rgba(255,190,11,0.25)'}`,
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: getTrendColor(result.htfTrend) }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Higher Timeframe Trend ({result.htfTimeframe})
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.6rem', color: getTrendColor(result.htfTrend) }}>
                  {result.htfTrend === 'BULLISH' ? '▲' : result.htfTrend === 'BEARISH' ? '▼' : '◆'} {result.htfTrend ?? '—'}
                </div>
                <div style={{ fontSize: '0.84rem', color: '#c9d1e8', marginTop: 6, lineHeight: 1.5 }}>
                  {result.htfAnalysis}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: 'var(--muted)', marginBottom: 4 }}>ML SCORE</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '2rem', color: getMlColor(result.mlScore ?? 50) }}>
                  {result.mlScore ?? '—'}<span style={{ fontSize: '1rem', opacity: 0.6 }}>/100</span>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: 'var(--muted)', marginTop: 4 }}>
                  PULLBACK: <span style={{ color: 'var(--text)' }}>{result.pullbackScore ?? '—'}/100</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, width: `${result.mlScore ?? 50}%`, background: `linear-gradient(90deg, var(--violet), ${getMlColor(result.mlScore ?? 50)})`, transition: 'width 1s ease' }} />
              </div>
            </div>
          </div>

          {/* Setup name + pattern */}
          <div className={styles.sentimentCard} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div className={styles.sentimentLabel}>Setup Detected</div>
                <div style={{ fontSize: '0.95rem', fontFamily: "'Syne', sans-serif", fontWeight: 800, color: 'var(--cyan)', marginTop: 4 }}>
                  {result.setupName ?? '—'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              {[
                { label: 'TREND',      val: result.trendDirection },
                { label: 'STRENGTH',   val: result.trendStrength },
                { label: 'PATTERN',    val: result.candlePattern },
                { label: 'MEAN ZONE',  val: result.meanReversionZone?.split('.')[0] },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 12px', border: '1px solid var(--border)', maxWidth: 200 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: 'var(--text)' }}>{val ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Trade Setup Card */}
          <div className={`${styles.tradeCard} ${isBuy ? styles.tradeCardBuy : styles.tradeCardSell}`}>
            <div className={styles.tradeCardTop}>
              <div>
                <div className={styles.tradeLabel}>Signal</div>
                <div className={`${styles.directionBadge} ${isBuy ? styles.directionBuy : styles.directionSell}`}>
                  {isBuy ? '▲ BUY' : isSell ? '▼ SELL' : '— WAIT'}
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
                <div className={styles.levelLabel}>Stop Loss <span className={styles.tpHint}>(ATR x1.5)</span></div>
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
                <div className={styles.levelLabel}>TP 1 <span className={styles.tpHint}>(ATR x2)</span></div>
                <div className={styles.levelLine} style={{ background: 'rgba(0,245,160,0.2)' }} />
                <div className={styles.levelPrice} style={{ color: 'var(--green)', opacity: 0.7 }}>{result.takeProfit1 ?? '—'}</div>
              </div>
              <div className={styles.levelRow}>
                <div className={styles.levelDot} style={{ background: 'var(--green)' }} />
                <div className={styles.levelLabel}>TP 2 <span className={styles.tpHint}>(ATR x3.5)</span></div>
                <div className={styles.levelLine} style={{ background: 'rgba(0,245,160,0.3)' }} />
                <div className={styles.levelPrice} style={{ color: 'var(--green)' }}>{result.takeProfit2 ?? '—'}</div>
              </div>
              <div className={styles.levelRow}>
                <div className={styles.levelDot} style={{ background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />
                <div className={styles.levelLabel}>TP 3 <span className={styles.tpHint}>(ATR x5)</span></div>
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
              <div className={styles.cardTitle}>SMA &amp; RSI Readings</div>
              <div className={styles.cardContent}>{result.technicalIndicators}</div>
            </div>
            <div className={`${styles.card} ${styles.cardAmber}`}>
              <div className={styles.cardIcon}>🌐</div>
              <div className={styles.cardTitle}>MTF Confluence</div>
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
