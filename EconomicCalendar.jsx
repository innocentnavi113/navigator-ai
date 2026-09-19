// src/components/EconomicCalendar.jsx
import { useState, useEffect } from 'react'
import styles from './EconomicCalendar.module.css'

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
}

function timeUntil(iso) {
  const diff = new Date(iso) - Date.now()
  if (diff < 0) return 'Released'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 24) return `in ${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0)  return `in ${h}h ${m}m`
  return `in ${m}m`
}

function getDirColor(dir) {
  if (!dir) return '#888'
  const d = dir.toUpperCase()
  if (d.includes('BUY') || d.includes('BULL'))    return '#00e676'
  if (d.includes('SELL') || d.includes('BEAR'))   return '#ff4444'
  if (d.includes('CAUTION') || d.includes('WATCH')) return '#ffd600'
  return '#00bcd4'
}

function getDirIcon(dir) {
  if (!dir) return '◆'
  const d = dir.toUpperCase()
  if (d.includes('BUY'))    return '▲'
  if (d.includes('SELL'))   return '▼'
  if (d.includes('CAUTION')) return '⚠'
  return '◆'
}

function getPreReleaseBias(title, forecast, previous) {
  const t = title.toLowerCase()
  const fv = parseFloat((forecast || '').replace(/[^0-9.\-]/g, ''))
  const pv = parseFloat((previous || '').replace(/[^0-9.\-]/g, ''))
  const hasBoth = !isNaN(fv) && !isNaN(pv)
  const isHigher = hasBoth && fv > pv
  const isLower  = hasBoth && fv < pv

  // ── Each event type has its own bias logic ──────────────────────────────
  // Returns: { signal, direction, currency, pair, reason, context[] }

  // BOJ — higher rate = JPY stronger = SELL USD/JPY
  if (t.includes('boj') || t.includes('bank of japan')) {
    const signal = isHigher ? 'SELL USD/JPY' : isLower ? 'BUY USD/JPY' : 'WAIT FOR RELEASE'
    const dir    = isHigher ? 'SELL' : isLower ? 'BUY' : 'WAIT'
    return {
      signal, dir,
      currency: 'JPY',
      pair: 'USD/JPY',
      reason: isHigher
        ? `Forecast ${forecast} > prev ${previous} → market expects BOJ rate hike → JPY strengthens → SELL USD/JPY`
        : isLower
        ? `Forecast ${forecast} < prev ${previous} → market expects hold/cut → JPY weakens → BUY USD/JPY`
        : 'No forecast available — wait for actual decision',
      context: [
        '📋 Higher rate = JPY gets stronger = USD/JPY goes DOWN',
        '📋 Hold/cut = JPY weakens = USD/JPY goes UP',
        '🗣 BOJ Gov Ueda: rate hikes depend on wage growth data',
        '📊 BOJ moves less often — surprise decisions cause big spikes',
        '⚠ Wait for candle close AFTER announcement before entering',
      ]
    }
  }

  // FOMC/Fed — higher rate = USD stronger = SELL Gold, SELL EUR/USD
  if (t.includes('fomc') || t.includes('fed interest') || t.includes('federal')) {
    const signal = isHigher ? 'SELL GOLD' : isLower ? 'BUY GOLD' : 'WAIT FOR RELEASE'
    const dir    = isHigher ? 'SELL' : isLower ? 'BUY' : 'WAIT'
    return {
      signal, dir,
      currency: 'USD',
      pair: 'XAU/USD',
      reason: isHigher
        ? `Forecast suggests hike → USD strengthens → Gold falls → SELL XAU/USD`
        : isLower
        ? `Forecast suggests cut/dovish → USD weakens → Gold rises → BUY XAU/USD`
        : 'Wait for Fed statement and dot plot before entering',
      context: [
        '📋 Rate hike = USD up = Gold DOWN = SELL XAU/USD',
        '📋 Rate cut = USD down = Gold UP = BUY XAU/USD',
        '📋 Hold with hawkish tone = SELL Gold. Hold with dovish = BUY Gold',
        '🗣 Powell tone at press conference matters as much as the rate',
        '⚠ Biggest volatility event — use small size, wide SL',
      ]
    }
  }

  // NFP — higher jobs = USD stronger = SELL Gold
  if (t.includes('non-farm') || t.includes('nfp') || t.includes('adp')) {
    const signal = isHigher ? 'SELL GOLD' : isLower ? 'BUY GOLD' : 'WAIT FOR RELEASE'
    const dir    = isHigher ? 'SELL' : isLower ? 'BUY' : 'WAIT'
    return {
      signal, dir,
      currency: 'USD',
      pair: 'XAU/USD',
      reason: isHigher
        ? `Forecast ${forecast} > prev ${previous} → strong jobs = USD strength → SELL Gold`
        : isLower
        ? `Forecast ${forecast} < prev ${previous} → weak jobs = USD weakness → BUY Gold`
        : 'Wait for actual NFP number',
      context: [
        '📋 Jobs beat forecast = USD up = Gold DOWN = SELL XAU/USD',
        '📋 Jobs miss forecast = USD down = Gold UP = BUY XAU/USD',
        '🗣 Fed uses NFP to decide rate path — huge market mover',
        '⚠ Do not trade 30 min before release — spreads widen',
        '⚠ Enter AFTER the number drops and a candle closes',
      ]
    }
  }

  // CPI — higher inflation = Fed stays hawkish = USD up = SELL Gold
  if (t.includes('cpi') || t.includes('ppi') || t.includes('inflation')) {
    const signal = isHigher ? 'SELL GOLD' : isLower ? 'BUY GOLD' : 'WAIT FOR RELEASE'
    const dir    = isHigher ? 'SELL' : isLower ? 'BUY' : 'WAIT'
    return {
      signal, dir,
      currency: 'USD',
      pair: 'XAU/USD',
      reason: isHigher
        ? `Forecast ${forecast} > prev ${previous} → hot inflation → Fed hawkish → USD up → SELL Gold`
        : isLower
        ? `Forecast ${forecast} < prev ${previous} → cooling inflation → Fed dovish → USD down → BUY Gold`
        : 'Wait for CPI actual reading',
      context: [
        '📋 Hot CPI = Fed keeps rates high = USD up = Gold DOWN',
        '📋 Cool CPI = Fed may cut = USD down = Gold UP',
        '🗣 Core CPI (excluding food & energy) matters most',
        '⚠ Enter after first 5-min candle closes post-release',
      ]
    }
  }

  // BOE — higher rate = GBP stronger = BUY GBP/USD
  if (t.includes('official bank rate') || t.includes('boe') || t.includes('bank of england')) {
    const signal = isHigher ? 'BUY GBP/USD' : isLower ? 'SELL GBP/USD' : 'WAIT FOR RELEASE'
    const dir    = isHigher ? 'BUY' : isLower ? 'SELL' : 'WAIT'
    return {
      signal, dir,
      currency: 'GBP',
      pair: 'GBP/USD',
      reason: isHigher
        ? `Forecast ${forecast} > prev ${previous} → BOE hike expected → GBP strengthens → BUY GBP/USD`
        : isLower
        ? `Forecast ${forecast} < prev ${previous} → BOE cut expected → GBP weakens → SELL GBP/USD`
        : 'Wait for BOE announcement',
      context: [
        '📋 Rate hike/hold = GBP up = BUY GBP/USD',
        '📋 Rate cut = GBP down = SELL GBP/USD',
        '🗣 BOE has been cutting gradually — a hold is a bullish surprise',
        '⚠ Wait for MPC vote breakdown before entering',
      ]
    }
  }

  // ECB — higher rate = EUR stronger = BUY EUR/USD
  if (t.includes('refinancing') || t.includes('ecb') || t.includes('european central')) {
    const signal = isHigher ? 'BUY EUR/USD' : isLower ? 'SELL EUR/USD' : 'WAIT FOR RELEASE'
    const dir    = isHigher ? 'BUY' : isLower ? 'SELL' : 'WAIT'
    return {
      signal, dir,
      currency: 'EUR',
      pair: 'EUR/USD',
      reason: isHigher
        ? `ECB hike/hold expected → EUR strengthens → BUY EUR/USD`
        : isLower
        ? `ECB cut expected → EUR weakens → SELL EUR/USD`
        : 'Wait for ECB decision',
      context: [
        '📋 Rate hike or hold = EUR up = BUY EUR/USD',
        '📋 Rate cut = EUR down = SELL EUR/USD',
        '🗣 Lagarde press conference tone often moves market more than the rate',
        '⚠ Trade after press conference starts for cleaner entry',
      ]
    }
  }

  // GDP
  if (t.includes('gdp')) {
    const signal = isHigher ? 'BUY BASE CURRENCY' : isLower ? 'SELL BASE CURRENCY' : 'WAIT FOR RELEASE'
    const dir    = isHigher ? 'BUY' : isLower ? 'SELL' : 'WAIT'
    return {
      signal, dir,
      currency: 'N/A',
      pair: 'N/A',
      reason: isHigher ? `GDP beat → economic strength → buy that country's currency`
                       : isLower  ? `GDP miss → economic weakness → sell that country's currency`
                       : 'Wait for GDP reading',
      context: [
        '📋 GDP above forecast = economy growing = BUY that currency',
        '📋 GDP below forecast = economy contracting = SELL that currency',
        '⚠ Wait for candle close after release',
      ]
    }
  }

  // Default
  return {
    signal: 'WAIT FOR RELEASE',
    dir: 'WAIT',
    currency: 'N/A',
    pair: 'N/A',
    reason: forecast ? `Market forecast: ${forecast} (prev: ${previous || 'N/A'})` : 'Wait for actual number',
    context: [
      '⚠ Wait for actual number before trading',
      '⚠ Enter after candle close confirmation',
    ]
  }
}

