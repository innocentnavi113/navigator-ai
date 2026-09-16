import { useState, useEffect, useMemo } from 'react'
import styles from './EventIntelligence.module.css'

// Historical market reaction patterns for each event type
const REACTION_PATTERNS = {
  'NFP': {
    beat: 'USD strengthens, Gold falls, Indices may rise',
    miss: 'USD weakens, Gold rises, Indices may fall',
    inLine: 'Muted reaction, existing trend continues',
    volatility: 'Extreme — 60-120 pips in first 60 seconds',
    note: 'Non-Farm Payrolls measures US job creation. Watch for revisions to prior months.',
  },
  'CPI': {
    beat: 'USD strengthens (hot inflation), Fed stays hawkish, Gold falls',
    miss: 'USD weakens (cool inflation), Fed may cut, Gold rises',
    inLine: 'Focus shifts to Fed commentary',
    volatility: 'Extreme — 80-150 pips on USD pairs',
    note: 'Consumer Price Index is the Fed\'s key inflation gauge. Core CPI (ex food/energy) matters most.',
  },
  'PPI': {
    beat: 'USD strengthens mildly, preview of CPI pressure',
    miss: 'USD weakens mildly',
    inLine: 'Low reaction',
    volatility: 'Moderate — 30-60 pips',
    note: 'Producer Price Index is a leading indicator of consumer inflation.',
  },
  'FOMC': {
    cut: 'USD weakens, Gold rises, Indices rise',
    hike: 'USD strengthens, Gold falls, Indices fall',
    hold: 'Reaction depends on statement tone (hawkish = USD up)',
    volatility: 'Extreme — 100-200+ pips, sometimes 2 waves',
    note: 'Federal Open Market Committee sets US interest rates. Press conference 30 min after decision.',
  },
}

// Countdown formatter
function formatCountdown(isoDate) {
  const diff = new Date(isoDate).getTime() - Date.now()
  if (diff <= 0) return { text: 'RELEASED', urgent: false, past: true }
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return { text: `${days}d ${hours}h`, urgent: false }
  if (hours > 0) return { text: `${hours}h ${mins}m`, urgent: hours < 4 }
  return { text: `${mins}m`, urgent: true }
}

function getEventKey(eventName) {
  const n = eventName || ''
  if (n.includes('NFP') || n.includes('Non-Farm')) return 'NFP'
  if (n.includes('CPI') || n.includes('Consumer')) return 'CPI'
  if (n.includes('PPI') || n.includes('Producer')) return 'PPI'
  if (n.includes('FOMC') || n.includes('Federal')) return 'FOMC'
  return null
}

function getImpactColor(impact) {
  if (impact === 'high') return '#ff2a2a'
  if (impact === 'medium') return '#ffaa00'
  return '#00ff88'
}

