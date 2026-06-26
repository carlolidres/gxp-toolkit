import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { FormField, PasswordInput } from '../components/forms/FormControls'
import { GxpLogo } from '../components/brand/GxpLogo'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage } from '../lib/authMessages'

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
      <div className="login-page">
        <section className="login-panel">
          <div className="login-card">
            <p>Preparing password reset…</p>
          </div>
        </section>
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
        <GxpLogo variant="full" tone="light" />
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <span className="eyebrow">Password reset</span>
          <h2>{mandatoryChange ? 'Create your new password' : 'Choose a new password'}</h2>
          {mandatoryChange ? (
            <p>Your administrator reset your account. Choose a new password before continuing.</p>
          ) : null}
          <FormField label="New password">
            <PasswordInput
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="new-password"
            />
          </FormField>
          <FormField label="Confirm password">
            <PasswordInput
              name="confirmPassword"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              autoComplete="new-password"
            />
          </FormField>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="button primary wide" disabled={isLoading}>
            {isLoading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>
    </div>
  )
}
