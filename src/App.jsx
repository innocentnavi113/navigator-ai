import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import AdminPage from './pages/AdminPage'

const ADMIN_EMAIL = 'majolainnocent11@gmail.com'

function ProtectedRoute({ session, children }) {
  if (session === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0d0f' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#00e676', fontSize: '2rem', marginBottom: 12, animation: 'spin 1s linear infinite' }}>◎</div>
          <p style={{ color: '#5a6370', fontSize: '0.82rem', fontFamily: 'monospace' }}>Loading...</p>
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
        <Route
          path="/auth"
          element={session ? <Navigate to="/" replace /> : <AuthPage />}
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute session={session}>
              <AdminPage
                session={session}
                onBack={() => window.history.back()}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute session={session}>
              <Dashboard session={session} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