export default function EventIntelligence() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    loadEvents()
    const interval = setInterval(loadEvents, 5 * 60 * 1000) // refresh every 5 min
    return () => clearInterval(interval)
  }, [])

  async function loadEvents() {
    try {
      setLoading(true)
      const res = await fetch('/api/calendar?days=30')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setEvents(data.events || [])
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return events
    return events.filter(e => {
      const key = getEventKey(e.event)
      if (filter === 'nfp') return key === 'NFP'
      if (filter === 'cpi') return key === 'CPI'
      if (filter === 'ppi') return key === 'PPI'
      if (filter === 'fomc') return key === 'FOMC'
      return true
    })
  }, [events, filter])

  const upcoming = filtered.filter(e => !e.isReleased)
  const released = filtered.filter(e => e.isReleased)

  return (
    <div className={styles.wrap}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>PRE-EVENT INTELLIGENCE</div>
          <div className={styles.title}>Economic Calendar</div>
          <div className={styles.sub}>
            Know what the market expects. Plan for both outcomes.
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={loadEvents} disabled={loading}>
          {loading ? '⏳' : '↻'}
        </button>
      </div>

      {/* Filter tabs */}
      <div className={styles.filters}>
        {[
          { id: 'all',  label: 'ALL',  count: events.length },
          { id: 'nfp',  label: 'NFP',  count: events.filter(e => getEventKey(e.event) === 'NFP').length },
          { id: 'cpi',  label: 'CPI',  count: events.filter(e => getEventKey(e.event) === 'CPI').length },
          { id: 'ppi',  label: 'PPI',  count: events.filter(e => getEventKey(e.event) === 'PPI').length },
          { id: 'fomc', label: 'FOMC', count: events.filter(e => getEventKey(e.event) === 'FOMC').length },
        ].map(f => (
          <button
            key={f.id}
            className={`${styles.filterBtn} ${filter === f.id ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label} {f.count > 0 && <span className={styles.filterCount}>{f.count}</span>}
          </button>
        ))}
      </div>

      {error && <div className={styles.errorBox}>⚠ {error}</div>}

      {loading && events.length === 0 && (
        <div className={styles.loadingBox}>
          <div className={styles.spinner} />
          <div>Loading economic events...</div>
        </div>
      )}

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>UPCOMING ({upcoming.length})</div>
          {upcoming.map(event => {
            const key = getEventKey(event.event)
            const countdown = formatCountdown(event.date)
            const pattern = REACTION_PATTERNS[key]
            return (
              <div
                key={event.id}
                className={`${styles.eventCard} ${countdown.urgent ? styles.eventUrgent : ''}`}
                onClick={() => setSelected(event)}
              >
                <div className={styles.eventLeft}>
                  <div
                    className={styles.impactDot}
                    style={{ background: getImpactColor(event.impact) }}
                  />
                  <div>
                    <div className={styles.eventName}>{event.event}</div>
                    <div className={styles.eventMeta}>
                      {new Date(event.date).toLocaleDateString('en-ZA', {
                        weekday: 'short', day: 'numeric', month: 'short',
                      })} · {new Date(event.date).toLocaleTimeString('en-ZA', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
                <div className={styles.eventRight}>
                  <div className={styles.countdown} style={{ color: countdown.urgent ? '#ff2a2a' : '#888' }}>
                    {countdown.text}
                  </div>
                  {event.estimate != null && (
                    <div className={styles.estimate}>
                      Fcast: <strong>{event.estimate}{event.unit}</strong>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Released events */}
      {released.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>RELEASED ({released.length})</div>
          {released.slice(-10).reverse().map(event => (
            <div key={event.id} className={styles.eventCardReleased}>
              <div className={styles.eventLeft}>
                <div className={styles.impactDot} style={{ background: '#444' }} />
                <div>
                  <div className={styles.eventName}>{event.event}</div>
                  <div className={styles.eventMeta}>
                    {new Date(event.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              </div>
              <div className={styles.eventRight}>
                <div className={styles.releasedValues}>
                  <span>Prev: <strong>{event.previous ?? '—'}</strong></span>
                  <span>Fcast: <strong>{event.estimate ?? '—'}</strong></span>
                  <span className={styles.actualValue}>Act: <strong>{event.actual ?? '—'}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className={styles.detailOverlay} onClick={() => setSelected(null)}>
          <div className={styles.detailPanel} onClick={e => e.stopPropagation()}>
            <div className={styles.detailHeader}>
              <div className={styles.detailTitle}>{selected.event}</div>
              <button className={styles.detailClose} onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className={styles.detailRow}>
              <span>Date</span>
              <strong>{new Date(selected.date).toLocaleString('en-ZA')}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Impact</span>
              <strong style={{ color: getImpactColor(selected.impact) }}>
                {selected.impact.toUpperCase()}
              </strong>
            </div>

            <div className={styles.detailValues}>
              <div className={styles.valueBox}>
                <div className={styles.valueLabel}>Previous</div>
                <div className={styles.valueNum}>{selected.previous ?? '—'}{selected.unit}</div>
              </div>
              <div className={styles.valueBox}>
                <div className={styles.valueLabel}>Consensus</div>
                <div className={styles.valueNum}>{selected.estimate ?? '—'}{selected.unit}</div>
              </div>
              <div className={`${styles.valueBox} ${selected.isReleased ? styles.valueBoxActual : ''}`}>
                <div className={styles.valueLabel}>{selected.isReleased ? 'Actual' : 'Forecast'}</div>
                <div className={styles.valueNum}>{selected.actual ?? selected.estimate ?? '—'}{selected.unit}</div>
              </div>
            </div>

            {(() => {
              const key = getEventKey(selected.event)
              const pattern = REACTION_PATTERNS[key]
              if (!pattern) return null
              return (
                <>
                  <div className={styles.patternSection}>
                    <div className={styles.patternLabel}>IF ACTUAL &gt; CONSENSUS (Beat)</div>
                    <div className={styles.patternText}>{pattern.beat}</div>
                  </div>
                  <div className={styles.patternSection}>
                    <div className={styles.patternLabel}>IF ACTUAL &lt; CONSENSUS (Miss)</div>
                    <div className={styles.patternText}>{pattern.miss}</div>
                  </div>
                  <div className={styles.patternSection}>
                    <div className={styles.patternLabel}>IF IN-LINE</div>
                    <div className={styles.patternText}>{pattern.inLine}</div>
                  </div>
                  <div className={styles.patternSection}>
                    <div className={styles.patternLabel}>VOLATILITY</div>
                    <div className={styles.patternText}>{pattern.volatility}</div>
                  </div>
                  <div className={styles.noteBox}>💡 {pattern.note}</div>
                </>
              )
            })()}

            <div className={styles.checklist}>
              <div className={styles.checklistLabel}>PRE-EVENT CHECKLIST</div>
              <div className={styles.checkItem}>✓ Mark key S/R levels 1h before</div>
              <div className={styles.checkItem}>✓ Know consensus — deviation is what moves price</div>
              <div className={styles.checkItem}>✓ Plan both directions</div>
              <div className={styles.checkItem}>✓ Cut position size (spreads widen 3-5x)</div>
              <div className={styles.checkItem}>✓ Wait for initial spike to exhaust</div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
