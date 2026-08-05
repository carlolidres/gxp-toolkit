import { useEffect, useId, useState, type FormEvent } from 'react'
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
import { AuthLegalLinks } from '../components/auth/AuthLegalLinks'
import { AuthStoryCarousel } from '../components/auth/AuthStoryCarousel'
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
  const emailId = useId()
  const passwordId = useId()
  const roleId = useId()
  const errorId = useId()
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

  const inputStatus = error ? 'error' : undefined

  return (
    <div className="login-page">
      <div className="login-story">
        <AuthStoryCarousel />
      </div>

      <section className="login-panel">
        <div className="login-panel-stack">
        <Card className={AUTH_CARD_CLASS} bordered>
          <form
            onSubmit={handleSubmit}
            autoComplete="off"
            aria-labelledby="login-title"
            aria-describedby={error ? errorId : undefined}
            noValidate
          >
            <header className="gxp-auth-header">
              <span className="eyebrow">Welcome back</span>
              <h2 id="login-title">Sign in to {APP_NAME}</h2>
              <p>
                {usesSupabase
                  ? 'Enter your work email and password to continue.'
                  : 'Any password works in this mock environment.'}
              </p>
            </header>

            <div className="gxp-auth-fields">
              <AuthField
                label="Email"
                htmlFor={emailId}
                icon={<Mail size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}
              >
                <TextInput
                  id={emailId}
                  name="email"
                  type="email"
                  className={AUTH_INPUT_CLASS}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@company.com"
                  status={inputStatus}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                />
              </AuthField>

              <AuthField
                label="Password"
                htmlFor={passwordId}
                icon={<Lock size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}
                hint={
                  <button
                    type="button"
                    className="gxp-auth-text-link"
                    onClick={() => navigate('/forgot-password', { state: { email } })}
                  >
                    Forgot password?
                  </button>
                }
              >
                <PasswordInput
                  id={passwordId}
                  name="password"
                  className={AUTH_INPUT_CLASS}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  status={inputStatus}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                />
              </AuthField>

              {!usesSupabase ? (
                <AuthField
                  label="Example role"
                  htmlFor={roleId}
                  icon={<Shield size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}
                >
                  <SelectInput id={roleId} name="role" defaultValue="Admin" className={AUTH_INPUT_CLASS}>
                    <option>Admin</option>
                    <option>Manager</option>
                    <option>Editor</option>
                    <option>Viewer</option>
                  </SelectInput>
                </AuthField>
              ) : null}
            </div>

            {error ? (
              <div id={errorId}>
                <AuthAlert tone="error">{error}</AuthAlert>
              </div>
            ) : null}

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
              <p className="gxp-auth-footnote">Use role selection to test protected UI patterns.</p>
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
                Create an Account
              </Button>
            </div>
          </form>
        </Card>
        <AuthLegalLinks />
        </div>
      </section>
    </div>
  )
}
