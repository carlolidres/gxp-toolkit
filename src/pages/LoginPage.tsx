import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { FormField, SelectInput, TextInput } from '../components/forms/FormControls'
import { APP_NAME } from '../config/appNavigation'
import { ADMIN_DEFAULT_RESET_PASSWORD } from '../config/authPasswordPolicy'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage } from '../lib/authMessages'

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [temporaryPasswordRequired, setTemporaryPasswordRequired] = useState(false)
  const { isAuthenticated, login, usesSupabase, checkTemporaryPasswordRequired, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!usesSupabase || !email.trim()) {
      setTemporaryPasswordRequired(false)
      return
    }

    let active = true
    const timer = window.setTimeout(() => {
      void checkTemporaryPasswordRequired(email)
        .then((required) => {
          if (active) setTemporaryPasswordRequired(required)
        })
        .catch(() => {
          if (active) setTemporaryPasswordRequired(false)
        })
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [checkTemporaryPasswordRequired, email, usesSupabase])

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

  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand light">
          <div className="brand-mark">GxP</div>
          <div>
            <strong>{APP_NAME}</strong>
            <span>Validation Routing Monitoring System</span>
          </div>
        </div>
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
        <form className="login-card" onSubmit={handleSubmit}>
          <span className="eyebrow">Welcome back</span>
          <h2>Sign in to {APP_NAME}</h2>
          <p>{usesSupabase ? 'Use your email and password.' : 'Any password works in this mock environment.'}</p>
          {!usesSupabase ? (
            <FormField label="Email">
              <TextInput name="email" type="email" defaultValue="admin@example.com" required />
            </FormField>
          ) : (
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
          )}
          {usesSupabase && temporaryPasswordRequired ? (
            <p className="auth-switch auth-temporary-password">
              Your administrator reset your password. Temporary password: <strong>{ADMIN_DEFAULT_RESET_PASSWORD}</strong>
            </p>
          ) : null}
          <FormField label="Password">
            <TextInput name="password" type="password" defaultValue={usesSupabase ? '' : 'template'} required />
          </FormField>
          {usesSupabase ? (
            <p className="auth-switch">
              Forgot your password? Contact your administrator to reset it.
            </p>
          ) : null}
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
          <p className="auth-switch">
            Need an account? <button type="button" onClick={() => navigate('/signup')}>Create one</button>
          </p>
        </form>
      </section>
    </div>
  )
}
