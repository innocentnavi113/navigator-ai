// NewsPanel.jsx — drop this in src/components/NewsPanel.jsx
// Then import and use inside the settings panel in Dashboard.jsx

import styles from './NewsPanel.module.css'

export default function NewsPanel({ latestNews, lastNewsScan, newsAlerts, toggleNewsAlerts, scanNews }) {
  function timeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)  return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  function getImpactColor(article) {
    if (article.isTrump)      return '#ff6b35'
    if (article.score >= 20)  return '#ff4444'
    if (article.score >= 12)  return '#ffd600'
    return '#5a6370'
  }

  function getImpactLabel(article) {
    if (article.isTrump)      return '🚨 TRUMP'
    if (article.score >= 20)  return '⚡ HIGH'
    if (article.score >= 12)  return '⚠ MEDIUM'
    return '📰 NEWS'
  }

  return (
    <div className={styles.panel}>

      {/* Header row */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>📰 News Alerts</div>
          <div className={styles.sub}>
            {lastNewsScan ? `Last scan: ${timeAgo(lastNewsScan)}` : 'Not scanned yet'}
          </div>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.scanNowBtn} onClick={scanNews}>↻ Scan</button>
          <button
            className={`${styles.toggleBtn} ${newsAlerts ? styles.toggleBtnOn : ''}`}
            onClick={toggleNewsAlerts}
          >
            {newsAlerts ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* What triggers alerts */}
      <div className={styles.triggers}>
        <div className={styles.triggerChip} style={{ borderColor: '#ff6b35', color: '#ff6b35', background: 'rgba(255,107,53,0.08)' }}>
          🚨 Trump News
        </div>
        <div className={styles.triggerChip} style={{ borderColor: '#ff4444', color: '#ff4444', background: 'rgba(255,68,68,0.08)' }}>
          ⚡ Rate Decisions
        </div>
        <div className={styles.triggerChip} style={{ borderColor: '#ffd600', color: '#ffd600', background: 'rgba(255,214,0,0.08)' }}>
          ⚠ NFP / CPI
        </div>
        <div className={styles.triggerChip} style={{ borderColor: '#00bcd4', color: '#00bcd4', background: 'rgba(0,188,212,0.08)' }}>
          📊 Market Crash
        </div>
      </div>

      {/* Latest news feed */}
      {latestNews.length > 0 ? (
        <div className={styles.feed}>
          <div className={styles.feedLabel}>LATEST ALERTS</div>
          {latestNews.map((article, i) => (
            <a
              key={i}
              href={article.link}
              target="_blank"
              rel="noreferrer"
              className={styles.newsItem}
            >
              <div className={styles.newsLeft}>
                <div
                  className={styles.impactBadge}
                  style={{ color: getImpactColor(article), borderColor: getImpactColor(article) + '55' }}
                >
                  {getImpactLabel(article)}
                </div>
                <div className={styles.newsTitle}>{article.title}</div>
                <div className={styles.newsMeta}>
                  {article.source} · {timeAgo(article.pubDate)}
                  {article.matchedKeywords?.length > 0 && (
                    <span className={styles.keywords}> · {article.matchedKeywords.slice(0, 2).join(', ')}</span>
                  )}
                </div>
              </div>
              <div className={styles.newsArrow}>→</div>
            </a>
          ))}
        </div>
      ) : (
        <div className={styles.emptyFeed}>
          Tap ↻ Scan to load latest market news
        </div>
      )}
    </div>
  )
}
