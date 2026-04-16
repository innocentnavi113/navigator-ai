// src/components/NewsPanel.jsx
import { useState } from 'react'
import styles from './NewsPanel.module.css'

const NEWS_TABS = ['All', 'Forex', 'BTC', 'Tweets', 'Trump']

export default function NewsPanel({
  latestNews = [],
  forexNews  = [],
  btcNews    = [],
  tweets     = [],
  trumpAlerts = [],
  lastNewsScan,
  newsAlerts,
  toggleNewsAlerts,
  scanNews,
}) {
  const [activeTab, setActiveTab] = useState('All')

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
    if (article.isTweet)     return '#1d9bf0'
    if (article.isForex)     return '#00bcd4'
    if (article.isBTC)       return '#f7931a'
    if (article.score >= 20) return '#ff4444'
    if (article.score >= 12) return '#ffd600'
    return '#5a6370'
  }

  function getImpactLabel(article) {
    if (article.isTrump)     return '🚨 TRUMP'
    if (article.isTweet)     return `🐦 ${article.source}`
    if (article.isForex && article.score >= 15) return '💱 FOREX'
    if (article.isBTC   && article.score >= 15) return '₿ BTC'
    if (article.score >= 20) return '⚡ HIGH'
    if (article.score >= 12) return '⚠ MEDIUM'
    return '📰 NEWS'
  }

  function getTabCount(tab) {
    if (tab === 'All')   return latestNews.length
    if (tab === 'Forex') return forexNews.length
    if (tab === 'BTC')   return btcNews.length
    if (tab === 'Tweets')return tweets.length
    if (tab === 'Trump') return trumpAlerts.length
    return 0
  }

  function getActiveArticles() {
    if (activeTab === 'Forex')  return forexNews
    if (activeTab === 'BTC')    return btcNews
    if (activeTab === 'Tweets') return tweets
    if (activeTab === 'Trump')  return trumpAlerts
    return latestNews
  }

  const articles = getActiveArticles()

  return (
    <div className={styles.panel}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>📰 News & Tweets</div>
          <div className={styles.sub}>
            {lastNewsScan ? `Last: ${timeAgo(lastNewsScan)}` : 'Not scanned'}
            {latestNews.length > 0 && ` · ${latestNews.length} total`}
          </div>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.scanNowBtn} onClick={scanNews}>↻</button>
          <button
            className={`${styles.toggleBtn} ${newsAlerts ? styles.toggleBtnOn : ''}`}
            onClick={toggleNewsAlerts}
          >{newsAlerts ? 'ON' : 'OFF'}</button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {NEWS_TABS.map(tab => (
          <button
            key={tab}
            className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(tab)}
            style={activeTab === tab ? {
              borderColor: tab === 'Trump' ? '#ff6b35' :
                           tab === 'Tweets' ? '#1d9bf0' :
                           tab === 'Forex' ? '#00bcd4' :
                           tab === 'BTC' ? '#f7931a' : '#00e676',
              color: tab === 'Trump' ? '#ff6b35' :
                     tab === 'Tweets' ? '#1d9bf0' :
                     tab === 'Forex' ? '#00bcd4' :
                     tab === 'BTC' ? '#f7931a' : '#00e676',
            } : {}}
          >
            {tab === 'Trump'  ? '🚨' :
             tab === 'Tweets' ? '🐦' :
             tab === 'Forex'  ? '💱' :
             tab === 'BTC'    ? '₿' : '📰'} {tab}
            {getTabCount(tab) > 0 && (
              <span className={styles.tabCount}>{getTabCount(tab)}</span>
            )}
          </button>
        ))}
      </div>

      {/* Feed */}
      {articles.length > 0 ? (
        <div className={styles.feed}>
          {articles.map((article, i) => (
            <a
              key={i}
              href={article.link || '#'}
              target="_blank"
              rel="noreferrer"
              className={`${styles.newsItem} ${article.isTweet ? styles.tweetItem : ''}`}
              style={{ borderLeftColor: getImpactColor(article) }}
            >
              <div className={styles.newsLeft}>
                <div className={styles.newsTopRow}>
                  <span
                    className={styles.impactBadge}
                    style={{
                      color: getImpactColor(article),
                      borderColor: getImpactColor(article) + '55',
                      background: getImpactColor(article) + '15',
                    }}
                  >
                    {getImpactLabel(article)}
                  </span>
                  <span className={styles.newsSource}>
                    {article.isTweet ? article.tweetUser || article.source : article.source}
                  </span>
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
          <div className={styles.emptyIcon}>
            {activeTab === 'Tweets' ? '🐦' :
             activeTab === 'Forex'  ? '💱' :
             activeTab === 'BTC'    ? '₿'  : '📡'}
          </div>
          <div className={styles.emptyText}>
            {activeTab === 'Tweets'
              ? 'No tweets yet — tap ↻ to scan trader accounts'
              : activeTab === 'Forex'
              ? 'No forex news yet — tap ↻ to scan'
              : activeTab === 'BTC'
              ? 'No BTC news yet — tap ↻ to scan'
              : activeTab === 'Trump'
              ? 'No Trump news right now'
              : 'Tap ↻ to load latest market news'}
          </div>
          <div className={styles.emptyHint}>
            {activeTab === 'Tweets'
              ? 'Monitors: Kathy Lien · Peter Brandt · Saylor · Pompliano'
              : 'CoinDesk · CoinTelegraph · ForexLive · FXStreet · Reddit'}
          </div>
        </div>
      )}
    </div>
  )
}
