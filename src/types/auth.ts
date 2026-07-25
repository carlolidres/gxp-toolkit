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
  /** Set when an admin reset the account to the default temporary password */
  mustChangePassword?: boolean
  /** PNG signature as a data URL (transparent backgrounds allowed) */
  signatureDataUrl?: string | null
  /** Employer / organization label from Account Settings */
  organization?: string | null
  /** Job position / title from Account Settings */
  jobTitle?: string | null
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
