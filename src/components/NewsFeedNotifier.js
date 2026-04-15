import { useEffect, useState } from 'react'
import styles from './NewsFeedNotifier.module.css'

export default function NewsFeedNotifier({ notifications, onDismiss, onClearAll }) {
  const [visible, setVisible] = useState([])

  useEffect(() => {
    if (notifications.length === 0) return
    // Show only the latest unshown notification as a toast
    const latest = notifications[0]
    setVisible(prev => {
      if (prev.find(n => n.id === latest.id)) return prev
      return [latest, ...prev].slice(0, 3)
    })

    // Auto-dismiss after 8s (critical stays longer)
    const delay = latest.impact === 'critical' ? 12000 : 8000
    const timer = setTimeout(() => {
      setVisible(prev => prev.filter(n => n.id !== latest.id))
      onDismiss(latest.id)
    }, delay)

    return () => clearTimeout(timer)
  }, [notifications])

  if (visible.length === 0) return null

  return (
    <div className={styles.toastContainer}>
      {visible.map((n, i) => (
        <div
          key={n.id}
          className={`${styles.toast} ${styles[`toast_${n.impact}`]}`}
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className={styles.toastLeft}>
            <div className={styles.toastImpactBadge} style={{ background: n.impactColor }}>
              {n.impact === 'critical' ? '⚡ CRITICAL' :
               n.impact === 'high'     ? '🔴 HIGH' :
               n.impact === 'medium'   ? '🟡 MEDIUM' : 'NEWS'}
            </div>
            <div className={styles.toastSource}>{n.source?.name || 'Market News'}</div>
          </div>

          <div className={styles.toastBody}>
            <div className={styles.toastTitle}>{n.title}</div>
            {n.matchedKeywords?.length > 0 && (
              <div className={styles.toastKeywords}>
                {n.matchedKeywords.slice(0, 4).map(kw => (
                  <span key={kw} className={styles.toastKw}>{kw}</span>
                ))}
              </div>
            )}
          </div>

          <button
            className={styles.toastClose}
            onClick={() => {
              setVisible(prev => prev.filter(v => v.id !== n.id))
              onDismiss(n.id)
            }}
          >✕</button>
        </div>
      ))}
    </div>
  )
}
