export type { PermissionAction } from '../config/navigationRegistry'
export { PERMISSION_ACTION_LABELS, PERMISSION_ACTIONS } from '../config/navigationRegistry'

import type { PermissionAction } from '../config/navigationRegistry'
import type { UserRole } from './auth'

export type MenuPermissionGrant = Partial<Record<PermissionAction, boolean>>

/** Menu id → granted actions */
export type UserPermissions = Record<string, MenuPermissionGrant>

export interface ManagedUser {
  id: string
  name: string
  email: string
  role: UserRole
  initials: string
  active: boolean
  permissions: UserPermissions
}

export interface UpdateManagedUserInput {
  role?: UserRole
  active?: boolean
  permissions?: UserPermissions
}
