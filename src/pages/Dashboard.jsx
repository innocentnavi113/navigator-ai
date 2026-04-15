import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useAlerts } from '../useAlerts'
import { useSubscription } from '../useSubscription'
import SubscriptionPage from './SubscriptionPage'
import styles from './Dashboard.module.css'
import { useNewsFeed } from '../hooks/useNewsFeed'

import NewsFeedNotifier from '../components/dashboard/NewsFeedNotifier'
import NewsTab from '../components/dashboard/NewsTab'
import ChartScanner from '../components/dashboard/ChartScanner'

const INTERVALS = ['1min', '5min', '15min', '30min', '1h', '2h', '4h', '1day']
const POPULAR = ['EUR/USD', 'GBP/USD', 'XAU/USD', 'USD/JPY', 'BTC/USD', 'ETH/USD', 'SPY']

const TABS = ['Scanner', 'Multi-TF', 'Watchlist', 'Chart', 'News', 'Learn']

export default function Dashboard({ session }) {
  const [activeTab, setActiveTab] = useState('Scanner')
  const [symbol, setSymbol] = useState('')
  const [interval, setInterval] = useState('1h')

  const scanTimer = useRef(null)

  const {
    alertsEnabled, permission, watchlist, minMlScore,
    scanning, lastScan, toggleAlerts, addToWatchlist,
    removeFromWatchlist, scanWatchlist, alertOnSignal, setMinMlScore
  } = useAlerts()

  const {
    plan, scansLeft, canScan, expiryDate, consumeScan
  } = useSubscription()

  // ✅ NEWS HOOK
  const {
    articles,
    loading: newsLoading,
    lastFetched,
    notifications,
    dismissNotification,
    clearAllNotifications,
    refresh: refreshNews,
  } = useNewsFeed({ enabled: true, minScore: 1 })

  const unreadNewsCount = notifications.length

  return (
    <div className={styles.app}>

      {/* ✅ NOTIFICATIONS */}
      <NewsFeedNotifier
        notifications={notifications}
        onDismiss={dismissNotification}
        onClearAll={clearAllNotifications}
      />

      {/* ── TABS ── */}
      <div className={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => {
              if (activeTab !== tab) {
                setActiveTab(tab)
              }
            }}
            style={{ position: 'relative' }}
          >
            {tab}

            {/* ✅ NEWS BADGE */}
            {tab === 'News' && unreadNewsCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 4,
                right: 4,
                background: '#ff1744',
                color: '#fff',
                fontSize: '0.6rem',
                fontWeight: 800,
                borderRadius: '50%',
                width: 16,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {unreadNewsCount > 9 ? '9+' : unreadNewsCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ───────── TABS CONTENT ───────── */}

      {activeTab === 'Scanner' && (
        <div className={styles.tabContent}>
          Scanner Content...
        </div>
      )}

      {activeTab === 'Multi-TF' && (
        <div className={styles.tabContent}>
          Multi-TF Content...
        </div>
      )}

      {activeTab === 'Watchlist' && (
        <div className={styles.tabContent}>
          Watchlist Content...
        </div>
      )}

      {activeTab === 'Chart' && (
        <div className={styles.tabContent}>
          <ChartScanner plan={plan} />
        </div>
      )}

      {/* ✅ NEWS TAB */}
      {activeTab === 'News' && (
        <div className={styles.tabContent}>
          <NewsTab
            articles={articles}
            loading={newsLoading}
            lastFetched={lastFetched}
            onRefresh={refreshNews}
            notifications={notifications}
            onClearAll={clearAllNotifications}
          />
        </div>
      )}

      {activeTab === 'Learn' && (
        <div className={styles.tabContent}>
          Learn Content...
        </div>
      )}

    </div>
  )
}