import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import styles from './AdminPage.module.css'

// Your admin email — change this to your email
const ADMIN_EMAIL = 'majolainnocent11@gmail.com'

const PLAN_COLORS = {
  free:     '#5a6370',
  standard: '#00bcd4',
  premium:  '#00e676',
}

export default function AdminPage({ onBack, session }) {
  const [subscriptions, setSubscriptions] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [updating,      setUpdating]      = useState(null)
  const [stats,         setStats]         = useState({ total: 0, free: 0, standard: 0, premium: 0, revenue: 0 })
  const [toast,         setToast]         = useState('')

  const isAdmin = session?.user?.email === ADMIN_EMAIL

  useEffect(() => { if (isAdmin) loadSubscriptions() }, [isAdmin])

  async function loadSubscriptions() {
    setLoading(true)
    try {
      // Use service role via edge function or direct query
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setSubscriptions(data || [])

      // Compute stats
      const s = { total: 0, free: 0, standard: 0, premium: 0, revenue: 0 }
      ;(data || []).forEach(sub => {
        s.total++
        s[sub.plan] = (s[sub.plan] || 0) + 1
        if (sub.plan === 'standard') s.revenue += 25
        if (sub.plan === 'premium')  s.revenue += 100
      })
      setStats(s)
    } catch (e) {
      showToast('Error loading: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function activatePlan(userId, plan) {
    setUpdating(userId)
    try {
      let update = {}
      const now = new Date().toISOString()

      if (plan === 'standard') {
        update = {
          plan: 'standard',
          scans_total: 20,
          scans_used: 0,
          expires_at: null,
          activated_at: now,
          updated_at: now,
        }
      } else if (plan === 'premium') {
        const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        update = {
          plan: 'premium',
          scans_total: 99999,
          scans_used: 0,
          expires_at: exp,
          activated_at: now,
          updated_at: now,
        }
      } else if (plan === 'free') {
        update = {
          plan: 'free',
          scans_total: 3,
          scans_used: 0,
          expires_at: null,
          activated_at: now,
          updated_at: now,
        }
      }

      const { error } = await supabase
        .from('subscriptions')
        .update(update)
        .eq('user_id', userId)

      if (error) throw error

      showToast(`✓ ${plan.toUpperCase()} activated!`)
      await loadSubscriptions()
    } catch (e) {
      showToast('Error: ' + e.message)
    } finally {
      setUpdating(null)
    }
  }

  async function addScans(userId, amount) {
    setUpdating(userId)
    try {
      const sub = subscriptions.find(s => s.user_id === userId)
      if (!sub) return

      const { error } = await supabase
        .from('subscriptions')
        .update({
          scans_total: sub.scans_total + amount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) throw error
      showToast(`✓ Added ${amount} scans`)
      await loadSubscriptions()
    } catch (e) {
      showToast('Error: ' + e.message)
    } finally {
      setUpdating(null)
    }
  }

  async function saveNotes(userId, notes) {
    try {
      await supabase
        .from('subscriptions')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
      showToast('✓ Notes saved')
    } catch (e) {}
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const filtered = subscriptions.filter(s =>
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.plan?.includes(search.toLowerCase()) ||
    s.paystack_ref?.includes(search)
  )

  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={onBack}>← Back</button>
          <div className={styles.headerTitle}>Admin</div>
        </div>
        <div className={styles.unauthorized}>
          <div className={styles.unauthorizedIcon}>🔒</div>
          <div className={styles.unauthorizedTitle}>Access Denied</div>
          <div className={styles.unauthorizedText}>This page is only accessible to administrators.</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>

      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <div className={styles.headerTitle}>
          ◎ Admin Panel
        </div>
        <button className={styles.refreshBtn} onClick={loadSubscriptions}>↻</button>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.total}</div>
          <div className={styles.statLabel}>Total Users</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue} style={{ color: '#00bcd4' }}>{stats.standard}</div>
          <div className={styles.statLabel}>Standard</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue} style={{ color: '#00e676' }}>{stats.premium}</div>
          <div className={styles.statLabel}>Premium</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue} style={{ color: '#00e676' }}>${stats.revenue}</div>
          <div className={styles.statLabel}>Revenue</div>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search email, plan, payment ref..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Subscriptions list */}
      {loading ? (
        <div className={styles.loadingText}>Loading subscriptions...</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyText}>No subscriptions found</div>
      ) : (
        <div className={styles.subList}>
          {filtered.map(sub => (
            <div key={sub.id} className={styles.subCard}>

              {/* User info */}
              <div className={styles.subHeader}>
                <div>
                  <div className={styles.subEmail}>{sub.email}</div>
                  <div className={styles.subMeta}>
                    Joined {new Date(sub.created_at).toLocaleDateString()}
                    {sub.paystack_ref && <span> · Ref: {sub.paystack_ref}</span>}
                  </div>
                </div>
                <div
                  className={styles.planBadge}
                  style={{ color: PLAN_COLORS[sub.plan], borderColor: PLAN_COLORS[sub.plan] + '55', background: PLAN_COLORS[sub.plan] + '15' }}
                >
                  {sub.plan.toUpperCase()}
                </div>
              </div>

              {/* Scan info */}
              <div className={styles.scanInfo}>
                <div className={styles.scanInfoItem}>
                  <div className={styles.scanInfoLabel}>Scans Left</div>
                  <div className={styles.scanInfoValue} style={{ color: sub.scans_left <= 0 ? '#ff4444' : '#00e676' }}>
                    {sub.plan === 'premium' ? '∞' : Math.max(0, sub.scans_left ?? (sub.scans_total - sub.scans_used))}
                  </div>
                </div>
                <div className={styles.scanInfoItem}>
                  <div className={styles.scanInfoLabel}>Used</div>
                  <div className={styles.scanInfoValue}>{sub.scans_used}</div>
                </div>
                <div className={styles.scanInfoItem}>
                  <div className={styles.scanInfoLabel}>Total</div>
                  <div className={styles.scanInfoValue}>{sub.plan === 'premium' ? '∞' : sub.scans_total}</div>
                </div>
                {sub.expires_at && (
                  <div className={styles.scanInfoItem}>
                    <div className={styles.scanInfoLabel}>Expires</div>
                    <div className={styles.scanInfoValue} style={{ fontSize: '0.7rem' }}>
                      {new Date(sub.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className={styles.actions}>
                <div className={styles.actionsLabel}>Activate Plan:</div>
                <div className={styles.actionBtns}>
                  <button
                    className={`${styles.actionBtn} ${sub.plan === 'free' ? styles.actionBtnActive : ''}`}
                    onClick={() => activatePlan(sub.user_id, 'free')}
                    disabled={updating === sub.user_id}
                    style={{ borderColor: '#5a6370', color: '#5a6370' }}
                  >Free</button>
                  <button
                    className={`${styles.actionBtn} ${sub.plan === 'standard' ? styles.actionBtnActive : ''}`}
                    onClick={() => activatePlan(sub.user_id, 'standard')}
                    disabled={updating === sub.user_id}
                    style={{ borderColor: '#00bcd4', color: '#00bcd4' }}
                  >Standard $25</button>
                  <button
                    className={`${styles.actionBtn} ${sub.plan === 'premium' ? styles.actionBtnActive : ''}`}
                    onClick={() => activatePlan(sub.user_id, 'premium')}
                    disabled={updating === sub.user_id}
                    style={{ borderColor: '#00e676', color: '#00e676' }}
                  >Premium $100</button>
                </div>
              </div>

              {/* Add scans */}
              <div className={styles.addScans}>
                <div className={styles.actionsLabel}>Add Scans:</div>
                <div className={styles.addScanBtns}>
                  {[5, 10, 20].map(n => (
                    <button
                      key={n}
                      className={styles.addScanBtn}
                      onClick={() => addScans(sub.user_id, n)}
                      disabled={updating === sub.user_id}
                    >+{n}</button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className={styles.notesWrap}>
                <textarea
                  className={styles.notesInput}
                  placeholder="Admin notes (payment ref, date, etc)..."
                  defaultValue={sub.notes || ''}
                  onBlur={e => saveNotes(sub.user_id, e.target.value)}
                  rows={2}
                />
              </div>

              {updating === sub.user_id && (
                <div className={styles.updatingBar}>Updating...</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
