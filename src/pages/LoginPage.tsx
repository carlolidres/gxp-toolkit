import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, Spin } from 'antd'
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
import { iconSize, iconStroke } from '../theme/iconSizes'
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
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <Spin
          tip="Restoring session…"
          indicator={<Loader2 className="anticon-spin" size={iconSize.lg} strokeWidth={iconStroke} aria-hidden />}
        />
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
        <GxpLogo variant="lockup" showTagline tone="light" className="login-story-brand" />
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
        <Card className={AUTH_CARD_CLASS} bordered>
          <form onSubmit={handleSubmit} autoComplete="off" aria-labelledby="login-title">
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
              <AuthField label="Email" icon={<Mail size={iconSize.xs} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />}>
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

              <AuthField label="Password" icon={<Lock size={iconSize.xs} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />}>
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
                <AuthField label="Example role" icon={<Shield size={iconSize.xs} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />}>
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

            <Button
              type="primary"
              htmlType="submit"
              className={AUTH_PRIMARY_BTN_CLASS}
              loading={isLoading}
              icon={!isLoading ? <LogIn size={iconSize.sm} strokeWidth={iconStroke} aria-hidden /> : undefined}
              block
              size="large"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>

            {!usesSupabase ? (
              <p className="mt-3 text-center text-xs text-[var(--muted)]">
                Use role selection to test protected UI patterns.
              </p>
            ) : null}

            <AuthDivider />

            <div className="auth-secondary-actions">
              <Button
                className={AUTH_GHOST_BTN_CLASS}
                icon={<KeyRound size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}
                onClick={() => navigate('/forgot-password', { state: { email } })}
              >
                Forgot password?
              </Button>
              <Button
                className={AUTH_GHOST_BTN_CLASS}
                icon={<UserPlus size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}
                onClick={() => navigate('/signup')}
              >
                Sign up
              </Button>
            </div>
          </form>
        </Card>
      </section>
    </div>
  )
}
