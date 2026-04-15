import { useState } from 'react'
import styles from './NewsTab.module.css'

const FILTER_OPTIONS = ['All', 'Critical', 'High', 'Trump', 'Fed', 'Gold', 'War']

function filterArticles(articles, filter) {
  if (filter === 'All') return articles
  const f = filter.toLowerCase()
  if (f === 'critical') return articles.filter(a => a.impact === 'critical')
  if (f === 'high')     return articles.filter(a => a.impact === 'high' || a.impact === 'critical')
  return articles.filter(a =>
    a.title?.toLowerCase().includes(f) ||
    a.matchedKeywords?.includes(f)
  )
}

export default function NewsTab({ articles, loading, lastFetched, onRefresh, notifications, onClearAll }) {
  const [filter, setFilter] = useState('All')

  const filtered = filterArticles(articles, filter)
  const criticalCount = articles.filter(a => a.impact === 'critical').length
  const highCount     = articles.filter(a => a.impact === 'high').length

  return (
    <div className={styles.newsTab}>

      {/* Header stats */}
      <div className={styles.newsStats}>
        <div className={styles.statPill} style={{ borderColor: 'rgba(255,23,68,0.4)', color: '#ff1744' }}>
          <span className={styles.statDot} style={{ background: '#ff1744' }} />
          {criticalCount} Critical
        </div>
        <div className={styles.statPill} style={{ borderColor: 'rgba(255,145,0,0.4)', color: '#ff9100' }}>
          <span className={styles.statDot} style={{ background: '#ff9100' }} />
          {highCount} High
        </div>
        <div className={styles.statPill} style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#666' }}>
          {articles.length} total
        </div>
        <button className={styles.refreshBtn} onClick={onRefresh} disabled={loading}>
          {loading ? '⏳' : '↻'}
        </button>
      </div>

      {lastFetched && (
        <div className={styles.lastUpdate}>
          Updated {lastFetched.toLocaleTimeString()} · auto-refreshes every 3 min
        </div>
      )}

      {/* Filter chips */}
      <div className={styles.filterRow}>
        {FILTER_OPTIONS.map(f => (
          <button
            key={f}
            className={`${styles.filterChip} ${filter === f ? styles.filterChipActive : ''}`}
            onClick={() => setFilter(f)}
          >{f}</button>
        ))}
      </div>

      {/* Notification bell summary */}
      {notifications.length > 0 && (
        <div className={styles.notifBanner}>
          <span className={styles.notifBell}>🔔</span>
          <span className={styles.notifText}>{notifications.length} new alert{notifications.length !== 1 ? 's' : ''} since last check</span>
          <button className={styles.notifClear} onClick={onClearAll}>Clear</button>
        </div>
      )}

      {/* Loading state */}
      {loading && articles.length === 0 && (
        <div className={styles.loadingState}>
          <div className={styles.loadingOrb}>◎</div>
          <div>Scanning market news feeds...</div>
        </div>
      )}

      {/* Article list */}
      {filtered.length === 0 && !loading && (
        <div className={styles.emptyState}>
          <div className={styles.emptyOrb}>◎</div>
          <div>No {filter !== 'All' ? filter : ''} news found</div>
        </div>
      )}

      <div className={styles.articleList}>
        {filtered.map((article, i) => (
          <a
            key={article.id || i}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.articleCard}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className={styles.articleLeft}>
              <div
                className={styles.impactBar}
                style={{ background: article.impactColor }}
                title={article.impact}
              />
            </div>

            <div className={styles.articleBody}>
              <div className={styles.articleMeta}>
                <span className={styles.articleSource}>{article.source?.name || 'News'}</span>
                <span className={styles.articleTime}>{article.timeAgo}</span>
                {article.impact !== 'low' && (
                  <span
                    className={styles.impactBadge}
                    style={{
                      color: article.impactColor,
                      borderColor: article.impactColor + '44',
                      background: article.impactColor + '11',
                    }}
                  >
                    {article.impact === 'critical' ? '⚡' : article.impact === 'high' ? '🔴' : '🟡'} {article.impact}
                  </span>
                )}
              </div>

              <div className={styles.articleTitle}>{article.title}</div>

              {article.description && (
                <div className={styles.articleDesc}>
                  {article.description.replace(/<[^>]+>/g, '').slice(0, 120)}…
                </div>
              )}

              {article.matchedKeywords?.length > 0 && (
                <div className={styles.keywordsRow}>
                  {article.matchedKeywords.slice(0, 5).map(kw => (
                    <span key={kw} className={styles.kwTag}>{kw}</span>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.articleArrow}>→</div>
          </a>
        ))}
      </div>

    </div>
  )
}
