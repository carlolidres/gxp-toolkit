import { mockUsers } from '../data/mockAuth'
import { cleanOAuthParamsFromUrl, getSessionOnce } from '../lib/authBootstrap'
import { getAuthRedirectUrl } from '../lib/authRedirect'
import { mapSessionToAuthUser } from '../lib/authMapping'
import { getAuthErrorMessage, rememberOAuthFailure, rememberOAuthStart, rememberOAuthSuccess } from '../lib/authMessages'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import type { AuthUser, LoginCredentials, SignUpCredentials } from '../types/auth'

const SESSION_KEY = 'gxp-toolkit-user'

export type OAuthProvider = 'google' | 'azure'

async function fetchProfileForEmail(email: string) {
  const client = getSupabaseClient()
  if (!client) return null

  const { data, error } = await client
    .from('profiles')
    .select('id, email, display_name, role, auth_user_id, active')
    .eq('email', email)
    .maybeSingle()

  if (error) return null
  return data
}

async function mapSupabaseSessionUser(userId: string, email: string): Promise<AuthUser> {
  const profile = await fetchProfileForEmail(email)
  return mapSessionToAuthUser({
    id: profile?.auth_user_id ?? profile?.id ?? userId,
    profileId: profile?.id,
    email,
    displayName: profile?.display_name,
    role: profile?.role,
    active: profile?.active ?? true,
  })
}

function sessionFallbackUser(session: { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } }): AuthUser {
  return mapSessionToAuthUser({
    id: session.user.id,
    email: session.user.email!,
    displayName: session.user.user_metadata?.display_name as string | undefined,
    role: 'user',
  })
}

async function mockLogin(credentials: LoginCredentials): Promise<AuthUser> {
  await new Promise((resolve) => setTimeout(resolve, 350))
  const user = mockUsers.find((candidate) => candidate.role === credentials.role) ?? mockUsers[0]
  const sessionUser = { ...user, email: credentials.email || user.email }
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
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
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
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

  const sessionUser = await mapSupabaseSessionUser(data.user.id, data.user.email)
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
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

  const sessionUser = await mapSupabaseSessionUser(data.session.user.id, data.session.user.email)
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
  return sessionUser
}

export const authService = {
  usesSupabase(): boolean {
    return isSupabaseConfigured()
  },

  async login(credentials: LoginCredentials): Promise<AuthUser> {
    if (isSupabaseConfigured()) return supabaseLogin(credentials)
    return mockLogin(credentials)
  },

  async signUp(credentials: SignUpCredentials): Promise<AuthUser | null> {
    if (isSupabaseConfigured()) return supabaseSignUp(credentials)
    return mockSignUp(credentials)
  },

  async signInWithProvider(provider: OAuthProvider): Promise<void> {
    const client = getSupabaseClient()
    if (!client) throw new Error('Supabase client is not available.')

    const providerLabel = provider === 'google' ? 'Google' : 'Microsoft'
    rememberOAuthStart(providerLabel)
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: getAuthRedirectUrl() },
    })

    if (error) {
      const message = getAuthErrorMessage(error, `${providerLabel} authentication failed.`)
      rememberOAuthFailure(message)
      throw new Error(message)
    }
  },

  async logout(): Promise<void> {
    const client = getSupabaseClient()
    if (client) await client.auth.signOut()
    localStorage.removeItem(SESSION_KEY)
  },

  getCachedUser(): AuthUser | null {
    const value = localStorage.getItem(SESSION_KEY)
    return value ? (JSON.parse(value) as AuthUser) : null
  },

  /** @deprecated use getCachedUser — kept for compatibility */
  getCurrentUser(): AuthUser | null {
    return this.getCachedUser()
  },

  async restoreSession(): Promise<AuthUser | null> {
    if (!isSupabaseConfigured()) return this.getCachedUser()

    const client = getSupabaseClient()
    if (!client) return this.getCachedUser()

    const callbackUrl = new URL(window.location.href)
    const callbackError =
      callbackUrl.searchParams.get('error_description') ||
      callbackUrl.searchParams.get('error') ||
      ''

    if (callbackError) {
      rememberOAuthFailure(callbackError)
    }

    const { data, error } = await getSessionOnce(client)
    cleanOAuthParamsFromUrl()

    if (error) {
      const message = getAuthErrorMessage(error, 'Could not restore the authentication session.')
      rememberOAuthFailure(message)
      throw new Error(message)
    }

    const session = data.session
    if (!session?.user.email) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }

    const sessionUser = await mapSupabaseSessionUser(session.user.id, session.user.email)
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
    if (callbackUrl.searchParams.has('code')) rememberOAuthSuccess()
    return sessionUser
  },

  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    const client = getSupabaseClient()
    if (!client) return { unsubscribe: () => undefined }

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!session?.user.email) {
        localStorage.removeItem(SESSION_KEY)
        callback(null)
        return
      }

      void mapSupabaseSessionUser(session.user.id, session.user.email)
        .then((sessionUser) => {
          localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
          callback(sessionUser)
        })
        .catch(() => {
          const fallback = sessionFallbackUser(session)
          localStorage.setItem(SESSION_KEY, JSON.stringify(fallback))
          callback(fallback)
        })
    })

    return data.subscription
  },
}
