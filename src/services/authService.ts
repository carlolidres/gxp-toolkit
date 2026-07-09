import { mockUsers } from '../data/mockAuth'
import { mockFeedbackService } from './mockFeedbackService'
import {
  MOCK_MUST_CHANGE_PASSWORD_KEY,
  MOCK_PASSWORD_RESET_REQUEST_KEY,
} from '../config/authPasswordPolicy'
import {
  getSessionOnce,
  resetGetSessionOnce,
  resetRestoreSessionOnce,
  runRestoreSessionOnce,
} from '../lib/authBootstrap'
import {
  clearAuthSessionStorage,
  readSessionUserJson,
  writeSessionUserJson,
} from '../lib/authSessionStore'
import { getAuthRedirectUrl } from '../lib/authRedirect'
import { resolveProfileRole } from '../config/authPolicy'
import { joinDisplayName } from '../lib/profileNames'
import { mapSessionToAuthUser } from '../lib/authMapping'
import { getAuthErrorMessage } from '../lib/authMessages'
import { SESSION_USER_KEY } from '../config/sessionPolicy'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import type { AuthUser, LoginCredentials, SignUpCredentials } from '../types/auth'

// ponytail: legacy localStorage sessions are not migrated — force a fresh sign-in
localStorage.removeItem(SESSION_USER_KEY)

export interface UpdateProfileInput {
  firstName: string
  lastName: string
}

export interface PasswordResetResult {
  /** Always true on success; temporary passwords are never returned to the requester. */
  success: true
  message: string
}

interface ProfileRow {
  id: string
  email: string
  display_name: string
  role: string
  auth_user_id: string | null
  active: boolean
  must_change_password?: boolean
}

const profileFetchInflight = new Map<string, Promise<ProfileRow | null>>()

function firstProfileRpcRow(data: unknown): ProfileRow | null {
  if (!data) return null
  if (Array.isArray(data)) return (data[0] as ProfileRow | undefined) ?? null
  return data as ProfileRow
}

async function fetchProfileViaRpc(
  client: NonNullable<ReturnType<typeof getSupabaseClient>>,
): Promise<ProfileRow | null> {
  const { data: ownRows, error: ownError } = await client.rpc('get_own_profile')
  if (ownError) {
    console.warn('[auth] get_own_profile failed:', ownError.message)
  } else {
    const row = firstProfileRpcRow(ownRows)
    if (row) return row
  }

  const { data: profileId, error: idError } = await client.rpc('current_profile_id')
  if (idError) {
    console.warn('[auth] current_profile_id failed:', idError.message)
  } else if (profileId) {
    const { data: byIdRows, error: byIdError } = await client.rpc('get_profile_by_id', {
      target_id: profileId as string,
    })
    if (byIdError) {
      console.warn('[auth] get_profile_by_id failed:', byIdError.message)
    } else {
      const row = firstProfileRpcRow(byIdRows)
      if (row) return row
    }
  }

  return null
}

async function fetchProfileForAuthUser(userId: string, _email: string): Promise<ProfileRow | null> {
  const inflight = profileFetchInflight.get(userId)
  if (inflight) return inflight

  const promise = (async (): Promise<ProfileRow | null> => {
    const client = getSupabaseClient()
    if (!client) return null

    const rpcRow = await fetchProfileViaRpc(client)
    if (rpcRow) return rpcRow

    const { data, error } = await client
      .from('profiles')
      .select('id, email, display_name, role, auth_user_id, active, must_change_password')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (error) return null
    return data as ProfileRow
  })()

  profileFetchInflight.set(userId, promise)
  try {
    return await promise
  } finally {
    profileFetchInflight.delete(userId)
  }
}

async function mapSupabaseSessionUser(userId: string, email: string): Promise<AuthUser> {
  const profile = await fetchProfileForAuthUser(userId, email)
  return mapSessionToAuthUser({
    id: userId,
    profileId: profile?.id,
    email,
    displayName: profile?.display_name,
    role: resolveProfileRole(email, profile?.role),
    active: profile?.active ?? true,
    mustChangePassword: profile?.must_change_password ?? false,
  })
}

function readMockMustChangeStore(): Record<string, boolean> {
  const raw = localStorage.getItem(MOCK_MUST_CHANGE_PASSWORD_KEY)
  return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
}

