import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import LandingPage from './pages/LandingPage'
import AdminPage from './pages/AdminPage'
import TermsPage from './pages/TermsPage'

function ProtectedRoute({ session, children }) {
  if (session === undefined) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', position: 'relative', zIndex: 1,
        background: '#050505'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '2px solid #ff2a2a', borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
            boxShadow: '0 0 20px rgba(255,42,42,0.3)'
          }} />
          <p style={{ color: '#888', fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.15em' }}>
            LOADING...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }
  if (!session) return <Navigate to="/auth" replace />
  return children
}

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

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/terms" element={<TermsPage />} />

        <Route
          path="/auth"
          element={
            session === undefined
              ? null
              : session
                ? <Navigate to="/dashboard" replace />
                : <AuthPage />
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute session={session}>
              <Dashboard session={session} />
            </ProtectedRoute>
          }
        />

        <Route path="/admin" element={<AdminPage session={session} onBack={() => { window.location.href = '/' }} />} />
      </Routes>
    </BrowserRouter>
  )
}
