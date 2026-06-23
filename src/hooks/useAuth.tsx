import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { authService } from '../services/authService'
import type { AuthUser, LoginCredentials, SignUpCredentials, UserRole } from '../types/auth'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  /** False while Supabase session is being restored on first load */
  authReady: boolean
  usesSupabase: boolean
  passwordRecoveryActive: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  signUp: (credentials: SignUpCredentials) => Promise<AuthUser | null>
  requestPasswordReset: (email: string) => Promise<void>
  checkTemporaryPasswordRequired: (email: string) => Promise<boolean>
  updatePassword: (newPassword: string) => Promise<void>
  updateProfile: (input: { firstName: string; lastName: string }) => Promise<void>
  refreshUser: () => Promise<void>
  clearPasswordRecovery: () => void
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
    a?.active === b?.active &&
    a?.mustChangePassword === b?.mustChangePassword
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => authService.getCachedUser())
  const [ready, setReady] = useState(!authService.usesSupabase())
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(false)

  const setUserIfChanged = useCallback((nextUser: AuthUser | null) => {
    setUser((current) => (isSameUser(current, nextUser) ? current : nextUser))
  }, [])

  useEffect(() => {
    if (!authService.usesSupabase()) return

    let active = true
    if (window.location.hash.includes('type=recovery')) {
      setPasswordRecoveryActive(true)
    }
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

    const subscription = authService.onAuthStateChange((sessionUser, event) => {
      if (active) {
        setUserIfChanged(sessionUser)
        if (event === 'PASSWORD_RECOVERY') setPasswordRecoveryActive(true)
      }
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
      passwordRecoveryActive,
      login: async (credentials) => setUserIfChanged(await authService.login(credentials)),
      signUp: async (credentials) => {
        const sessionUser = await authService.signUp(credentials)
        if (sessionUser) setUserIfChanged(sessionUser)
        return sessionUser
      },
      requestPasswordReset: async (email) => authService.requestPasswordReset(email),
      checkTemporaryPasswordRequired: async (email) => authService.checkTemporaryPasswordRequired(email),
      updatePassword: async (newPassword) => {
        await authService.updatePassword(newPassword)
        setPasswordRecoveryActive(false)
        setUserIfChanged(await authService.restoreSession())
      },
      updateProfile: async (input) => setUserIfChanged(await authService.updateProfile(input)),
      refreshUser: async () => setUserIfChanged(await authService.restoreSession()),
      clearPasswordRecovery: () => setPasswordRecoveryActive(false),
      logout: async () => {
        await authService.logout()
        setUserIfChanged(null)
        setPasswordRecoveryActive(false)
      },
      hasRole: (roles) => Boolean(user && roles.includes(user.role)),
    }),
    [passwordRecoveryActive, ready, setUserIfChanged, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
