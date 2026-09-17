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
