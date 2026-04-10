import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import styles from './AdminPage.module.css'

const ADMIN_EMAIL = 'majolainnocent11@gmail.com'

export default function AdminPage() {
  const [session, setSession] = useState(undefined)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [allSubs, setAllSubs] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user?.email === ADMIN_EMAIL) {
      fetchAll()
    }
  }, [session])

  async function fetchAll() {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false })
    setAllSubs(data || [])
    setResults(data || [])
  }

  function handleSearch(val) {
    setSearch(val)
    if (!val.trim()) {
      setResults(allSubs)
      return
    }
    const q = val.toLowerCase()
    setResults(allSubs.filter(s =>
      s.email?.toLowerCase().includes(q) ||
      s.plan?.toLowerCase().includes(q) ||
      s.paystack_ref?.toLowerCase().includes(q)
    ))
  }

  async function activatePlan(email, plan) {
    setLoading(true)
    setMessage(null)
    const scansTotal = plan === 'standard' ? 20 : -1
    const scansLeft = plan === 'standard' ? 20 : -1
    const now = new Date().toISOString()
    const expires = plan === 'premium'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null

    const existing = allSubs.find(s => s.email === email)

    let error
    if (existing) {
      const { error: e } = await supabase
        .from('subscriptions')
        .update({
          plan,
          scans_total: scansTotal,
          scans_left: scansLeft,
          scans_used: 0,
          activated_at: now,
          expires_at: expires,
          updated_at: now,
        })
        .eq('email', email)
      error = e
    } else {
      const { error: e } = await supabase
        .from('subscriptions')
        .insert({
          email,
          plan,
          scans_total: scansTotal,
          scans_left: scansLeft,
          scans_used: 0,
          activated_at: now,
          expires_at: expires,
          created_at: now,
          updated_at: now,
        })
      error = e
    }

    setLoading(false)
    if (error) {
      setMessage({ type: 'error', text: `Error: ${error.message}` })
    } else {
      setMessage({ type: 'success', text: `${plan.charAt(0).toUpperCase() + plan.slice(1)} activated for ${email}` })
      fetchAll()
    }
  }

  if (session === undefined) {
    return (
      <div className={styles.center}>
        <div className={styles.spinner} />
      </div>
    )
  }

  if (!session) {
    return (
      <div className={styles.center}>
        <div className={styles.card}>
          <div className={styles.logo}>◎ Navigator <span className={styles.ai}>AI</span></div>
          <p className={styles.muted}>Admin access requires sign in</p>
          <button className={styles.signInBtn} onClick={() => window.location.href = '/auth'}>
            Sign In
          </button>
        </div>
      </div>
    )
  }

  if (session.user.email !== ADMIN_EMAIL) {
    return (
      <div className={styles.center}>
        <div className={styles.card}>
          <div className={styles.logo}>◎ Navigator <span className={styles.ai}>AI</span></div>
          <p className={styles.error}>Access denied. Admin only.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <span className={styles.logoMark}>◎</span>
          Navigator <span className={styles.ai}>AI</span>
          <span className={styles.adminBadge}>ADMIN</span>
        </div>
        <button className={styles.signOutBtn} onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}>
          Sign Out
        </button>
      </div>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Users</div>
          <div className={styles.statValue}>{allSubs.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Premium</div>
          <div className={styles.statValue} style={{ color: '#00e676' }}>
            {allSubs.filter(s => s.plan === 'premium').length}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Standard</div>
          <div className={styles.statValue} style={{ color: '#00bcd4' }}>
            {allSubs.filter(s => s.plan === 'standard').length}
          </div>
        </div>
      </div>

      {message && (
        <div className={message.type === 'success' ? styles.successBanner : styles.errorBanner}>
          {message.text}
        </div>
      )}

      <div className={styles.searchWrap}>
        <input
          className={styles.searchInput}
          placeholder="Search by email, plan, or Paystack ref..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      <div className={styles.activateSection}>
        <div className={styles.sectionTitle}>Activate Plan</div>
        <ActivateForm onActivate={activatePlan} loading={loading} />
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.sectionTitle}>Subscriptions ({results.length})</div>
        {results.length === 0 ? (
          <div className={styles.empty}>No records found</div>
        ) : (
          results.map(sub => (
            <div key={sub.id} className={styles.subCard}>
              <div className={styles.subRow}>
                <div className={styles.subEmail}>{sub.email}</div>
                <div
                  className={styles.planBadge}
                  style={{
                    background: sub.plan === 'premium' ? 'rgba(0,230,118,0.12)' : sub.plan === 'standard' ? 'rgba(0,188,212,0.12)' : 'rgba(90,99,112,0.12)',
                    color: sub.plan === 'premium' ? '#00e676' : sub.plan === 'standard' ? '#00bcd4' : '#5a6370',
                    borderColor: sub.plan === 'premium' ? 'rgba(0,230,118,0.3)' : sub.plan === 'standard' ? 'rgba(0,188,212,0.3)' : 'rgba(90,99,112,0.3)',
                  }}
                >
                  {sub.plan?.toUpperCase()}
                </div>
              </div>
              <div className={styles.subMeta}>
                <span>Scans left: <strong>{sub.scans_left === -1 ? '∞' : sub.scans_left}</strong></span>
                <span>Used: <strong>{sub.scans_used ?? 0}</strong></span>
                {sub.expires_at && (
                  <span>Expires: <strong>{new Date(sub.expires_at).toLocaleDateString()}</strong></span>
                )}
              </div>
              <div className={styles.subActions}>
                <button
                  className={styles.activateCyan}
                  disabled={loading}
                  onClick={() => activatePlan(sub.email, 'standard')}
                >
                  Standard $25
                </button>
                <button
                  className={styles.activateGreen}
                  disabled={loading}
                  onClick={() => activatePlan(sub.email, 'premium')}
                >
                  Premium $100
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function ActivateForm({ onActivate, loading }) {
  const [email, setEmail] = useState('')

  return (
    <div className={styles.activateForm}>
      <input
        className={styles.searchInput}
        placeholder="User email address"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <div className={styles.activateBtns}>
        <button
          className={styles.activateCyan}
          disabled={loading || !email.trim()}
          onClick={() => onActivate(email.trim(), 'standard')}
        >
          Standard $25 — 20 scans
        </button>
        <button
          className={styles.activateGreen}
          disabled={loading || !email.trim()}
          onClick={() => onActivate(email.trim(), 'premium')}
        >
          Premium $100 — Unlimited
        </button>
      </div>
    </div>
  )
}
