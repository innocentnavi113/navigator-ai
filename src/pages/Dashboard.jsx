import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useAlerts } from '../useAlerts'
import { useSubscription } from '../useSubscription'
import SubscriptionPage from './SubscriptionPage'
import styles from './Dashboard.module.css'
import ChartScanner from './ChartScanner'
import NewsPanel from '../components/NewsPanel'


const INTERVALS = ['1min', '5min', '15min', '30min', '1h', '2h', '4h', '1day']
const POPULAR = ['EUR/USD', 'GBP/USD', 'XAU/USD', 'USD/JPY', 'BTC/USD', 'ETH/USD', 'SPY', 'US30']
const HTF_MAP = {
  '1min': '15min', '5min': '1h', '15min': '4h', '30min': '4h',
  '1h': '1day', '2h': '1day', '4h': '1week', '1day': '1month'
}
const SCAN_STEPS = [
  'Reading price axis',
  'Mapping market structure',
  'Detecting S/R & order blocks',
  'Scanning liquidity & FVGs',
  'Calculating indicators',
  'Generating signal',
]
const TABS = ['Scanner', 'Multi-TF', 'Watchlist', 'Chart', 'Learn']

export default function Dashboard({ session }) {
  const [activeTab,     setActiveTab]     = useState('Scanner')
  const [symbol,        setSymbol]        = useState('')
  const [interval,      setInterval]      = useState('1h')
  const [loading,       setLoading]       = useState(false)
  const [result,        setResult]        = useState(null)
  const [error,         setError]         = useState('')
  const [scanStep,      setScanStep]      = useState(0)
  const [showSettings,  setShowSettings]  = useState(false)
  const [showUpgrade,   setShowUpgrade]   = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [htfResults,    setHtfResults]    = useState([])
  const [htfLoading,    setHtfLoading]    = useState(false)
  const scanTimer = useRef(null)

  const {
    alertsEnabled, permission, watchlist, minMlScore,
    scanning, lastScan, toggleAlerts, addToWatchlist,
    removeFromWatchlist, scanWatchlist, alertOnSignal, setMinMlScore
  } = useAlerts()

  const {
    plan, scansLeft, canScan, expiryDate, consumeScan
  } = useSubscription()

  const userName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split('@')[0] ||
    'Trader'

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault(); setInstallPrompt(e)
      })
    }
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstallPrompt(null)
  }

  async function handleSignOut() { await supabase.auth.signOut() }

  function startScanAnimation() {
    setScanStep(0)
    let step = 0
    scanTimer.current = setInterval(() => {
      step++
      setScanStep(step)
      if (step >= SCAN_STEPS.length) clearInterval(scanTimer.current)
    }, 600)
  }

  async function analyzeSymbol(sym = symbol, intv = interval) {
    if (!sym.trim()) return
    if (!canScan) { setShowUpgrade(true); return }
    const ok = consumeScan()
    if (!ok) { setShowUpgrade(true); return }

    setLoading(true)
    setResult(null)
    setError('')
    startScanAnimation()

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym.trim().toUpperCase(), interval: intv })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'API request failed')
      setResult(data.result)
      if (data.result) alertOnSignal(data.result)
    } catch (err) {
      setError('Analysis failed: ' + (err.message || 'Unknown error.'))
    } finally {
      clearInterval(scanTimer.current)
      setScanStep(SCAN_STEPS.length)
      setLoading(false)
    }
  }

  async function runMultiTF() {
    if (!symbol.trim()) return
    if (plan !== 'premium' && scansLeft < 4) { setShowUpgrade(true); return }
    setHtfLoading(true)
    setHtfResults([])
    const tfs = ['15min', '1h', '4h', '1day']
    const results = []
    for (const tf of tfs) {
      consumeScan()
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: symbol.trim().toUpperCase(), interval: tf })
        })
        const data = await res.json()
        if (data.result) results.push({ tf, ...data.result })
      } catch (e) {}
    }
    setHtfResults(results)
    setHtfLoading(false)
  }

  if (showUpgrade) {
    return (
      <SubscriptionPage
        onBack={() => setShowUpgrade(false)}
        currentPlan={plan}
        scansLeft={scansLeft === -1 ? '∞' : scansLeft}
      />
    )
  }

  const {
  // ...existing...
  forexNews, btcNews, tweets, trumpAlerts,
 } = useAlerts()

  const isInWatchlist = watchlist.some(w => w.symbol === symbol.trim().toUpperCase())
  const isBuy  = result?.direction === 'BUY'
  const isSell = result?.direction === 'SELL'

  function getDirectionColor(dir) {
    if (dir === 'BUY')  return '#00e676'
    if (dir === 'SELL') return '#ff4444'
    return '#888'
  }

  function getMlColor(score) {
    if (score >= 70) return '#00e676'
    if (score >= 50) return '#ffd600'
    return '#ff4444'
  }

  function getTrendColor(trend) {
    if (!trend) return '#888'
    if (trend === 'BULLISH' || trend?.includes('Bull')) return '#00e676'
    if (trend === 'BEARISH' || trend?.includes('Bear')) return '#ff4444'
    return '#ffd600'
  }

  function getPlanColor() {
    if (plan === 'premium')  return '#00e676'
    if (plan === 'standard') return '#00bcd4'
    return '#5a6370'
  }

  return (
    <div className={styles.app}>

      {/* ── TOP BAR ── */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <div className={styles.logoMark}>
            <div className={styles.logoEye}>◎</div>
          </div>
          <div>
            <div className={styles.appName}>Navigator <span className={styles.appAI}>AI</span></div>
            <div className={styles.appSub}>INTELLIGENCE ENGINE</div>
          </div>
        </div>
        <div className={styles.topRight}>
          <button
            className={styles.planBadge}
            style={{ borderColor: getPlanColor(), color: getPlanColor(), background: `${getPlanColor()}12` }}
            onClick={() => setShowUpgrade(true)}
          >
            <span className={styles.planDot} style={{ background: getPlanColor() }} />
            {plan === 'premium' ? 'Premium' : plan === 'standard' ? 'Standard' : 'Free'}
          </button>
          <button
            className={`${styles.iconBtn} ${alertsEnabled ? styles.iconBtnActive : ''}`}
            onClick={() => setShowSettings(!showSettings)}
          >🔔</button>
          <button className={styles.iconBtn} onClick={handleSignOut}>⏻</button>
        </div>
      </div>

      {/* ── SCAN COUNTER BAR ── */}
      {plan !== 'premium' && (
        <div className={styles.scanCountBar}>
          <div className={styles.scanCountInfo}>
            <span style={{ color: scansLeft === 0 ? '#ff4444' : '#99a0ad' }}>
              {scansLeft === 0 ? '⚠ No scans left' : `${scansLeft} scan${scansLeft !== 1 ? 's' : ''} remaining`}
            </span>
            <span className={styles.scanCountSub}> · {plan} plan</span>
          </div>
          <button className={styles.upgradeLink} onClick={() => setShowUpgrade(true)}>
            Upgrade ↗
          </button>
        </div>
      )}

      {plan === 'premium' && expiryDate && (
        <div className={styles.premiumBar}>
          <span className={styles.premiumDot} />
          Premium active · expires {expiryDate}
        </div>
      )}

      {/* ── TABS ── */}
      <div className={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => { setActiveTab(tab); if (tab === 'Multi-TF') runMultiTF() }}
          >{tab}</button>
        ))}
      </div>

      {/* ── SYMBOL INPUT ── */}
      <div className={styles.inputSection}>
        <div className={styles.symbolRow}>
          <div className={styles.symbolInputWrap}>
            <span className={styles.symbolIcon}>◎</span>
            <input
              className={styles.symbolInput}
              type="text"
              placeholder="Symbol e.g. XAU/USD, BTC/USD"
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && analyzeSymbol()}
            />
          </div>
          <select
            className={styles.tfSelect}
            value={interval}
            onChange={e => setInterval(e.target.value)}
          >
            {INTERVALS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div className={styles.pairsRow}>
          {POPULAR.map(p => (
            <button
              key={p}
              className={`${styles.pairChip} ${symbol === p ? styles.pairChipActive : ''}`}
              onClick={() => setSymbol(p)}
            >{p}</button>
          ))}
        </div>

        <div className={styles.actionRow}>
          <div className={styles.strategistBadge}>
            <span className={styles.strategistDot} />
            Strategist
          </div>
          {symbol.trim() && (
            <button
              className={`${styles.watchChip} ${isInWatchlist ? styles.watchChipActive : ''}`}
              onClick={() => isInWatchlist
                ? removeFromWatchlist(symbol.trim().toUpperCase())
                : addToWatchlist(symbol.trim(), interval)}
            >
              {isInWatchlist ? '✓ Watching' : '+ Watch'}
            </button>
          )}
          <button
            className={styles.scanBtn}
            onClick={() => analyzeSymbol()}
            disabled={!symbol.trim() || loading}
            style={{ background: !canScan ? '#ff4444' : undefined }}
          >
            {loading ? 'Scanning...' : !canScan ? '🔒 Upgrade' : 'Scan'}
          </button>
        </div>
      </div>

      {/* ── ALERT SETTINGS ── */}
      {showSettings && (
        <div className={styles.settingsPanel}>
          <div className={styles.settingsPanelHeader}>
            <span>🔔 Alert Settings</span>
            <button className={styles.closeBtn} onClick={() => setShowSettings(false)}>✕</button>
          </div>
          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingLabel}>Push Notifications</div>
              <div className={styles.settingDesc}>{permission === 'granted' ? '✓ Granted' : 'Click to enable'}</div>
            </div>
            <button className={`${styles.toggleBtn} ${alertsEnabled ? styles.toggleBtnOn : ''}`} onClick={toggleAlerts}>
              {alertsEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingLabel}>Min ML Score: {minMlScore}</div>
              <div className={styles.settingDesc}>Only alert above this score</div>
            </div>
            <input type="range" min="40" max="90" value={minMlScore}
              onChange={e => setMinMlScore(Number(e.target.value))} style={{ width: 80 }} />
          </div>
          {installPrompt && (
            <button className={styles.installBtn} onClick={handleInstall}>📲 Install App to Home Screen</button>
          )}
          <div className={styles.iosHint}>iPhone: Safari → Share → Add to Home Screen</div>
          <NewsPanel
            latestNews={latestNews}
            forexNews={forexNews}
           btcNews={btcNews}
           tweets={tweets}
           trumpAlerts={trumpAlerts}
           lastNewsScan={lastNewsScan}
           newsAlerts={newsAlerts}
           toggleNewsAlerts={toggleNewsAlerts}
           scanNews={scanNews}
 />
          <div className={styles.settingRow} style={{ borderBottom: 'none', paddingTop: 14 }}>
            <div>
              <div className={styles.settingLabel}>Subscription</div>
              <div className={styles.settingDesc}>
                {plan === 'premium' ? `Premium · expires ${expiryDate}` :
                 plan === 'standard' ? `Standard · ${scansLeft} scans left` :
                 `Free · ${scansLeft} scans left`}
              </div>
            </div>
            <button className={styles.upgradeLink}
              onClick={() => { setShowSettings(false); setShowUpgrade(true) }}>
              {plan === 'free' ? 'Upgrade ↗' : 'Manage ↗'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════ SCANNER TAB ══════════ */}
      {activeTab === 'Scanner' && (
        <div className={styles.tabContent}>
          {error && <div className={styles.errorBox}>⚠ {error}</div>}

          {!canScan && !loading && (
            <div className={styles.noScansCard}>
              <div className={styles.noScansIcon}>🔒</div>
              <div className={styles.noScansTitle}>No Scans Remaining</div>
              <div className={styles.noScansText}>Upgrade to continue scanning markets with AI analysis</div>
              <button className={styles.noScansCta} onClick={() => setShowUpgrade(true)}>View Plans →</button>
            </div>
          )}

          {loading && (
            <div className={styles.analyzingCard}>
              <div className={styles.analyzingOrb}>
                <div className={styles.analyzingRing} />
                <div className={styles.analyzingCore}>◎</div>
              </div>
              <div className={styles.analyzingTitle}>Analyzing</div>
              <div className={styles.analyzingSubtitle}>Reading structure, order flow & liquidity...</div>
              <div className={styles.analyzingBar}>
                <div className={styles.analyzingBarFill} style={{ width: `${(scanStep / SCAN_STEPS.length) * 100}%` }} />
              </div>
              <div className={styles.stepsList}>
                {SCAN_STEPS.map((step, i) => (
                  <div key={step} className={`${styles.stepItem} ${i < scanStep ? styles.stepDone : i === scanStep ? styles.stepActive : ''}`}>
                    <div className={styles.stepCheck}>{i < scanStep ? '✓' : '○'}</div>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && !loading && (
            <div className={styles.resultsSection}>
              <div className={styles.signalHeader}>
                <div className={styles.signalLeft}>
                  <div className={styles.signalPair}>{result.pair}</div>
                  <div className={styles.signalMeta}>
                    <span className={styles.signalTf}>{result.timeframe}</span>
                    <span className={styles.signalTf}>{result.htfTimeframe} HTF</span>
                    {result.currentPrice && <span className={styles.signalPrice}>@ {result.currentPrice}</span>}
                  </div>
                </div>
                <div className={styles.signalRight}>
                  <div className={styles.mlCircle} style={{ borderColor: getMlColor(result.mlScore ?? 50) }}>
                    <div className={styles.mlScore} style={{ color: getMlColor(result.mlScore ?? 50) }}>{result.mlScore ?? '—'}</div>
                    <div className={styles.mlLabel}>ML</div>
                  </div>
                </div>
              </div>

              <div className={`${styles.directionBanner} ${isBuy ? styles.directionBuy : isSell ? styles.directionSell : styles.directionNeutral}`}>
                <div className={styles.directionIcon}>{isBuy ? '▲' : isSell ? '▼' : '◆'}</div>
                <div>
                  <div className={styles.directionLabel}>{result.direction === 'NO SIGNAL' ? 'WAIT — NO SIGNAL' : result.direction}</div>
                  <div className={styles.directionSetup}>{result.setupName}</div>
                </div>
                <div className={styles.directionRR}>{result.riskReward}</div>
              </div>

              <div className={styles.sectionCard}>
                <div className={styles.sectionCardLabel}>Higher Timeframe Bias ({result.htfTimeframe})</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ color: getTrendColor(result.htfTrend), fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.1rem' }}>
                    {result.htfTrend === 'BULLISH' ? '▲' : result.htfTrend === 'BEARISH' ? '▼' : '◆'} {result.htfTrend}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#888' }}>
                    STRENGTH: <span style={{ color: '#eee' }}>{result.trendStrength}</span>
                  </div>
                </div>
                <div className={styles.sectionCardText}>{result.htfAnalysis}</div>
              </div>

              <div className={styles.levelsCard}>
                <div className={styles.sectionCardLabel}>Trade Levels</div>
                <div className={styles.levelsList}>
                  {[
                    { type: 'SL', label: 'Stop Loss',  price: result.stopLoss,    color: '#ff4444' },
                    { type: 'E',  label: 'Entry',       price: result.entryPrice,  color: '#00bcd4' },
                    { type: 'T1', label: 'Target 1',    price: result.takeProfit1, color: 'rgba(0,230,118,0.7)' },
                    { type: 'T2', label: 'Target 2',    price: result.takeProfit2, color: 'rgba(0,230,118,0.85)' },
                    { type: 'T3', label: 'Target 3',    price: result.takeProfit3, color: '#00e676' },
                  ].map(({ type, label, price, color }) => (
                    <div key={type} className={styles.levelItem} style={{ borderColor: color }}>
                      <div className={styles.levelType} style={{ color }}>{type}</div>
                      <div className={styles.levelName}>{label}</div>
                      <div className={styles.levelPrice} style={{ color }}>{price ?? '—'}</div>
                    </div>
                  ))}
                </div>
                <div className={styles.levelsStrip}>
                  <div>S: <span style={{ color: '#00e676' }}>{result.stopLoss ?? '—'}</span></div>
                  <div>R: <span style={{ color: '#ff4444' }}>{result.takeProfit3 ?? '—'}</span></div>
                </div>
              </div>

              <div className={styles.analysisGrid}>
                {[
                  { icon: '🕯️', label: 'Price Action',    text: result.priceAction },
                  { icon: '📐', label: 'S/R & Liquidity', text: result.supportResistance },
                  { icon: '📊', label: 'Indicators',       text: result.technicalIndicators },
                  { icon: '🌐', label: 'MTF Confluence',   text: result.marketSentiment },
                ].map(({ icon, label, text }) => (
                  <div key={label} className={styles.analysisCard}>
                    <div className={styles.analysisCardIcon}>{icon}</div>
                    <div className={styles.analysisCardLabel}>{label}</div>
                    <div className={styles.analysisCardText}>{text}</div>
                  </div>
                ))}
              </div>

              <div className={styles.tagsRow}>
                {(result.tags || []).map((tag, i) => (
                  <div key={i} className={styles.tag} style={{
                    borderColor: tag?.toLowerCase().includes('bull') || tag === 'BUY' ? 'rgba(0,230,118,0.4)' :
                                 tag?.toLowerCase().includes('bear') || tag === 'SELL' ? 'rgba(255,68,68,0.4)' : 'rgba(255,255,255,0.15)',
                    color: tag?.toLowerCase().includes('bull') || tag === 'BUY' ? '#00e676' :
                           tag?.toLowerCase().includes('bear') || tag === 'SELL' ? '#ff4444' : '#aaa'
                  }}>{tag}</div>
                ))}
              </div>

              <div className={styles.summaryCard}>
                <div className={styles.summaryLabel}>AI Trade Rationale</div>
                <div className={styles.summaryText}>{result.summary}</div>
                <div className={styles.annotationFooter}>ANNOTATED BY NAVIGATOR AI</div>
              </div>
            </div>
          )}

          {!loading && !result && !error && canScan && (
            <div className={styles.emptyState}>
              <div className={styles.emptyOrb}>◎</div>
              <div className={styles.emptyTitle}>Ready to Scan</div>
              <div className={styles.emptySubtitle}>Enter a symbol above and tap Scan to begin AI analysis</div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ MULTI-TF TAB ══════════ */}
      {activeTab === 'Multi-TF' && (
        <div className={styles.tabContent}>
          {!symbol.trim() ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyOrb}>◎</div>
              <div className={styles.emptyTitle}>Enter a Symbol First</div>
              <div className={styles.emptySubtitle}>Go to Scanner, enter a symbol, then come back here</div>
            </div>
          ) : htfLoading ? (
            <div className={styles.analyzingCard}>
              <div className={styles.analyzingOrb}><div className={styles.analyzingRing} /><div className={styles.analyzingCore}>◎</div></div>
              <div className={styles.analyzingTitle}>Multi-TF Scan</div>
              <div className={styles.analyzingSubtitle}>Scanning 15min · 1h · 4h · 1day simultaneously...</div>
            </div>
          ) : htfResults.length > 0 ? (
            <div className={styles.mtfGrid}>
              <div className={styles.mtfHeader}>{symbol.toUpperCase()} — Multi-Timeframe</div>
              {htfResults.map(r => (
                <div key={r.tf} className={styles.mtfCard}>
                  <div className={styles.mtfCardTop}>
                    <span className={styles.mtfTf}>{r.tf}</span>
                    <span style={{ color: getDirectionColor(r.direction), fontWeight: 800, fontSize: '0.85rem' }}>
                      {r.direction === 'BUY' ? '▲' : r.direction === 'SELL' ? '▼' : '◆'} {r.direction}
                    </span>
                    <span className={styles.mtfMl} style={{ color: getMlColor(r.mlScore ?? 50) }}>{r.mlScore}/100</span>
                  </div>
                  <div className={styles.mtfSetup}>{r.setupName}</div>
                  <div className={styles.mtfLevels}>
                    <span style={{ color: '#ff4444' }}>SL {r.stopLoss}</span>
                    <span style={{ color: '#00bcd4' }}>E {r.entryPrice}</span>
                    <span style={{ color: '#00e676' }}>T1 {r.takeProfit1}</span>
                  </div>
                  <div className={styles.mtfTrend} style={{ color: getTrendColor(r.htfTrend) }}>HTF: {r.htfTrend}</div>
                </div>
              ))}
              <button className={styles.scanBtn} style={{ marginTop: 12 }} onClick={runMultiTF}>↻ Refresh</button>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyOrb}>◎</div>
              <div className={styles.emptyTitle}>Multi-TF Ready</div>
              <div className={styles.emptySubtitle}>Scan {symbol} across all timeframes at once</div>
              <button className={styles.scanBtn} style={{ marginTop: 20 }} onClick={runMultiTF}>
                {plan !== 'premium' && scansLeft < 4 ? '🔒 Need 4 scans' : 'Run Multi-TF Scan'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════ WATCHLIST TAB ══════════ */}
      {activeTab === 'Watchlist' && (
        <div className={styles.tabContent}>
          <div className={styles.watchlistHeader}>
            <div className={styles.sectionCardLabel}>Your Watchlist</div>
            <button className={styles.scanBtn} onClick={scanWatchlist}
              disabled={scanning || watchlist.length === 0} style={{ padding: '6px 14px', fontSize: '0.78rem' }}>
              {scanning ? '⏳' : '▶ Scan All'}
            </button>
          </div>
          {watchlist.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyOrb}>◎</div>
              <div className={styles.emptyTitle}>No Pairs Watched</div>
              <div className={styles.emptySubtitle}>Scan a symbol and tap + Watch to add it for alerts</div>
            </div>
          ) : (
            <div className={styles.watchlistGrid}>
              {watchlist.map(w => (
                <div key={w.symbol} className={styles.watchCard}>
                  <div className={styles.watchCardTop}>
                    <span className={styles.watchSymbol}>{w.symbol}</span>
                    <span className={styles.watchTf}>{w.interval}</span>
                    <button className={styles.watchRemove} onClick={() => removeFromWatchlist(w.symbol)}>✕</button>
                  </div>
                  <button className={styles.watchScanBtn}
                    onClick={() => { setSymbol(w.symbol); setInterval(w.interval); setActiveTab('Scanner'); analyzeSymbol(w.symbol, w.interval) }}>
                    Scan Now →
                  </button>
                </div>
              ))}
            </div>
          )}
          {lastScan && <div className={styles.lastScan}>Last scan: {lastScan.toLocaleTimeString()}</div>}
        </div>
      )}

      {/* CHART SCANNER TAB */}
      {activeTab === 'Chart' && (
       <div className={styles.tabContent}>
         <ChartScanner plan={plan} />
       </div>
     )}

      {/* ══════════ LEARN TAB ══════════ */}
      {activeTab === 'Learn' && (
        <div className={styles.tabContent}>
          {[
            { title: 'HTF Trend Filter', icon: '📈', text: 'Only trade in the direction of the higher timeframe trend. If the 4H shows a downtrend, only take SELL signals on the 15min. This alone eliminates the majority of losing trades.' },
            { title: 'Mean Reversion Entry', icon: '🎯', text: 'Wait for price to pull back to the SMA 20 after a breakout. This gives you a low-risk entry at the mean with tight stop loss and high reward potential.' },
            { title: 'RSI Zone Filter', icon: '📊', text: 'For BUY signals RSI should be 30-50. For SELL signals RSI between 50-70. Avoid entries at extremes above 70 or below 30.' },
            { title: 'ATR-Based Risk', icon: '🛡️', text: 'Stop Loss at 1.5x ATR from entry. Take Profit at 2x, 3.5x and 5x ATR for 3 targets. This adapts to current market volatility automatically.' },
            { title: 'ML Score Guide', icon: '🤖', text: 'Above 70 = High probability. 50-70 = Moderate — use smaller size. Below 50 = Weak setup — wait for better conditions.' },
            { title: 'Candlestick Confirmation', icon: '🕯️', text: 'Always wait for candle pattern confirmation at your entry zone. A Bullish Engulfing or Pin Bar at SMA 20 support dramatically increases win probability.' },
          ].map(({ title, icon, text }) => (
            <div key={title} className={styles.learnCard}>
              <div className={styles.learnIcon}>{icon}</div>
              <div>
                <div className={styles.learnTitle}>{title}</div>
                <div className={styles.learnText}>{text}</div>
              </div>
            </div>
          ))}
          <div className={styles.learnUpgrade} onClick={() => setShowUpgrade(true)}>
            <div className={styles.learnUpgradeTitle}>Ready to trade smarter?</div>
            <div className={styles.learnUpgradeSub}>Upgrade for full access to all features</div>
            <div className={styles.learnUpgradeBtn}>View Plans →</div>
          </div>
        </div>
      )}

      <div className={styles.bottomNav}>
        <div className={styles.navDisclaimer}>Use this analysis to inform your own decisions</div>
      </div>
    </div>
  )
}