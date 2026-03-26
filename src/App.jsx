import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'

// ── ProtectedRoute ──────────────────────────────────────────────────────────
// If the user is not signed in, send them to /auth instead
function ProtectedRoute({ session, children }) {
  if (session === undefined) {
    // Still loading — show nothing while we check auth
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', position: 'relative', zIndex: 1
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '2px solid var(--cyan)', borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 12px'
          }} />
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', fontFamily: "'DM Mono', monospace" }}>
            Loading...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }
  if (!session) return <Navigate to="/auth" replace />
  return children
}

// ── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  // undefined = still loading, null = not signed in, object = signed in
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    // Check if there's already a session when the app first loads
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })

    // Listen for sign-in / sign-out events and update state automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
    })

    // Clean up the listener when the component unmounts
    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public route — the sign in / sign up page */}
        <Route
          path="/auth"
          element={
            session
              ? <Navigate to="/" replace />   /* already signed in → go home */
              : <AuthPage />
          }
        />

        {/* Protected route — only accessible when signed in */}
        <Route
          path="/"
          element={
            <ProtectedRoute session={session}>
              <Dashboard session={session} />
            </ProtectedRoute>
          }
        />

        {/* Catch-all: redirect anything unknown to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
