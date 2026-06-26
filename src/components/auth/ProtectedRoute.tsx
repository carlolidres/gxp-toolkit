import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { authService } from '../../services/authService'
import type { UserRole } from '../../types/auth'

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { isAuthenticated, authReady, hasRole, user, usesSupabase, logout } = useAuth()
  const location = useLocation()
  const [sessionVerified, setSessionVerified] = useState<boolean | null>(usesSupabase ? null : true)

  useEffect(() => {
    if (!authReady || !usesSupabase || !isAuthenticated) {
      setSessionVerified(usesSupabase ? null : true)
      return
    }

    let active = true
    void authService.hasSupabaseSession().then((ok) => {
      if (!active) return
      setSessionVerified(ok)
      if (!ok) {
        void logout()
      }
    })

    return () => {
      active = false
    }
  }, [authReady, isAuthenticated, logout, usesSupabase, user?.id])

  if (!authReady) return <p className="auth-loading">Restoring session…</p>
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  if (usesSupabase && sessionVerified === null) {
    return <p className="auth-loading">Verifying session…</p>
  }
  if (user?.active === false) return <Navigate to="/login" replace />
  if (user?.mustChangePassword) return <Navigate to="/reset-password" replace state={{ from: location }} />
  if (roles && !hasRole(roles)) return <Navigate to="/" replace />
  return children
}