function parseFloat2(str) {
  if (!str) return NaN
  return parseFloat(str.replace(/[^0-9.\-]/g, ''))
}

function getScenarios(title, pairs) {
  const t = title.toLowerCase()
  if (t.includes('non-farm') || t.includes('nfp') || t.includes('adp'))
    return [
      { condition: 'Beat forecast',  direction: 'SELL GOLD',  pairs: ['XAU/USD'] },
      { condition: 'Miss forecast',  direction: 'BUY GOLD',   pairs: ['XAU/USD'] },
      { condition: 'Beat forecast',  direction: 'SELL EUR/USD', pairs: ['EUR/USD'] },
    ]
  if (t.includes('fomc') || t.includes('fed interest'))
    return [
      { condition: 'Hike / Hawkish', direction: 'SELL GOLD',    pairs: ['XAU/USD'] },
      { condition: 'Cut / Dovish',   direction: 'BUY GOLD',     pairs: ['XAU/USD'] },
      { condition: 'Hold neutral',   direction: 'WATCH price',   pairs: ['XAU/USD', 'EUR/USD'] },
    ]
  if (t.includes('cpi') || t.includes('ppi') || t.includes('inflation'))
    return [
      { condition: 'Hot (above forecast)', direction: 'SELL GOLD',  pairs: ['XAU/USD'] },
      { condition: 'Cool (below forecast)', direction: 'BUY GOLD',  pairs: ['XAU/USD'] },
    ]
  if (t.includes('official bank rate'))
    return [
      { condition: 'Hold or Hike', direction: 'BUY GBP/USD',  pairs: ['GBP/USD'] },
      { condition: 'Cut',          direction: 'SELL GBP/USD', pairs: ['GBP/USD'] },
    ]
  if (t.includes('boj'))
    return [
      { condition: 'Hike / Hawkish', direction: 'SELL USD/JPY', pairs: ['USD/JPY'] },
      { condition: 'Hold / Dovish',  direction: 'BUY USD/JPY',  pairs: ['USD/JPY'] },
    ]
  if (t.includes('refinancing') || t.includes('ecb'))
    return [
      { condition: 'Hold or Hike', direction: 'BUY EUR/USD',  pairs: ['EUR/USD'] },
      { condition: 'Cut',          direction: 'SELL EUR/USD', pairs: ['EUR/USD'] },
    ]
  if (t.includes('gdp'))
    return [
      { condition: 'Beat forecast', direction: 'BUY currency',  pairs: pairs.slice(0,1) },
      { condition: 'Miss forecast', direction: 'SELL currency', pairs: pairs.slice(0,1) },
    ]
  if (t.includes('unemployment') || t.includes('jobless'))
    return [
      { condition: 'Higher than expected', direction: 'BUY GOLD',   pairs: ['XAU/USD'] },
      { condition: 'Lower than expected',  direction: 'SELL GOLD',  pairs: ['XAU/USD'] },
    ]
  return [
    { condition: 'Beat forecast', direction: 'BUY',  pairs },
    { condition: 'Miss forecast', direction: 'SELL', pairs },
  ]
}

