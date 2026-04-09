import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export function useSubscription() {
  const [plan,        setPlan]        = useState('free')
  const [scansLeft,   setScansLeft]   = useState(3)
  const [scansUsed,   setScansUsed]   = useState(0)
  const [scansTotal,  setScansTotal]  = useState(3)
  const [expiry,      setExpiry]      = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [subId,       setSubId]       = useState(null)

  // Load subscription from Supabase on mount
  useEffect(() => {
    loadSubscription()
  }, [])

  async function loadSubscription() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error || !data) {
        // Create one if doesn't exist
        const { data: newSub } = await supabase
          .from('subscriptions')
          .insert({ user_id: user.id, email: user.email, plan: 'free', scans_total: 3, scans_used: 0 })
          .select()
          .single()
        if (newSub) applySubscription(newSub)
      } else {
        applySubscription(data)
      }
    } catch (e) {
      console.error('Subscription load error:', e)
    } finally {
      setLoading(false)
    }
  }

  function applySubscription(data) {
    const now = Date.now()
    // Check premium expiry
    if (data.plan === 'premium' && data.expires_at && new Date(data.expires_at).getTime() < now) {
      // Expired — treat as free
      setPlan('free'); setScansLeft(3); setScansUsed(0); setScansTotal(3); setExpiry(null)
      return
    }
    setSubId(data.id)
    setPlan(data.plan)
    setScansUsed(data.scans_used)
    setScansTotal(data.scans_total)
    setExpiry(data.expires_at)
    if (data.plan === 'premium') setScansLeft(-1)
    else setScansLeft(Math.max(0, data.scans_total - data.scans_used))
  }

  // Use a scan — updates Supabase
  async function consumeScan() {
    if (plan === 'premium') return true
    if (scansLeft <= 0) return false

    const newUsed = scansUsed + 1
    const newLeft = Math.max(0, scansLeft - 1)

    // Optimistic update
    setScansUsed(newUsed)
    setScansLeft(newLeft)

    // Sync to Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('subscriptions')
          .update({ scans_used: newUsed, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
      }
    } catch (e) { console.error('Scan consume error:', e) }

    return true
  }

  const canScan = plan === 'premium' || scansLeft > 0

  const expiryDate = expiry
    ? new Date(expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return {
    plan, scansLeft, scansUsed, scansTotal,
    canScan, expiry, expiryDate, loading,
    consumeScan, loadSubscription
  }
}
