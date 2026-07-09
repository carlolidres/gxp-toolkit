import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  Shield,
  UserPlus,
} from 'lucide-react'

import { PasswordInput, SelectInput, TextInput } from '../components/forms/FormControls'
import { GxpLogo } from '../components/brand/GxpLogo'
import { APP_NAME } from '../config/appNavigation'
import { useAuth } from '../hooks/useAuth'
import { consumeLoginFlash } from '../lib/authSessionStore'
import { getAuthErrorMessage } from '../lib/authMessages'
import {
  AUTH_CARD_CLASS,
  AUTH_GHOST_BTN_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_PRIMARY_BTN_CLASS,
  AuthAlert,
  AuthDivider,
  AuthField,
} from './auth-form-shared'
import './login-page.css'

function readEmailFromState(state: unknown): string {
  if (typeof state === 'object' && state && 'email' in state) {
    const value = (state as { email?: unknown }).email
    if (typeof value === 'string') return value
  }
  return ''
}

export function LoginPage() {
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(() => consumeLoginFlash())
  const [email, setEmail] = useState(() => readEmailFromState(location.state))
  const [password, setPassword] = useState('')
  const { isAuthenticated, authReady, login, usesSupabase, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authReady || isAuthenticated) return
    const fromState = readEmailFromState(location.state)
    setEmail(fromState)
    setPassword('')
  }, [authReady, isAuthenticated, location.state])

  if (!authReady) {
    return (
      <div
        className="flex min-h-screen items-center justify-center gap-3 text-[var(--muted)]"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-5 animate-spin text-[var(--teal)]" aria-hidden="true" />
        <span>Restoring session…</span>
      </div>
    )
  }

  if (isAuthenticated) {
    if (user?.mustChangePassword) return <Navigate to="/reset-password" replace />
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    const data = new FormData(event.currentTarget)

    try {
      const sessionUser = await login({
        email: String(data.get('email')),
        password: String(data.get('password')),
        role: usesSupabase ? undefined : (String(data.get('role')) as import('../types/auth').UserRole),
      })
      navigate(sessionUser.mustChangePassword ? '/reset-password' : '/')
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Sign in failed.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-story">
        <GxpLogo variant="full" tone="light" />
        <div>
          <span className="eyebrow">Validation Routing Monitoring System</span>
          <h1>Quality operations, composed for reuse.</h1>
          <p>A polished shell for routing documents, signatories, registry values, and audit trail.</p>
        </div>
        <div className="login-proof">
          <strong>{usesSupabase ? 'Supabase backend' : '100% mock data'}</strong>
          <span>{usesSupabase ? 'Email and password sign-in' : 'Backend-agnostic by design'}</span>
        </div>
      </section>

      <section className="login-panel">
        <form
          className={AUTH_CARD_CLASS}
          onSubmit={handleSubmit}
          autoComplete="off"
          aria-labelledby="login-title"
        >
          <header className="mb-6 space-y-2">
            <span className="eyebrow">Welcome back</span>
            <h2 id="login-title" className="text-2xl font-bold tracking-tight text-[var(--navy)] sm:text-[1.65rem]">
              Sign in to {APP_NAME}
            </h2>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              {usesSupabase ? 'Use your email and password.' : 'Any password works in this mock environment.'}
            </p>
          </header>

          <div className="flex flex-col gap-4">
            <AuthField label="Email" icon={<Mail className="size-3.5 text-[var(--teal)]" aria-hidden="true" />}>
              <TextInput
                name="email"
                type="email"
                className={AUTH_INPUT_CLASS}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
              />
            </AuthField>

            <AuthField label="Password" icon={<Lock className="size-3.5 text-[var(--teal)]" aria-hidden="true" />}>
              <PasswordInput
                name="password"
                className={AUTH_INPUT_CLASS}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            </AuthField>

            {!usesSupabase ? (
              <AuthField label="Example role" icon={<Shield className="size-3.5 text-[var(--teal)]" aria-hidden="true" />}>
                <SelectInput name="role" defaultValue="Admin" className={AUTH_INPUT_CLASS}>
                  <option>Admin</option>
                  <option>Manager</option>
                  <option>Editor</option>
                  <option>Viewer</option>
                </SelectInput>
              </AuthField>
            ) : null}
          </div>

          {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}

          <button type="submit" className={AUTH_PRIMARY_BTN_CLASS} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="size-4" aria-hidden="true" />
            )}
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>

          {!usesSupabase ? (
            <p className="mt-3 text-center text-xs text-[var(--muted)]">
              Use role selection to test protected UI patterns.
            </p>
          ) : null}

          <AuthDivider />

          <div className="auth-secondary-actions">
            <button
              type="button"
              className={AUTH_GHOST_BTN_CLASS}
              onClick={() => navigate('/forgot-password', { state: { email } })}
            >
              <KeyRound className="size-3.5" aria-hidden="true" />
              Forgot password?
            </button>
            <button type="button" className={AUTH_GHOST_BTN_CLASS} onClick={() => navigate('/signup')}>
              <UserPlus className="size-3.5" aria-hidden="true" />
              Sign up
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
