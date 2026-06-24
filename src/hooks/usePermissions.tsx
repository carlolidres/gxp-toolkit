import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { PermissionAction } from '../config/navigationRegistry'
import { filterNavigationGroups, getRoleDefaultPermissions } from '../lib/permissions'
import { userManagementService } from '../services/userManagementService'
import type { NavGroupDefinition } from '../config/navigationRegistry'
import type { UserPermissions } from '../types/permissions'
import { hasPermission, canViewMenu as canViewMenuFor } from '../lib/permissions'
import { useAuth } from './useAuth'

function resolvePermissionUserRef(user: { id: string; profileId?: string }) {
  return user.profileId ?? user.id
}

interface PermissionsContextValue {
  permissions: UserPermissions | null
  permissionsReady: boolean
  can: (action: PermissionAction, menuId: string) => boolean
  canViewMenu: (menuId: string) => boolean
  accessibleNavigationGroups: NavGroupDefinition[]
  refreshPermissions: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null)

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, authReady } = useAuth()
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [ready, setReady] = useState(false)

  const loadPermissions = useCallback(async () => {
    if (!user) {
      setPermissions(null)
      setReady(true)
      return
    }

    setReady(false)
    try {
      if (user.active === false) {
        setPermissions({})
        return
      }
      const next = await Promise.race([
        userManagementService.getPermissions(resolvePermissionUserRef(user), user.role),
        new Promise<UserPermissions>((_, reject) => {
          window.setTimeout(() => reject(new Error('Permission load timed out')), 15_000)
        }),
      ])
      setPermissions(next)
    } catch (err) {
      console.error('[permissions] load failed:', err)
      setPermissions(getRoleDefaultPermissions(user.role))
    } finally {
      setReady(true)
    }
  }, [user])

  useEffect(() => {
    if (!authReady) return
    void loadPermissions()
  }, [authReady, loadPermissions])

  const value = useMemo<PermissionsContextValue>(
    () => ({
      permissions,
      permissionsReady: authReady && ready,
      can: (action, menuId) => hasPermission(permissions, menuId, action),
      canViewMenu: (menuId) => canViewMenuFor(permissions, menuId),
      accessibleNavigationGroups: filterNavigationGroups(permissions),
      refreshPermissions: loadPermissions,
    }),
    [authReady, ready, permissions, loadPermissions],
  )

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions(): PermissionsContextValue {
  const context = useContext(PermissionsContext)
  if (!context) throw new Error('usePermissions must be used inside PermissionsProvider')
  return context
}

export function useMenuPermission(menuId: string) {
  const { can, canViewMenu } = usePermissions()

  return useMemo(
    () => ({
      canView: canViewMenu(menuId),
      canCreate: can('create', menuId),
      canEdit: can('edit', menuId),
      canDelete: can('delete', menuId),
      canApprove: can('approve', menuId),
      canExport: can('export', menuId),
    }),
    [can, canViewMenu, menuId],
  )
}
