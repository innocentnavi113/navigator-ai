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

  // Forecast vs previous tells us market consensus direction
  let consensusDir = null
  let consensusText = ''
  if (hasBoth) {
    if (t.includes('unemployment') || t.includes('jobless') || t.includes('claimant')) {
      // For unemployment: lower = better
      if (fv < pv) { consensusDir = 'BULLISH'; consensusText = `Market expects improvement (${forecast} vs prev ${previous})` }
      else if (fv > pv) { consensusDir = 'BEARISH'; consensusText = `Market expects deterioration (${forecast} vs prev ${previous})` }
      else consensusText = `No change expected (${forecast})` 
    } else {
      // For most events: higher = better
      if (fv > pv) { consensusDir = 'BULLISH'; consensusText = `Market expects improvement (${forecast} vs prev ${previous})` }
      else if (fv < pv) { consensusDir = 'BEARISH'; consensusText = `Market expects weaker reading (${forecast} vs prev ${previous})` }
      else consensusText = `No change expected (${forecast})`
    }
  } else if (forecast) {
    consensusText = `Market forecast: ${forecast}`
  }

  // Event-specific known context (Fed statements, dot plots, speeches etc.)
  let context = []

  if (t.includes('fomc') || t.includes('fed interest')) {
    context = [
      '📋 Fed dot plot signals rates on hold through 2026',
      '🗣 Powell recently said "no rush to cut" at Jackson Hole',
      '📊 CME FedWatch: 85% chance of hold, 15% cut',
      '⚠ Watch for changes in the dot plot — hawkish = SELL Gold',
    ]
  } else if (t.includes('non-farm') || t.includes('nfp')) {
    context = [
      `📋 Forecast: ${forecast || 'N/A'} jobs (prev: ${previous || 'N/A'})`,
      '📊 ADP this week will give early clue on direction',
      '🗣 Fed watching labor market — weak NFP = rate cut bets rise',
      '⚠ Beat = SELL Gold immediately. Miss = BUY Gold.',
    ]
  } else if (t.includes('cpi') || t.includes('inflation')) {
    context = [
      `📋 Forecast: ${forecast || 'N/A'} (prev: ${previous || 'N/A'})`,
      '🗣 Fed targets 2% inflation — above = hawkish, below = dovish',
      '📊 Core CPI matters most — watch that number',
      '⚠ Hot CPI = SELL Gold. Cool CPI = BUY Gold.',
    ]
  } else if (t.includes('official bank rate')) {
    context = [
      `📋 Forecast: ${forecast || 'N/A'} (prev: ${previous || 'N/A'})`,
      '🗣 BOE has signaled gradual cuts through 2026',
      '📊 Market pricing 2 more cuts this year',
      '⚠ A cut is expected — surprise hold = strong GBP BUY',
    ]
  } else if (t.includes('boj')) {
    context = [
      `📋 Forecast: ${forecast || 'N/A'} (prev: ${previous || 'N/A'})`,
      '🗣 BOJ Governor Ueda signaled possible hike if wages rise',
      '📊 Markets pricing 60% chance of hike by year end',
      '⚠ Surprise hike = strong SELL USD/JPY opportunity',
    ]
  } else if (t.includes('refinancing') || t.includes('ecb')) {
    context = [
      `📋 Forecast: ${forecast || 'N/A'} (prev: ${previous || 'N/A'})`,
      '🗣 ECB Lagarde indicated data-dependent approach',
      '📊 Markets expect 1-2 more cuts in 2026',
      '⚠ Surprise hold = EUR/USD BUY. Cut = EUR/USD SELL',
    ]
  } else if (t.includes('gdp')) {
    context = [
      `📋 Forecast: ${forecast || 'N/A'} (prev: ${previous || 'N/A'})`,
      '📊 Strong GDP = central bank stays hawkish',
      '⚠ Beat = BUY that currency. Miss = SELL.',
    ]
  } else if (forecast || previous) {
    context = [
      `📋 Forecast: ${forecast || 'N/A'} (prev: ${previous || 'N/A'})`,
      '⚠ Wait for actual number before trading.',
    ]
  }

  return { consensusDir, consensusText, context }
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

                      {/* Market consensus from forecast vs previous */}
                      {(() => {
                        const bias = getPreReleaseBias(sel.title, sel.forecast, sel.previous)
                        return (
                          <>
                            {bias.consensusText && (
                              <div className={styles.consensusBox} style={{
                                borderColor: bias.consensusDir === 'BULLISH' ? 'rgba(0,230,118,0.3)' : bias.consensusDir === 'BEARISH' ? 'rgba(255,68,68,0.3)' : 'rgba(255,255,255,0.1)'
                              }}>
                                <div className={styles.consensusLabel}>MARKET CONSENSUS</div>
                                <div className={styles.consensusDir} style={{
                                  color: bias.consensusDir === 'BULLISH' ? '#00e676' : bias.consensusDir === 'BEARISH' ? '#ff4444' : '#ffd600'
                                }}>
                                  {bias.consensusDir === 'BULLISH' ? '▲ BULLISH BIAS' : bias.consensusDir === 'BEARISH' ? '▼ BEARISH BIAS' : '◆ NEUTRAL'}
                                </div>
                                <div className={styles.consensusText}>{bias.consensusText}</div>
                              </div>
                            )}

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

                      <div className={styles.scenarioLabel} style={{ marginTop: 14 }}>POSSIBLE OUTCOMES</div>
                      <div className={styles.scenarios}>
                        {getScenarios(sel.title, sel.pairs).map((s, i) => (
                          <div key={i} className={styles.scenarioRow}>
                            <div className={styles.scenarioIf}>{s.condition}</div>
                            <div className={styles.scenarioThen} style={{ color: getDirColor(s.direction) }}>
                              → {s.direction}
                            </div>
                            <div className={styles.scenarioPairs}>{s.pairs.join(' · ')}</div>
                          </div>
                        ))}
                      </div>

                      <div className={styles.warnings} style={{ marginTop: 12 }}>
                        <div className={styles.warningRow}>⚠ Do NOT trade before the release.</div>
                        <div className={styles.warningRow}>⏱ Wait for actual number + candle close.</div>
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
