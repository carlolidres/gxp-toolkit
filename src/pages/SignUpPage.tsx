import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { AuthProviderButton } from '../components/auth/AuthProviderButtons'
import { FormField, TextInput } from '../components/forms/FormControls'
import { APP_NAME, APP_TAGLINE } from '../config/appNavigation'
import { useAuth } from '../hooks/useAuth'
import { consumeOAuthStatus, getAuthErrorMessage, type OAuthStatus } from '../lib/authMessages'

interface SignUpForm {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
}

const initialForm: SignUpForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

function validateForm(form: SignUpForm): string | null {
  if (!form.firstName.trim()) return 'First name is required.'
  if (!form.lastName.trim()) return 'Last name is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid email address.'
  if (form.password.length < 8) return 'Password must be at least 8 characters.'
  if (form.password !== form.confirmPassword) return 'Passwords do not match.'
  return null
}

export function SignUpPage() {
  const [form, setForm] = useState<SignUpForm>(initialForm)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null)
  const { isAuthenticated, signUp, signInWithProvider, usesSupabase } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    setOauthStatus(consumeOAuthStatus())
  }, [])

  if (isAuthenticated) return <Navigate to="/" replace />

  function updateField(field: keyof SignUpForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const validationError = validateForm(form)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)
    try {
      const sessionUser = await signUp({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
      })
      if (sessionUser) {
        navigate('/')
      } else {
        setSuccess('Account created. Check your email to confirm your account before signing in.')
      }
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Sign up failed.'))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleOAuth(provider: 'google' | 'azure') {
    const label = provider === 'google' ? 'Google' : 'Microsoft'
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    setOauthStatus({ state: 'loading', message: `Redirecting to ${label}…` })
    try {
      await signInWithProvider(provider)
      setOauthStatus({ state: 'success', message: `Redirecting to ${label} for authentication…` })
    } catch (err) {
      setOauthStatus({ state: 'failure', message: getAuthErrorMessage(err, `${label} sign-up failed.`) })
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
          <span className="eyebrow">Join VRMS</span>
          <h1>Create a validated routing workspace account.</h1>
          <p>Start with a reusable GxP shell for routing, audit trail, and Supabase-backed permissions.</p>
        </div>
        <div className="login-proof">
          <strong>{usesSupabase ? 'Supabase Auth' : 'Mock sign-up'}</strong>
          <span>{usesSupabase ? 'Email/password, Google, and Microsoft' : 'Creates a local mock viewer session'}</span>
        </div>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <span className="eyebrow">Create account</span>
          <h2>Sign up for {APP_NAME}</h2>
          <p>
            {usesSupabase
              ? 'Use email and password, or continue with Google or Microsoft.'
              : 'Mock mode creates a local viewer account for testing.'}
          </p>
          <div className="auth-name-grid">
            <FormField label="First Name">
              <TextInput
                name="firstName"
                value={form.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
                required
              />
            </FormField>
            <FormField label="Last Name">
              <TextInput
                name="lastName"
                value={form.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
                required
              />
            </FormField>
          </div>
          <FormField label="Email Address">
            <TextInput
              name="email"
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              required
            />
          </FormField>
          <FormField label="Password">
            <TextInput
              name="password"
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              required
            />
          </FormField>
          <FormField label="Confirm Password">
            <TextInput
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={(event) => updateField('confirmPassword', event.target.value)}
              required
            />
          </FormField>
          {error ? <p className="form-error">{error}</p> : null}
          {success ? <p className="form-success">{success}</p> : null}
          {oauthStatus ? (
            <p className={oauthStatus.state === 'failure' ? 'form-error' : 'form-success'}>
              {oauthStatus.message}
            </p>
          ) : null}
          <button className="button primary wide" disabled={isLoading}>
            {isLoading ? 'Creating account…' : 'Create account'}
          </button>
          {usesSupabase ? (
            <div className="login-oauth">
              <AuthProviderButton
                provider="google"
                label="Sign up with Google"
                disabled={isLoading}
                onClick={() => void handleOAuth('google')}
              />
              <AuthProviderButton
                provider="azure"
                label="Sign up with Microsoft"
                disabled={isLoading}
                onClick={() => void handleOAuth('azure')}
              />
            </div>
          ) : null}
          <p className="auth-switch">
            Already have an account? <button type="button" onClick={() => navigate('/login')}>Sign in</button>
          </p>
        </form>
      </section>
    </div>
  )
}
