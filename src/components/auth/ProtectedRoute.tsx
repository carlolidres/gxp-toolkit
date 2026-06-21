import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '../../types/auth'

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { isAuthenticated, authReady, hasRole, user } = useAuth()
  const location = useLocation()
  if (!authReady) return <p className="auth-loading">Restoring session…</p>
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  if (user?.active === false) return <Navigate to="/login" replace />
  if (roles && !hasRole(roles)) return <Navigate to="/" replace />
  return children
}