function writeMockMustChangeStore(store: Record<string, boolean>) {
  localStorage.setItem(MOCK_MUST_CHANGE_PASSWORD_KEY, JSON.stringify(store))
}

function mockMustChangePasswordForEmail(email: string): boolean {
  const key = email.trim().toLowerCase()
  return Boolean(readMockMustChangeStore()[key])
}

export function setMockMustChangePassword(email: string, required: boolean) {
  const store = readMockMustChangeStore()
  const key = email.trim().toLowerCase()
  if (required) store[key] = true
  else delete store[key]
  writeMockMustChangeStore(store)
}

function readMockResetRequestStore(): Record<string, string> {
  const raw = localStorage.getItem(MOCK_PASSWORD_RESET_REQUEST_KEY)
  return raw ? (JSON.parse(raw) as Record<string, string>) : {}
}

function writeMockResetRequestStore(store: Record<string, string>) {
  localStorage.setItem(MOCK_PASSWORD_RESET_REQUEST_KEY, JSON.stringify(store))
}

export function setMockPasswordResetRequested(email: string, requestedAt: string | null) {
  const store = readMockResetRequestStore()
  const key = email.trim().toLowerCase()
  if (requestedAt) store[key] = requestedAt
  else delete store[key]
  writeMockResetRequestStore(store)
}

export function getMockPasswordResetRequestedAt(email: string): string | null {
  return readMockResetRequestStore()[email.trim().toLowerCase()] ?? null
}

function sessionFallbackUser(session: { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } }): AuthUser {
  const email = session.user.email!
  return mapSessionToAuthUser({
    id: session.user.id,
    email,
    displayName: session.user.user_metadata?.display_name as string | undefined,
    role: resolveProfileRole(email),
  })
}

async function mockLogin(credentials: LoginCredentials): Promise<AuthUser> {
  await new Promise((resolve) => setTimeout(resolve, 350))
  const user = mockUsers.find((candidate) => candidate.role === credentials.role) ?? mockUsers[0]
  const sessionUser = {
    ...user,
    email: credentials.email || user.email,
    mustChangePassword: mockMustChangePasswordForEmail(credentials.email || user.email),
  }
  writeSessionUserJson(JSON.stringify(sessionUser))
  return sessionUser
}

