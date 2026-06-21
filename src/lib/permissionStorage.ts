import { getAllNavMenus } from '../config/navigationRegistry'
import type { PermissionAction } from '../config/navigationRegistry'
import type { MenuPermissionGrant, UserPermissions } from '../types/permissions'

export interface PermissionRow {
  user_id: string
  menu_id: string
  permissions: MenuPermissionGrant
}

export function rowsToUserPermissions(
  rows: Array<{ menu_id: string; permissions: MenuPermissionGrant | null }>,
): UserPermissions {
  const result: UserPermissions = {}
  for (const row of rows) {
    if (!row.permissions) continue
    result[row.menu_id] = { ...row.permissions }
  }
  return result
}

export function userPermissionsToRows(userId: string, permissions: UserPermissions): PermissionRow[] {
  const menus = getAllNavMenus()
  return menus.map((menu) => {
    const grant: MenuPermissionGrant = {}
    for (const action of menu.actions) {
      grant[action as PermissionAction] = Boolean(permissions[menu.id]?.[action as PermissionAction])
    }
    return {
      user_id: userId,
      menu_id: menu.id,
      permissions: grant,
    }
  })
}
