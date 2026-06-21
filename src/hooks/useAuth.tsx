import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { authService } from '../services/authService'
import type { AuthUser, LoginCredentials, SignUpCredentials, UserRole } from '../types/auth'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  /** False while Supabase session is being restored on first load */
  authReady: boolean
  usesSupabase: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  signUp: (credentials: SignUpCredentials) => Promise<AuthUser | null>
  signInWithProvider: (provider: 'google' | 'azure') => Promise<void>
  logout: () => Promise<void>
  hasRole: (roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isSameUser(a: AuthUser | null, b: AuthUser | null): boolean {
  return (
    a?.id === b?.id &&
    a?.profileId === b?.profileId &&
    a?.email === b?.email &&
    a?.name === b?.name &&
    a?.role === b?.role &&
    a?.active === b?.active
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => authService.getCachedUser())
  const [ready, setReady] = useState(!authService.usesSupabase())

  const setUserIfChanged = useCallback((nextUser: AuthUser | null) => {
    setUser((current) => (isSameUser(current, nextUser) ? current : nextUser))
  }, [])

  useEffect(() => {
    if (!authService.usesSupabase()) return

    let active = true
    void authService
      .restoreSession()
      .then((sessionUser) => {
        if (active) setUserIfChanged(sessionUser)
      })
      .catch(() => {
        if (active) setUserIfChanged(null)
      })
      .finally(() => {
        setReady(true)
      })

    const subscription = authService.onAuthStateChange((sessionUser) => {
      if (active) setUserIfChanged(sessionUser)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [setUserIfChanged])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: ready ? user : null,
      isAuthenticated: ready ? Boolean(user) : false,
      authReady: ready,
      usesSupabase: authService.usesSupabase(),
      login: async (credentials) => setUserIfChanged(await authService.login(credentials)),
      signUp: async (credentials) => {
        const sessionUser = await authService.signUp(credentials)
        if (sessionUser) setUserIfChanged(sessionUser)
        return sessionUser
      },
      signInWithProvider: async (provider) => {
        await authService.signInWithProvider(provider)
      },
      logout: async () => {
        await authService.logout()
        setUserIfChanged(null)
      },
      hasRole: (roles) => Boolean(user && roles.includes(user.role)),
    }),
    [ready, setUserIfChanged, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
