import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import styles from './AdminPage.module.css'

const ADMIN_EMAIL = 'majolainnocent11@gmail.com'

const PLAN_COLORS = {
  free:     '#5a6370',
  standard: '#00bcd4',
  premium:  '#00e676',
}

export default function AdminPage({ onBack, session }) {
  const [users,         setUsers]         = useState([])
  const [subscriptions, setSubscriptions] = useState({})
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [updating,      setUpdating]      = useState(null)
  const [stats,         setStats]         = useState({ total: 0, free: 0, standard: 0, premium: 0, revenue: 0 })
  const [toast,         setToast]         = useState('')
  const [page,          setPage]          = useState(0)
  const PAGE_SIZE = 20

  const isAdmin = session?.user?.email === ADMIN_EMAIL

  useEffect(() => { if (isAdmin) loadData() }, [isAdmin])

  async function loadData() {
    setLoading(true)
    try {
      // Load subscriptions table
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false })

      const subMap = {}
      const s = { total: 0, free: 0, standard: 0, premium: 0, revenue: 0 }

      ;(subs || []).forEach(sub => {
        subMap[sub.user_id] = sub
        subMap[sub.email]   = sub
        s[sub.plan] = (s[sub.plan] || 0) + 1
        if (sub.plan === 'standard') s.revenue += 25
        if (sub.plan === 'premium')  s.revenue += 100
      })

      setSubscriptions(subMap)

      // Load auth users via admin API
      // Since we can't directly query auth.users from client,
      // we use the subscriptions table as the source of truth
      // and show all subscription records
      const allUsers = (subs || []).map(sub => ({
        id:         sub.user_id,
        email:      sub.email,
        created_at: sub.created_at,
      }))

      s.total = allUsers.length
      setUsers(allUsers)
      setStats(s)

    } catch (e) {
      showToast('Error loading: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function activatePlan(userId, email, plan) {
    setUpdating(userId)
    try {
      const now = new Date().toISOString()
      let update = {}

      if (plan === 'standard') {
        update = { plan: 'standard', scans_total: 20, scans_used: 0, expires_at: null, activated_at: now, updated_at: now }
      } else if (plan === 'premium') {
        const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        update = { plan: 'premium', scans_total: 99999, scans_used: 0, expires_at: exp, activated_at: now, updated_at: now }
      } else {
        update = { plan: 'free', scans_total: 3, scans_used: 0, expires_at: null, activated_at: now, updated_at: now }
      }

      // Try update by user_id first, then by email
      const { error } = await supabase
        .from('subscriptions')
        .update(update)
        .eq('user_id', userId)

      if (error) throw error

      showToast(`✓ ${plan.toUpperCase()} activated for ${email}!`)
      await loadData()
    } catch (e) {
      showToast('Error: ' + e.message)
    } finally {
      setUpdating(null)
    }
  }

  async function addScans(userId, email, amount) {
    setUpdating(userId)
    try {
      const sub = subscriptions[userId]
      if (!sub) return

      const { error } = await supabase
        .from('subscriptions')
        .update({ scans_total: sub.scans_total + amount, updated_at: new Date().toISOString() })
        .eq('user_id', userId)

      if (error) throw error
      showToast(`✓ Added ${amount} scans to ${email}`)
      await loadData()
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

  const filtered = users.filter(u =>
    !search ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    subscriptions[u.id]?.plan?.includes(search.toLowerCase()) ||
    subscriptions[u.id]?.paystack_ref?.includes(search)
  )

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

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

      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <div className={styles.headerTitle}>◎ Admin Panel</div>
        <button className={styles.refreshBtn} onClick={loadData}>↻</button>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.total}</div>
          <div className={styles.statLabel}>Total Users</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue} style={{ color: '#5a6370' }}>{stats.free || 0}</div>
          <div className={styles.statLabel}>Free</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue} style={{ color: '#00bcd4' }}>{stats.standard || 0}</div>
          <div className={styles.statLabel}>Standard</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue} style={{ color: '#00e676' }}>{stats.premium || 0}</div>
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
          placeholder="Search by email, plan, payment ref..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
        />
        <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#5a6370', marginTop: 6, padding: '0 4px' }}>
          Showing {paginated.length} of {filtered.length} users
        </div>
      </div>

      {/* Users list */}
      {loading ? (
        <div className={styles.loadingText}>Loading users...</div>
      ) : paginated.length === 0 ? (
        <div className={styles.emptyText}>No users found</div>
      ) : (
        <>
          <div className={styles.subList}>
            {paginated.map(user => {
              const sub = subscriptions[user.id] || {}
              const plan = sub.plan || 'free'
              const scansLeft = plan === 'premium' ? '∞' : Math.max(0, (sub.scans_total || 3) - (sub.scans_used || 0))

              return (
                <div key={user.id} className={styles.subCard}>

                  {/* User info */}
                  <div className={styles.subHeader}>
                    <div>
                      <div className={styles.subEmail}>{user.email}</div>
                      <div className={styles.subMeta}>
                        Joined {new Date(user.created_at).toLocaleDateString()}
                        {sub.paystack_ref && <span> · Ref: {sub.paystack_ref}</span>}
                      </div>
                    </div>
                    <div
                      className={styles.planBadge}
                      style={{
                        color: PLAN_COLORS[plan],
                        borderColor: PLAN_COLORS[plan] + '55',
                        background: PLAN_COLORS[plan] + '15'
                      }}
                    >
                      {plan.toUpperCase()}
                    </div>
                  </div>

                  {/* Scan info */}
                  <div className={styles.scanInfo}>
                    <div className={styles.scanInfoItem}>
                      <div className={styles.scanInfoLabel}>Scans Left</div>
                      <div className={styles.scanInfoValue} style={{ color: scansLeft === 0 ? '#ff4444' : '#00e676' }}>
                        {scansLeft}
                      </div>
                    </div>
                    <div className={styles.scanInfoItem}>
                      <div className={styles.scanInfoLabel}>Used</div>
                      <div className={styles.scanInfoValue}>{sub.scans_used || 0}</div>
                    </div>
                    <div className={styles.scanInfoItem}>
                      <div className={styles.scanInfoLabel}>Total</div>
                      <div className={styles.scanInfoValue}>{plan === 'premium' ? '∞' : (sub.scans_total || 3)}</div>
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

                  {/* Activate plan */}
                  <div className={styles.actions}>
                    <div className={styles.actionsLabel}>Activate Plan:</div>
                    <div className={styles.actionBtns}>
                      <button
                        className={`${styles.actionBtn} ${plan === 'free' ? styles.actionBtnActive : ''}`}
                        onClick={() => activatePlan(user.id, user.email, 'free')}
                        disabled={updating === user.id}
                        style={{ borderColor: '#5a6370', color: '#5a6370' }}
                      >Free</button>
                      <button
                        className={`${styles.actionBtn} ${plan === 'standard' ? styles.actionBtnActive : ''}`}
                        onClick={() => activatePlan(user.id, user.email, 'standard')}
                        disabled={updating === user.id}
                        style={{ borderColor: '#00bcd4', color: '#00bcd4' }}
                      >Standard $25</button>
                      <button
                        className={`${styles.actionBtn} ${plan === 'premium' ? styles.actionBtnActive : ''}`}
                        onClick={() => activatePlan(user.id, user.email, 'premium')}
                        disabled={updating === user.id}
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
                          onClick={() => addScans(user.id, user.email, n)}
                          disabled={updating === user.id}
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
                      onBlur={e => saveNotes(user.id, e.target.value)}
                      rows={2}
                    />
                  </div>

                  {updating === user.id && (
                    <div className={styles.updatingBar}>Updating...</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >← Prev</button>
              <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#5a6370' }}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                className={styles.pageBtn}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
