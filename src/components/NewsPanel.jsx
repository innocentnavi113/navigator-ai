// src/components/NewsPanel.jsx
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
    if (article.isTrump)     return '#ff6b35'
    if (article.score >= 20) return '#ff4444'
    if (article.score >= 12) return '#ffd600'
    return '#5a6370'
  }

  function getImpactLabel(article) {
    if (article.isTrump)     return '🚨 TRUMP'
    if (article.score >= 20) return '⚡ HIGH'
    if (article.score >= 12) return '⚠ MEDIUM'
    return '📰 NEWS'
  }

  return (
    <div className={styles.panel}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>📰 News Alerts</div>
          <div className={styles.sub}>
            {lastNewsScan ? `Last scan: ${timeAgo(lastNewsScan)}` : 'Not scanned yet'}
            {latestNews.length > 0 && ` · ${latestNews.length} articles`}
          </div>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.scanNowBtn} onClick={scanNews}>↻ Scan</button>
          <button
            className={`${styles.toggleBtn} ${newsAlerts ? styles.toggleBtnOn : ''}`}
            onClick={toggleNewsAlerts}
          >{newsAlerts ? 'ON' : 'OFF'}</button>
        </div>
      </div>

      {/* Trigger chips */}
      <div className={styles.triggers}>
        <div className={styles.triggerChip} style={{ borderColor: '#ff6b35', color: '#ff6b35', background: 'rgba(255,107,53,0.08)' }}>🚨 Trump</div>
        <div className={styles.triggerChip} style={{ borderColor: '#ff4444', color: '#ff4444', background: 'rgba(255,68,68,0.08)' }}>⚡ Rates</div>
        <div className={styles.triggerChip} style={{ borderColor: '#ffd600', color: '#ffd600', background: 'rgba(255,214,0,0.08)' }}>⚠ NFP/CPI</div>
        <div className={styles.triggerChip} style={{ borderColor: '#00bcd4', color: '#00bcd4', background: 'rgba(0,188,212,0.08)' }}>📊 Volatility</div>
      </div>

      {/* News feed */}
      {latestNews.length > 0 ? (
        <div className={styles.feed}>
          <div className={styles.feedLabel}>LATEST — {latestNews.length} ARTICLES</div>
          {latestNews.map((article, i) => (
            <a
              key={i}
              href={article.link || '#'}
              target="_blank"
              rel="noreferrer"
              className={styles.newsItem}
              style={{ borderLeftColor: getImpactColor(article) }}
            >
              <div className={styles.newsLeft}>
                <div className={styles.newsTopRow}>
                  <span className={styles.impactBadge} style={{ color: getImpactColor(article), borderColor: getImpactColor(article) + '55' }}>
                    {getImpactLabel(article)}
                  </span>
                  <span className={styles.newsSource}>{article.source}</span>
                  <span className={styles.newsAge}>{timeAgo(article.pubDate)}</span>
                </div>
                <div className={styles.newsTitle}>{article.title}</div>
                {article.matchedKeywords?.length > 0 && (
                  <div className={styles.newsKeywords}>
                    {article.matchedKeywords.slice(0, 3).map(k => (
                      <span key={k} className={styles.kw}>{k}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.newsArrow}>→</div>
            </a>
          ))}
        </div>
      ) : (
        <div className={styles.emptyFeed}>
          <div className={styles.emptyIcon}>📡</div>
          <div className={styles.emptyText}>Tap ↻ Scan to load latest market news</div>
          <div className={styles.emptyHint}>Reuters · MarketWatch · BBC · Yahoo Finance</div>
        </div>
      )}
    </div>
  )
}