export default function EconomicCalendar({ onClose, onExecute }) {
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [selected, setSelected] = useState(null) // index of expanded event

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch('/api/economic-calendar')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load')
        setEvents(data.events || [])
        // Auto-select the "next" event
        const nextIdx = (data.events || []).findIndex(e => e.isNext)
        if (nextIdx !== -1) setSelected(nextIdx)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const sel = selected !== null ? events[selected] : null

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>📅</div>
            <div>
              <div className={styles.headerTitle}>Economic Calendar</div>
              <div className={styles.headerSub}>High-impact events this week</div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading && (
          <div className={styles.loadingWrap}>
            <div className={styles.loadingOrb}>◎</div>
            <div className={styles.loadingText}>Fetching live events...</div>
          </div>
        )}

        {error && !loading && (
          <div className={styles.errorBox}>⚠ {error}</div>
        )}

        {!loading && events.length > 0 && (
          <>
            {/* Event list */}
            <div className={styles.eventList}>
              {events.map((ev, i) => (
                <button
                  key={ev.id}
                  className={`${styles.eventRow} ${ev.isNext ? styles.eventNext : ''} ${ev.isPast ? styles.eventPast : ''} ${selected === i ? styles.eventSelected : ''}`}
                  onClick={() => setSelected(selected === i ? null : i)}
                >
                  <div className={styles.eventRowLeft}>
                    <div className={styles.eventCurrency}>{ev.currency}</div>
                    <div>
                      <div className={styles.eventTitle}>{ev.title}</div>
                      <div className={styles.eventTime}>
                        {ev.isNext && <span className={styles.nextBadge}>NEXT</span>}
                        {formatTime(ev.date)}
                        {!ev.isPast && <span className={styles.eventCountdown}> · {timeUntil(ev.date)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className={styles.eventRowRight}>
                    <div className={styles.eventDir} style={{ color: getDirColor(ev.direction) }}>
                      {getDirIcon(ev.direction)}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Signal detail panel */}
            {sel && (
              <div className={styles.signalPanel}>
                <div className={styles.signalPanelHeader}>
                  {sel.isNext && <div className={styles.nextEventLabel}>NEXT EVENT</div>}
                  <div className={styles.signalEventTitle}>{sel.title}</div>
                  <div className={styles.signalEventDate}>{formatDate(sel.date)}</div>
                  <div className={styles.signalEventTime}>
                    {formatTime(sel.date)}
                    {sel.date && <span className={styles.decisionNote}> · {formatDate(sel.date).split(',')[0]} decision</span>}
                  </div>
                </div>

                {/* Data row */}
                {(sel.forecast || sel.previous || sel.actual) && (
                  <div className={styles.dataRow}>
                    {sel.actual   && <div className={styles.dataCell}><div className={styles.dataLabel}>Actual</div><div className={styles.dataVal} style={{ color: '#00e676' }}>{sel.actual}</div></div>}
                    {sel.forecast && <div className={styles.dataCell}><div className={styles.dataLabel}>Forecast</div><div className={styles.dataVal}>{sel.forecast}</div></div>}
                    {sel.previous && <div className={styles.dataCell}><div className={styles.dataLabel}>Previous</div><div className={styles.dataVal} style={{ color: '#888' }}>{sel.previous}</div></div>}
                  </div>
                )}

                {/* Signal direction box */}
                <div className={styles.signalBox}>
                  <div className={styles.signalBoxHeader}>
                    <span className={styles.signalBoxLabel}>SIGNAL DIRECTION</span>
                  </div>

                  {sel.direction === 'WAIT' ? (
                    /* ── Pre-release panel ── */
                    <div className={styles.preRelease}>
                      <div className={styles.preReleaseTitle}>
                        ⏳ Waiting for <span style={{ color: '#ffd600' }}>{sel.title}</span>
                      </div>
                      <div className={styles.preReleaseTime}>
                        Releases {timeUntil(sel.date)} · {formatTime(sel.date)}
                      </div>

                      {(() => {
                        const bias = getPreReleaseBias(sel.title, sel.forecast, sel.previous)
                        const isWait = bias.dir === 'WAIT'
                        const sigColor = bias.dir === 'BUY' ? '#00e676' : bias.dir === 'SELL' ? '#ff4444' : '#ffd600'
                        return (
                          <>
                            {/* ONE clear pre-signal */}
                            <div className={styles.preSigBox} style={{ borderColor: sigColor + '55' }}>
                              <div className={styles.preSigLabel}>
                                {isWait ? 'PRE-RELEASE OUTLOOK' : 'EXPECTED SIGNAL (based on forecast)'}
                              </div>
                              <div className={styles.preSigDir} style={{ color: sigColor }}>
                                {isWait ? '⏳ WAIT FOR RELEASE' : (bias.dir === 'BUY' ? '▲ ' : '▼ ') + bias.signal}
                              </div>
                              {!isWait && bias.pair !== 'N/A' && (
                                <div className={styles.preSigPair}>Pair: <span style={{ color: '#00bcd4' }}>{bias.pair}</span></div>
                              )}
                              <div className={styles.preSigReason}>{bias.reason}</div>
                            </div>

                            {/* Step by step how to trade */}
                            {!isWait && (
                              <div className={styles.howToBox}>
                                <div className={styles.scenarioLabel}>HOW TO TRADE THIS</div>
                                <div className={styles.howToStep}><span className={styles.howToNum}>1</span><span>Wait for release at <strong>{formatTime(sel.date)}</strong></span></div>
                                <div className={styles.howToStep}><span className={styles.howToNum}>2</span><span>Check actual vs forecast — confirm <strong style={{ color: sigColor }}>{bias.signal}</strong></span></div>
                                <div className={styles.howToStep}><span className={styles.howToNum}>3</span><span>Wait for first <strong>15min candle to close</strong> after release</span></div>
                                <div className={styles.howToStep}><span className={styles.howToNum}>4</span><span>Enter with SL behind candle wick, TP at nearest structure</span></div>
                              </div>
                            )}

                            {/* Context */}
                            {bias.context.length > 0 && (
                              <>
                                <div className={styles.scenarioLabel} style={{ marginTop: 12 }}>MARKET CONTEXT</div>
                                <div className={styles.contextList}>
                                  {bias.context.map((c, i) => (
                                    <div key={i} className={styles.contextRow}>{c}</div>
                                  ))}
                                </div>
                              </>
                            )}
                          </>
                        )
                      })()}

                      <div className={styles.warnings} style={{ marginTop: 14 }}>
                        <div className={styles.warningRow}>⚠ Forecast-based bias — NOT a confirmed signal yet.</div>
                        <div className={styles.warningRow}>⏱ Only enter AFTER actual number + 15min candle close.</div>
                        <div className={styles.warningRow}>💰 Only risk what you can afford to lose.</div>
                      </div>
                      <div className={styles.responsibleText}>Trade responsibly. 🧠</div>
                    </div>
                  ) : (
                    /* ── Post-release: show actual signal ── */
                    <>
                      <div className={styles.signalAlert}>
                        <span>⚠</span> NEWS ALERT <span>⚠</span>
                      </div>
                      <div className={styles.signalEventName}>! {sel.title.toUpperCase()} !</div>

                      <div className={styles.signalPairs}>
                        {sel.pairs.map(p => (
                          <div key={p} className={styles.pairSignalRow}>
                            <span className={styles.pairSignalDot} />
                            <span className={styles.pairSignalName}>{p}</span>
                            <span className={styles.pairSignalDir} style={{ color: getDirColor(sel.direction) }}>
                              — {sel.direction}
                            </span>
                          </div>
                        ))}
                      </div>

                      {onExecute && (
                        <button
                          className={styles.executeBtn}
                          onClick={() => {
                            onExecute({ symbol: sel.pairs[0], direction: sel.direction, event: sel })
                            onClose()
                          }}
                        >
                          EXECUTE
                        </button>
                      )}

                      <div className={styles.warnings}>
                        <div className={styles.warningRow}>⚠ High-impact news can cause extreme volatility.</div>
                        <div className={styles.warningRow}>💰 Only use an amount you can afford to lose.</div>
                      </div>

                      <div className={styles.signalNote}>{sel.signal}</div>
                      <div className={styles.responsibleText}>Trade responsibly. 🧠</div>
                    </>
                  )}
                </div>

                {/* Affected pairs chips */}
                <div className={styles.affectedLabel}>Affected pairs</div>
                <div className={styles.affectedPairs}>
                  {sel.pairs.map(p => (
                    <div key={p} className={styles.pairChip}>{p}</div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && events.length === 0 && !error && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📅</div>
            <div className={styles.emptyTitle}>No high-impact events</div>
            <div className={styles.emptySub}>Check back closer to major news releases</div>
          </div>
        )}
      </div>
    </div>
  )
}
