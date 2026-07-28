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
  /** Employer / organization from profile. */
  organization?: string | null
  /** True when a PNG signature is stored on the profile. */
  hasSignature?: boolean
  /** Organization + e-signature present (eDoc access readiness). */
  profileComplete?: boolean
  /** User has any eDoc menu view grant. */
  hasEdocAccess?: boolean
  /** eDoc access granted but org and/or signature missing. */
  edocProfileIncomplete?: boolean
  /** ISO timestamp when the user submitted Forgot password; null/undefined when none pending. */
  passwordResetRequestedAt?: string | null
  /** eDoc org membership_role = controller (Document Controller nomination). */
  documentController?: boolean
  permissions: UserPermissions
}

export interface UpdateManagedUserInput {
  role?: UserRole
  active?: boolean
  permissions?: UserPermissions
  documentController?: boolean
}
