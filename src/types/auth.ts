export type UserRole = 'Admin' | 'Manager' | 'Editor' | 'Viewer'

export interface AuthUser {
  id: string
  /** Supabase profiles.id — used for permission storage */
  profileId?: string
  name: string
  email: string
  role: UserRole
  initials: string
  active?: boolean
}

export interface LoginCredentials {
  email: string
  password: string
  /** Mock mode only — ignored when Supabase Auth is configured */
  role?: UserRole
}

export interface SignUpCredentials {
  firstName: string
  lastName: string
  email: string
  password: string
}
