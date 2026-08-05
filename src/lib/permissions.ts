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

  // Opt-in menus: admin enables in User Management.
  if (menuId === 'user-management' || menuId === 'edoc-all-documents') {
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
      items: group.items.filter(
        (item) => item.sidebarVisible !== false && canViewMenu(permissions, item.id),
      ),
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

const DOCUMENT_CONTROLLER_EDOC_MENUS = [
  'edoc-dashboard',
  'edoc-inbox',
  'edoc-create',
  'edoc-my-documents',
  'edoc-all-documents',
  'edoc-audit',
  'edoc-returned',
  'edoc-completed',
  'edoc-routing-templates',
  'edoc-reports',
  'edoc-admin',
] as const

/** Full eDocuSign capability set for a nominated Document Controller. */
export function getDocumentControllerEdocPermissions(): UserPermissions {
  const result: UserPermissions = {}
  for (const menuId of DOCUMENT_CONTROLLER_EDOC_MENUS) {
    const menu = getMenuById(menuId)
    if (!menu) continue
    result[menuId] = {}
    for (const action of menu.actions) {
      // Permanent document purge remains Admin-only (server-enforced).
      if (menuId === 'edoc-all-documents' && action === 'delete') {
        result[menuId][action] = false
        continue
      }
      result[menuId][action] = true
    }
  }
  return result
}

/** Merge Document Controller eDoc grants into an existing matrix (non-eDoc menus unchanged). */
export function applyDocumentControllerPermissions(current: UserPermissions): UserPermissions {
  return {
    ...current,
    ...getDocumentControllerEdocPermissions(),
  }
}

/** Drop elevated Document Controller eDoc menus back to role defaults; keep other modules. */
export function clearDocumentControllerPermissions(
  current: UserPermissions,
  role: UserRole,
): UserPermissions {
  const defaults = getRoleDefaultPermissions(role)
  const next: UserPermissions = { ...current }
  for (const menuId of DOCUMENT_CONTROLLER_EDOC_MENUS) {
    next[menuId] = { ...defaults[menuId] }
  }
  return next
}

export function hasDocumentControllerEdocAccess(permissions: UserPermissions): boolean {
  return (
    Boolean(permissions['edoc-all-documents']?.view) &&
    Boolean(permissions['edoc-admin']?.view) &&
    Boolean(permissions['edoc-routing-templates']?.view)
  )
}
