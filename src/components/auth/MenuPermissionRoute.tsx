import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { usePermissions } from '../../hooks/usePermissions'

export function MenuPermissionRoute({
  menuId,
  children,
}: {
  menuId: string
  children: ReactNode
}) {
  const { permissionsReady, canViewMenu } = usePermissions()

  if (!permissionsReady) {
    return <p className="auth-loading">Loading permissions…</p>
  }

  if (!canViewMenu(menuId)) {
    return <Navigate to="/" replace />
  }

  return children
}
