import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
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
import { AUTH_CARD_CLASS, AUTH_INPUT_CLASS, AuthField } from './auth-form-shared'
import './login-page.css'

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(() => consumeLoginFlash())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetTemporaryPassword, setResetTemporaryPassword] = useState<string | null>(null)
  const [resetStatus, setResetStatus] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const { isAuthenticated, authReady, login, usesSupabase, requestPasswordReset, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authReady || isAuthenticated) return
    setEmail('')
    setPassword('')
  }, [authReady, isAuthenticated])

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

  async function sendPasswordReset() {
    setResetTemporaryPassword(null)
    setResetStatus(null)
    setResetError(null)

    const address = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setResetError('Enter the email address used for your account above.')
      return
    }

    setResetLoading(true)
    try {
      const { temporaryPassword } = await requestPasswordReset(address)
      setResetTemporaryPassword(temporaryPassword)
      setPassword(temporaryPassword)
      setResetStatus(
        usesSupabase
          ? 'Your password was reset to the temporary password below. Sign in, then create a new password.'
          : 'Mock mode: use the temporary password below, then create a new password.',
      )
    } catch (err) {
      setResetError(getAuthErrorMessage(err, 'Password reset request failed.'))
    } finally {
      setResetLoading(false)
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

          {error ? (
            <p
              className="mt-4 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] px-3 py-2.5 text-sm text-[var(--danger)]"
              role="alert"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          ) : null}

          <button
            type="submit"
            className="button primary wide mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
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

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-semibold text-[var(--teal)] transition-colors hover:text-[color-mix(in_srgb,var(--teal)_80%,var(--navy))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow-ring)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={resetLoading}
              onClick={() => void sendPasswordReset()}
            >
              {resetLoading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="size-3.5" aria-hidden="true" />
              )}
              {resetLoading ? 'Resetting password…' : 'Forgot password?'}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-semibold text-[var(--teal)] transition-colors hover:text-[color-mix(in_srgb,var(--teal)_80%,var(--navy))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow-ring)]"
              onClick={() => navigate('/signup')}
            >
              <UserPlus className="size-3.5" aria-hidden="true" />
              Sign-up
            </button>
          </div>

          {resetError ? (
            <p
              className="mt-4 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] px-3 py-2.5 text-sm text-[var(--danger)]"
              role="alert"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{resetError}</span>
            </p>
          ) : null}

          {resetStatus ? (
            <p
              className="mt-4 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--teal)_40%,var(--border))] bg-[color-mix(in_srgb,var(--teal)_10%,var(--surface))] px-3 py-2.5 text-sm text-[var(--teal)]"
              role="status"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{resetStatus}</span>
            </p>
          ) : null}

          {resetTemporaryPassword ? (
            <div
              className="mt-4 space-y-2 rounded-lg border border-[color-mix(in_srgb,var(--teal)_35%,var(--border))] bg-[color-mix(in_srgb,var(--teal)_8%,var(--surface))] px-4 py-3"
              role="status"
            >
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--teal)]">Temporary password</span>
              <code className="block break-all text-lg font-bold tracking-wide text-[var(--navy)]">
                {resetTemporaryPassword}
              </code>
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                Use this password to sign in. You must choose a new password before accessing the app.
              </p>
            </div>
          ) : null}
        </form>
      </section>
    </div>
  )
}
