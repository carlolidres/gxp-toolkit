import type { AuthUser, UserRole } from '../types/auth'
import type { VrmsProfileRole } from '../types/vrms'

export function initialsFromName(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
  }
  if (name.trim()) return name.trim().slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

export function mapVrmsRoleToUserRole(role: VrmsProfileRole | string | undefined): UserRole {
  switch (role?.toLowerCase()) {
    case 'admin':
      return 'Admin'
    case 'manager':
      return 'Manager'
    case 'editor':
      return 'Editor'
    case 'viewer':
      return 'Viewer'
    case 'user':
    default:
      return 'Editor'
  }
}

export function mapUserRoleToProfileRole(role: UserRole): VrmsProfileRole {
  switch (role) {
    case 'Admin':
      return 'admin'
    case 'Manager':
      return 'manager'
    case 'Editor':
      return 'editor'
    case 'Viewer':
      return 'viewer'
  }
}

export function mapSessionToAuthUser(input: {
  id: string
  email: string
  displayName?: string
  role?: VrmsProfileRole | string
  profileId?: string
  active?: boolean
}): AuthUser {
  const name = input.displayName?.trim() || input.email.split('@')[0]
  return {
    id: input.id,
    profileId: input.profileId,
    email: input.email,
    name,
    role: mapVrmsRoleToUserRole(input.role),
    initials: initialsFromName(name, input.email),
    active: input.active ?? true,
  }
}
