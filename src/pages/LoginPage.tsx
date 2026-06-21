import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { AuthProviderButton } from '../components/auth/AuthProviderButtons'
import { FormField, SelectInput, TextInput } from '../components/forms/FormControls'
import { APP_NAME, APP_TAGLINE } from '../config/appNavigation'
import { useAuth } from '../hooks/useAuth'
import { consumeOAuthStatus, getAuthErrorMessage, type OAuthStatus } from '../lib/authMessages'
import type { UserRole } from '../types/auth'

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null)
  const { isAuthenticated, login, signInWithProvider, usesSupabase } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    setOauthStatus(consumeOAuthStatus())
  }, [])

  if (isAuthenticated) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    const data = new FormData(event.currentTarget)

    try {
      await login({
        email: String(data.get('email')),
        password: String(data.get('password')),
        role: usesSupabase ? undefined : (String(data.get('role')) as UserRole),
      })
      navigate('/')
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Sign in failed.'))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleOAuth(provider: 'google' | 'azure') {
    const label = provider === 'google' ? 'Google' : 'Microsoft'
    setIsLoading(true)
    setError(null)
    setOauthStatus({ state: 'loading', message: `Redirecting to ${label}…` })
    try {
      await signInWithProvider(provider)
      setOauthStatus({ state: 'success', message: `Redirecting to ${label} for authentication…` })
    } catch (err) {
      setOauthStatus({ state: 'failure', message: getAuthErrorMessage(err, `${label} sign-in failed.`) })
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand light">
          <div className="brand-mark">GxP</div>
          <div>
            <strong>{APP_NAME}</strong>
            <span>{APP_TAGLINE}</span>
          </div>
        </div>
        <div>
          <span className="eyebrow">Validation Routing Monitoring System</span>
          <h1>Quality operations, composed for reuse.</h1>
          <p>A polished shell for routing documents, signatories, registry values, and audit trail.</p>
        </div>
        <div className="login-proof">
          <strong>{usesSupabase ? 'Supabase backend' : '100% mock data'}</strong>
          <span>{usesSupabase ? 'Live PostgreSQL when configured' : 'Backend-agnostic by design'}</span>
        </div>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <span className="eyebrow">Welcome back</span>
          <h2>Sign in to {APP_NAME}</h2>
          <p>
            {usesSupabase
              ? 'Use your Supabase account or continue with Google or Microsoft.'
              : 'Any password works in this mock environment.'}
          </p>
          <FormField label="Email">
            <TextInput
              name="email"
              type="email"
              defaultValue={usesSupabase ? 'carlolidres@gmail.com' : 'admin@example.com'}
              required
            />
          </FormField>
          <FormField label="Password">
            <TextInput name="password" type="password" defaultValue={usesSupabase ? '' : 'template'} required />
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
          {oauthStatus ? (
            <p className={oauthStatus.state === 'failure' ? 'form-error' : 'form-success'}>
              {oauthStatus.message}
            </p>
          ) : null}
          <button className="button primary wide" disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
          {usesSupabase ? (
            <div className="login-oauth">
              <AuthProviderButton
                provider="google"
                label="Continue with Google"
                disabled={isLoading}
                onClick={() => void handleOAuth('google')}
              />
              <AuthProviderButton
                provider="azure"
                label="Continue with Microsoft"
                disabled={isLoading}
                onClick={() => void handleOAuth('azure')}
              />
            </div>
          ) : (
            <small>Use role selection to test protected UI patterns.</small>
          )}
          <p className="auth-switch">
            Need an account? <button type="button" onClick={() => navigate('/signup')}>Create one</button>
          </p>
        </form>
      </section>
    </div>
  )
}
