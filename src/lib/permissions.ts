import {
  getAllNavMenus,
  getMenuById,
  navigationRegistry,
  type NavGroupDefinition,
  type PermissionAction,
} from '../config/navigationRegistry'
import type { UserRole } from '../types/auth'
import type { UserPermissions } from '../types/permissions'

export function getRoleDefaultPermissions(role: UserRole): UserPermissions {
  const result: UserPermissions = {}

  for (const menu of getAllNavMenus()) {
    result[menu.id] = {}
    for (const action of menu.actions) {
      result[menu.id][action] = defaultGrantForRole(role, menu.id, action)
    }
  }

  return result
}

function defaultGrantForRole(role: UserRole, menuId: string, action: PermissionAction): boolean {
  if (role === 'Admin') return true

  if (menuId === 'user-management') {
    return false
  }

  if (role === 'Manager') {
    if (action === 'view') return true
    if (menuId === 'routing') return true
    if (menuId === 'registry') return action !== 'approve'
    return action === 'export'
  }

  if (role === 'Editor') {
    if (action === 'view') return true
    if (menuId === 'routing' && ['create', 'edit', 'approve'].includes(action)) return true
    if (menuId === 'registry' && ['create', 'edit'].includes(action)) return true
    if (menuId.startsWith('apqr-') && ['create', 'edit'].includes(action)) return true
    return false
  }

  return action === 'view'
}

export function normalizeUserPermissions(
  stored: UserPermissions | undefined,
  role: UserRole,
): UserPermissions {
  if (role === 'Admin') {
    return getRoleDefaultPermissions('Admin')
  }

  const defaults = getRoleDefaultPermissions(role)
  const result: UserPermissions = {}

  for (const menu of getAllNavMenus()) {
    result[menu.id] = {}
    for (const action of menu.actions) {
      result[menu.id][action] = stored?.[menu.id]?.[action] ?? defaults[menu.id]?.[action] ?? false
    }
  }

  return result
}

export function hasPermission(
  permissions: UserPermissions | null | undefined,
  menuId: string,
  action: PermissionAction,
): boolean {
  if (!permissions) return false
  const menu = getMenuById(menuId)
  if (!menu?.actions.includes(action)) return false
  return Boolean(permissions[menuId]?.[action])
}

export function canViewMenu(
  permissions: UserPermissions | null | undefined,
  menuId: string,
): boolean {
  return hasPermission(permissions, menuId, 'view')
}

export function filterNavigationGroups(
  permissions: UserPermissions | null | undefined,
): NavGroupDefinition[] {
  return navigationRegistry
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canViewMenu(permissions, item.id)),
    }))
    .filter((group) => group.items.length > 0)
}

export function mergePermissionUpdate(
  current: UserPermissions,
  menuId: string,
  action: PermissionAction,
  granted: boolean,
): UserPermissions {
  const menu = getMenuById(menuId)
  if (!menu?.actions.includes(action)) return current

  const next: UserPermissions = {
    ...current,
    [menuId]: {
      ...current[menuId],
      [action]: granted,
    },
  }

  if (action !== 'view' && granted) {
    next[menuId] = { ...next[menuId], view: true }
  }

  if (action === 'view' && !granted) {
    for (const menuAction of menu.actions) {
      if (menuAction !== 'view') {
        next[menuId] = { ...next[menuId], [menuAction]: false }
      }
    }
  }

  return next
}

export function permissionsAreEqual(left: UserPermissions, right: UserPermissions): boolean {
  for (const menu of getAllNavMenus()) {
    for (const action of menu.actions) {
      if (Boolean(left[menu.id]?.[action]) !== Boolean(right[menu.id]?.[action])) {
        return false
      }
    }
  }
  return true
}
