import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { FormField, PasswordInput, SelectInput, TextInput } from '../components/forms/FormControls'
import { GxpLogo } from '../components/brand/GxpLogo'
import { APP_NAME } from '../config/appNavigation'
import { useAuth } from '../hooks/useAuth'
import { consumeLoginFlash } from '../lib/authSessionStore'
import { getAuthErrorMessage } from '../lib/authMessages'

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(() => consumeLoginFlash())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    return <p className="auth-loading">Restoring session…</p>
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
      await login({
        email: String(data.get('email')),
        password: String(data.get('password')),
        role: usesSupabase ? undefined : (String(data.get('role')) as import('../types/auth').UserRole),
      })
      navigate('/')
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Sign in failed.'))
    } finally {
      setIsLoading(false)
    }
  }

  async function sendPasswordReset() {
    setResetStatus(null)
    setResetError(null)

    const address = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setResetError('Enter the email address used for your account above.')
      return
    }

    setResetLoading(true)
    try {
      await requestPasswordReset(address)
      setResetStatus(
        usesSupabase
          ? 'Password reset instructions were sent if the account exists.'
          : 'Password reset request accepted in mock mode.',
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
        <form className="login-card" onSubmit={handleSubmit} autoComplete="off">
          <span className="eyebrow">Welcome back</span>
          <h2>Sign in to {APP_NAME}</h2>
          <p>{usesSupabase ? 'Use your email and password.' : 'Any password works in this mock environment.'}</p>
          <FormField label="Email">
            <TextInput
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </FormField>
          <FormField label="Password">
            <PasswordInput
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </FormField>
          {!usesSupabase ? (
            <FormField label="Example role">
              <SelectInput name="role" defaultValue="Admin">
                <option>Admin</option>
                <option>Manager</option>
                <option>Editor</option>
                <option>Viewer</option>
              </SelectInput>
            </FormField>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
          <button className="button primary wide" disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
          {!usesSupabase ? <small>Use role selection to test protected UI patterns.</small> : null}
          <div className="auth-footer">
            <button type="button" className="auth-footer-link" disabled={resetLoading} onClick={() => void sendPasswordReset()}>
              {resetLoading ? 'Sending reset link…' : 'Forgot password?'}
            </button>
            <button type="button" className="auth-footer-link" onClick={() => navigate('/signup')}>
              Sign-up
            </button>
          </div>
          {resetError ? <p className="form-error">{resetError}</p> : null}
          {resetStatus ? <p className="form-success">{resetStatus}</p> : null}
        </form>
      </section>
    </div>
  )
}
