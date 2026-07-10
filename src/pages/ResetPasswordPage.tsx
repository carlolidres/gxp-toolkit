import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button, Card, Spin } from 'antd'
import { KeyRound, Loader2, Lock } from 'lucide-react'

import { PasswordInput } from '../components/forms/FormControls'
import { GxpLogo } from '../components/brand/GxpLogo'
import { APP_NAME } from '../config/appNavigation'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage } from '../lib/authMessages'
import { iconSize, iconStroke } from '../theme/iconSizes'
import {
  AUTH_CARD_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_PRIMARY_BTN_CLASS,
  AuthAlert,
  AuthField,
} from './auth-form-shared'
import './login-page.css'

export function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { authReady, isAuthenticated, passwordRecoveryActive, user, updatePassword, clearPasswordRecovery } = useAuth()
  const navigate = useNavigate()

  const mandatoryChange = Boolean(user?.mustChangePassword)
  const canAccess = isAuthenticated && (passwordRecoveryActive || mandatoryChange)

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <Spin
          tip="Preparing password reset…"
          indicator={<Loader2 className="anticon-spin" size={iconSize.lg} strokeWidth={iconStroke} aria-hidden />}
        />
      </div>
    )
  }

  if (!canAccess) {
    return <Navigate to="/login" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)
    try {
      await updatePassword(password)
      clearPasswordRecovery()
      navigate(mandatoryChange ? '/' : '/login', { replace: true })
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Password update failed.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-story">
        <GxpLogo variant="lockup" showTagline />
        <div>
          <span className="eyebrow">Password reset</span>
          <h1>{mandatoryChange ? 'Create a new password to continue.' : 'Choose a secure new password.'}</h1>
          <p>
            {mandatoryChange
              ? 'Your temporary password worked. Set a permanent password before entering the app.'
              : 'Complete recovery by choosing a new password for your account.'}
          </p>
        </div>
        <div className="login-proof">
          <strong>{APP_NAME}</strong>
          <span>Password must be at least 8 characters</span>
        </div>
      </section>

      <section className="login-panel">
        <Card className={AUTH_CARD_CLASS} bordered>
          <form onSubmit={handleSubmit} aria-labelledby="reset-title">
            <header className="mb-6 space-y-2">
              <span className="eyebrow">Password reset</span>
              <h2 id="reset-title" className="text-2xl font-bold tracking-tight text-[var(--navy)] sm:text-[1.65rem]">
                {mandatoryChange ? 'Create your new password' : 'Choose a new password'}
              </h2>
              {mandatoryChange ? (
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  Your password was reset. Choose a new password before continuing.
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  Enter and confirm your new password.
                </p>
              )}
            </header>

            <div className="flex flex-col gap-4">
              <AuthField label="New password" icon={<Lock size={iconSize.xs} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />}>
                <PasswordInput
                  name="password"
                  className={AUTH_INPUT_CLASS}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                />
              </AuthField>
              <AuthField label="Confirm password" icon={<Lock size={iconSize.xs} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />}>
                <PasswordInput
                  name="confirmPassword"
                  className={AUTH_INPUT_CLASS}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                />
              </AuthField>
            </div>

            {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}

            <Button
              type="primary"
              htmlType="submit"
              className={AUTH_PRIMARY_BTN_CLASS}
              loading={isLoading}
              icon={!isLoading ? <KeyRound size={iconSize.sm} strokeWidth={iconStroke} aria-hidden /> : undefined}
              block
              size="large"
            >
              {isLoading ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </Card>
      </section>
    </div>
  )
}
