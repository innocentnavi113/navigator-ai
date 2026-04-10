import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import AdminPage from './pages/AdminPage'

const ADMIN_EMAIL = 'majolainnocent11@gmail.com'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Loading spinner
  if (session === undefined) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0d0f'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#00e676', fontSize: '2rem', marginBottom: 12 }}>◎</div>
          <p style={{ color: '#5a6370', fontSize: '0.82rem', fontFamily: 'monospace' }}>Loading...</p>
        </div>
      </div>
    )
  }

  // Not logged in → show auth
  if (!session) return <AuthPage />

  // Check URL for admin page — no react-router needed
  const isAdmin = window.location.pathname === '/admin'

  if (isAdmin) {
    return (
      <AdminPage
        session={session}
        onBack={() => { window.location.href = '/' }}
      />
    )
  }

  // Default → main dashboard
  return <Dashboard session={session} />
}
