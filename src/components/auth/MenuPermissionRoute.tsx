import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { usePermissions } from '../../hooks/usePermissions'

export function MenuPermissionRoute({
  menuId,
  anyOfMenuIds,
  children,
}: {
  menuId?: string
  anyOfMenuIds?: string[]
  children: ReactNode
}) {
  const { permissionsReady, canViewMenu } = usePermissions()
  const allowedMenus = anyOfMenuIds ?? (menuId ? [menuId] : [])

  if (!permissionsReady) {
    return <p className="auth-loading">Loading permissions…</p>
  }

  if (allowedMenus.length === 0 || !allowedMenus.some((id) => canViewMenu(id))) {
    return <Navigate to="/" replace />
  }

  return children
}
