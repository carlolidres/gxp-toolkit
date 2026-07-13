import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, Spin } from 'antd'
import { ArrowLeft, KeyRound, Loader2, LogIn, Mail } from 'lucide-react'

import { TextInput } from '../components/forms/FormControls'
import { GxpLogo } from '../components/brand/GxpLogo'
import { APP_NAME } from '../config/appNavigation'
import { useAuth } from '../hooks/useAuth'
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

export function ForgotPasswordPage() {
  const location = useLocation()
  const initialEmail =
    typeof location.state === 'object' &&
    location.state &&
    'email' in location.state &&
    typeof (location.state as { email?: unknown }).email === 'string'
      ? (location.state as { email: string }).email
      : ''

  const [email, setEmail] = useState(initialEmail)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const { isAuthenticated, authReady, requestPasswordReset, usesSupabase, user } = useAuth()
  const navigate = useNavigate()

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
    setError(null)
    setStatus(null)

    const address = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Enter the email address used for your account.')
      return
    }

    setIsLoading(true)
    try {
      const result = await requestPasswordReset(address)
      setStatus(result.message)
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Password reset request failed.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-story">
        <GxpLogo variant="lockup" showTagline tone="light" className="login-story-brand" />
        <div>
          <span className="eyebrow">Account recovery</span>
          <h1>Request a reset. An administrator must approve it.</h1>
          <p>
            Submit your registered email. After an administrator approves the request, a temporary password is sent to
            that address.
          </p>
        </div>
        <div className="login-proof">
          <strong>{usesSupabase ? 'Admin-approved reset' : 'Mock admin-approved reset'}</strong>
          <span>No temporary password is shown on this page</span>
        </div>
      </section>

      <section className="login-panel">
        <Card className={AUTH_CARD_CLASS} bordered>
          <form onSubmit={handleSubmit} aria-labelledby="forgot-title">
            <header className="mb-6 space-y-2">
              <span className="eyebrow">Forgot password</span>
              <h2 id="forgot-title" className="text-2xl font-bold tracking-tight text-[var(--navy)] sm:text-[1.65rem]">
                Reset your {APP_NAME} password
              </h2>
              <p className="text-sm leading-relaxed text-[var(--muted)]">
                Enter the email for your account. An administrator will review the request and email you a temporary
                password if approved.
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
            </div>

            {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}
            {status ? <AuthAlert tone="success">{status}</AuthAlert> : null}

            <Button
              type="primary"
              htmlType="submit"
              className={AUTH_PRIMARY_BTN_CLASS}
              loading={isLoading}
              icon={!isLoading ? <KeyRound size={iconSize.sm} strokeWidth={iconStroke} aria-hidden /> : undefined}
              block
              size="large"
            >
              {isLoading ? 'Submitting request…' : 'Request password reset'}
            </Button>

            <AuthDivider />

            <div className="auth-secondary-actions">
              <Button
                className={AUTH_GHOST_BTN_CLASS}
                icon={<ArrowLeft size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}
                onClick={() => navigate('/login')}
              >
                Back to sign in
              </Button>
              <Button
                className={AUTH_GHOST_BTN_CLASS}
                icon={<LogIn size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}
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
