import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { PermissionAction } from '../config/navigationRegistry'
import { filterNavigationGroups } from '../lib/permissions'
import { isSupabaseTableAuthError } from '../lib/supabaseAuth'
import { authService } from '../services/authService'
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
  const { user, authReady, usesSupabase } = useAuth()
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [ready, setReady] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  const loadPermissions = useCallback(async () => {
    if (!user) {
      setPermissions(null)
      setLoadFailed(false)
      setReady(true)
      return
    }

    setReady(false)
    setLoadFailed(false)
    try {
      if (user.active === false) {
        setPermissions({})
        return
      }
      if (usesSupabase) {
        const sessionOk = await authService.hasSupabaseSession()
        if (!sessionOk) {
          setPermissions({})
          return
        }
      }
      const next = await Promise.race([
        userManagementService.getPermissions(resolvePermissionUserRef(user), user.role),
        new Promise<UserPermissions>((_, reject) => {
          window.setTimeout(() => reject(new Error('Permission load timed out')), 15_000)
        }),
      ])
      setPermissions(next)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Permission load failed'
      if (!isSupabaseTableAuthError(message)) {
        console.error('[permissions] load failed:', err)
      }
      setPermissions({})
      setLoadFailed(true)
    } finally {
      setReady(true)
    }
  }, [user, usesSupabase])

  useEffect(() => {
    if (!authReady) return
    if (loadFailed) return
    void loadPermissions()
  }, [authReady, loadFailed, loadPermissions])

  const refreshPermissions = useCallback(async () => {
    setLoadFailed(false)
    await loadPermissions()
  }, [loadPermissions])

  const value = useMemo<PermissionsContextValue>(
    () => ({
      permissions,
      permissionsReady: authReady && ready,
      can: (action, menuId) => hasPermission(permissions, menuId, action),
      canViewMenu: (menuId) => canViewMenuFor(permissions, menuId),
      accessibleNavigationGroups: filterNavigationGroups(permissions),
      refreshPermissions,
    }),
    [authReady, ready, permissions, refreshPermissions],
  )

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions(): PermissionsContextValue {
  const context = useContext(PermissionsContext)
  if (!context) throw new Error('usePermissions must be used inside PermissionsProvider')
  return context
}