async function mockSignUp(credentials: SignUpCredentials): Promise<AuthUser> {
  await new Promise((resolve) => setTimeout(resolve, 350))
  const firstName = credentials.firstName.trim()
  const lastName = credentials.lastName.trim()
  const name = `${firstName} ${lastName}`.trim()
  const sessionUser: AuthUser = {
    id: `mock-${Date.now()}`,
    name,
    email: credentials.email.trim(),
    role: 'Viewer',
    initials: `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || 'VR',
    active: true,
  }
  writeSessionUserJson(JSON.stringify(sessionUser))
  return sessionUser
}

async function supabaseLogin(credentials: LoginCredentials): Promise<AuthUser> {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase client is not available.')

  const { data, error } = await client.auth.signInWithPassword({
    email: credentials.email.trim(),
    password: credentials.password,
  })

  if (error) throw new Error(getAuthErrorMessage(error, 'Sign in failed.'))
  if (!data.user?.email) throw new Error('Supabase sign-in succeeded but no user email was returned.')

  resetGetSessionOnce()
  const sessionUser = await mapSupabaseSessionUser(data.user.id, data.user.email)
  writeSessionUserJson(JSON.stringify(sessionUser))
  return sessionUser
}

async function supabaseSignUp(credentials: SignUpCredentials): Promise<AuthUser | null> {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase client is not available.')

  const firstName = credentials.firstName.trim()
  const lastName = credentials.lastName.trim()
  const displayName = `${firstName} ${lastName}`.trim()
  const { data, error } = await client.auth.signUp({
    email: credentials.email.trim(),
    password: credentials.password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: {
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
      },
    },
  })

  if (error) throw new Error(getAuthErrorMessage(error, 'Sign up failed.'))
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error(getAuthErrorMessage('already registered', 'An account already exists for this email.'))
  }
  if (!data.session?.user.email) return null

  resetGetSessionOnce()
  const sessionUser = await mapSupabaseSessionUser(data.session.user.id, data.session.user.email)
  writeSessionUserJson(JSON.stringify(sessionUser))
  return sessionUser
}

async function clearStoredSession(): Promise<void> {
  const client = getSupabaseClient()
  try {
    if (client) await client.auth.signOut({ scope: 'local' })
  } catch (err) {
    console.warn('[auth] signOut failed; clearing local session anyway:', err)
  }
  clearAuthSessionStorage()
  resetGetSessionOnce()
  resetRestoreSessionOnce()
}

export const authService = {
  usesSupabase(): boolean {
    return isSupabaseConfigured()
  },

  async login(credentials: LoginCredentials): Promise<AuthUser> {
    if (isSupabaseConfigured()) return supabaseLogin(credentials)
    if (import.meta.env.PROD) {
      throw new Error('Sign-in is not configured for this deployment.')
    }
    return mockLogin(credentials)
  },

  async signUp(credentials: SignUpCredentials): Promise<AuthUser | null> {
    if (isSupabaseConfigured()) return supabaseSignUp(credentials)
    if (import.meta.env.PROD) {
      throw new Error('Sign-up is not configured for this deployment.')
    }
    return mockSignUp(credentials)
  },

  async logout(): Promise<void> {
    await clearStoredSession()
  },

  async requestPasswordReset(email: string): Promise<PasswordResetResult> {
    const normalized = email.trim().toLowerCase()
    if (!normalized) throw new Error('A valid email address is required.')

    const accepted: PasswordResetResult = {
      success: true,
      message:
        'If an account exists for that email, an administrator has been notified. You will receive a temporary password by email after approval.',
    }

    if (!isSupabaseConfigured()) {
      await new Promise((resolve) => setTimeout(resolve, 350))
      const user = mockUsers.find((candidate) => candidate.email.toLowerCase() === normalized)
      if (user) {
        setMockPasswordResetRequested(normalized, new Date().toISOString())
        await mockFeedbackService.submitMessage(
          { ...user, profileId: user.id },
          {
            category: 'improvement',
            content: `[Password reset request] ${user.name} (${user.email}) requested a password reset. Open User Management and click Reset Password beside this account to approve.`,
          },
        )
      }
      return accepted
    }

    const client = getSupabaseClient()
    if (!client) throw new Error('Supabase client is not available.')

    const { data, error } = await client.functions.invoke('forgot-password', {
      body: { email: normalized },
    })

    if (error) throw new Error(getAuthErrorMessage(error, 'Password reset request failed.'))
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      throw new Error(getAuthErrorMessage(String(data.error), 'Password reset request failed.'))
    }

    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
      return { success: true, message: data.message }
    }

    return accepted
  },

  async checkTemporaryPasswordRequired(email: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return false
    if (!isSupabaseConfigured()) return mockMustChangePasswordForEmail(normalized)

    const client = getSupabaseClient()
    if (!client) return false

    const { data, error } = await client.rpc('check_temporary_password_required', { p_email: normalized })
    if (error) return false
    return Boolean(data)
  },

  async clearMustChangePassword(): Promise<void> {
    if (!isSupabaseConfigured()) {
      const cached = this.getCachedUser()
      if (cached?.email) setMockMustChangePassword(cached.email, false)
      return
    }

    const client = getSupabaseClient()
    if (!client) throw new Error('Supabase client is not available.')

    const { error } = await client.rpc('clear_must_change_password')
    if (error) throw new Error(getAuthErrorMessage(error, 'Could not clear the password-change requirement.'))
  },

  async updatePassword(newPassword: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      const cached = this.getCachedUser()
      if (cached?.email) {
        setMockMustChangePassword(cached.email, false)
        const sessionUser = { ...cached, mustChangePassword: false }
        writeSessionUserJson(JSON.stringify(sessionUser))
      }
      return
    }

    const client = getSupabaseClient()
    if (!client) throw new Error('Supabase client is not available.')

    const { error } = await client.auth.updateUser({ password: newPassword })
    if (error) throw new Error(getAuthErrorMessage(error, 'Password update failed.'))

    await this.clearMustChangePassword()
  },

  async updateProfile(input: UpdateProfileInput): Promise<AuthUser> {
    if (!isSupabaseConfigured()) {
      const cached = this.getCachedUser()
      if (!cached) throw new Error('No signed-in user.')
      const name = joinDisplayName(input.firstName, input.lastName)
      const sessionUser = { ...cached, name, initials: `${input.firstName[0] ?? ''}${input.lastName[0] ?? ''}`.toUpperCase() || cached.initials }
      writeSessionUserJson(JSON.stringify(sessionUser))
      return sessionUser
    }

    const client = getSupabaseClient()
    if (!client) throw new Error('Supabase client is not available.')

    const firstName = input.firstName.trim()
    const lastName = input.lastName.trim()
    const displayName = joinDisplayName(firstName, lastName)
    const { data: authData, error: authError } = await client.auth.updateUser({
      data: {
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
      },
    })
    if (authError) throw new Error(getAuthErrorMessage(authError, 'Profile update failed.'))
    if (!authData.user?.email) throw new Error('Profile update succeeded but no user email was returned.')

    const normalizedEmail = authData.user.email.trim().toLowerCase()
    const { data: updatedProfiles, error: profileError } = await client
      .from('profiles')
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .or(`auth_user_id.eq.${authData.user.id},email.ilike.${normalizedEmail}`)
      .select('id')

    if (profileError) throw new Error(getAuthErrorMessage(profileError, 'Profile update failed.'))
    if (!updatedProfiles?.length) {
      throw new Error('Profile update failed because no matching profile row was found.')
    }

    const sessionUser = await mapSupabaseSessionUser(authData.user.id, authData.user.email)
    writeSessionUserJson(JSON.stringify(sessionUser))
    return sessionUser
  },

  async hasSupabaseSession(): Promise<boolean> {
    const client = getSupabaseClient()
    if (!client) return false
    const { data } = await client.auth.getSession()
    return Boolean(data.session)
  },

  async clearSupabaseSession(): Promise<void> {
    await clearStoredSession()
  },

  getCachedUser(): AuthUser | null {
    const value = readSessionUserJson()
    if (!value) return null
    try {
      return JSON.parse(value) as AuthUser
    } catch {
      console.warn('[auth] Ignoring invalid cached session user JSON')
      sessionStorage.removeItem(SESSION_USER_KEY)
      return null
    }
  },

  /** @deprecated use getCachedUser — kept for compatibility */
  getCurrentUser(): AuthUser | null {
    return this.getCachedUser()
  },

  async restoreSession(): Promise<AuthUser | null> {
    return runRestoreSessionOnce(async () => {
      if (!isSupabaseConfigured()) {
        return this.getCachedUser()
      }

      const client = getSupabaseClient()
      if (!client) return this.getCachedUser()

      resetGetSessionOnce()
      const callbackUrl = new URL(window.location.href)
      const callbackError =
        callbackUrl.searchParams.get('error_description') ||
        callbackUrl.searchParams.get('error') ||
        ''

      if (callbackError) {
        throw new Error(getAuthErrorMessage(callbackError, 'Authentication callback failed.'))
      }

      const { data, error } = await getSessionOnce(client)

      if (error) {
        console.error('[auth] getSession failed:', error.message)
        throw new Error(getAuthErrorMessage(error, 'Could not restore the authentication session.'))
      }

      const session = data.session
      if (!session?.user.email) {
        clearAuthSessionStorage()
        await client.auth.signOut({ scope: 'local' }).catch(() => undefined)
        return null
      }

      const sessionUser = await mapSupabaseSessionUser(session.user.id, session.user.email)
      writeSessionUserJson(JSON.stringify(sessionUser))
      return sessionUser
    })
  },

  onAuthStateChange(callback: (user: AuthUser | null, event?: string) => void) {
    const client = getSupabaseClient()
    if (!client) return { unsubscribe: () => undefined }

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        resetGetSessionOnce()
      }
      if (!session?.user.email) {
        callback(null, event)
        return
      }

      void mapSupabaseSessionUser(session.user.id, session.user.email)
        .then((sessionUser) => {
          writeSessionUserJson(JSON.stringify(sessionUser))
          callback(sessionUser, event)
        })
        .catch(() => {
          const fallback = sessionFallbackUser(session)
          writeSessionUserJson(JSON.stringify(fallback))
          callback(fallback, event)
        })
    })

    return data.subscription
  },
}
