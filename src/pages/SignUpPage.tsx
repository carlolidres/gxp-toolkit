import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  User,
  UserPlus,
} from 'lucide-react'

import { PasswordInput, TextInput } from '../components/forms/FormControls'
import { GxpLogo } from '../components/brand/GxpLogo'
import { APP_NAME } from '../config/appNavigation'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage } from '../lib/authMessages'
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
  const { isAuthenticated, signUp, usesSupabase } = useAuth()
  const navigate = useNavigate()

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

  return (
    <div className="login-page">
      <section className="login-story">
        <GxpLogo variant="full" tone="light" />
        <div>
          <span className="eyebrow">Join VRMS</span>
          <h1>Create a validated routing workspace account.</h1>
          <p>Start with a reusable GxP shell for routing, audit trail, and Supabase-backed permissions.</p>
        </div>
        <div className="login-proof">
          <strong>{usesSupabase ? 'Supabase Auth' : 'Mock sign-up'}</strong>
          <span>{usesSupabase ? 'Email and password registration' : 'Creates a local mock viewer session'}</span>
        </div>
      </section>

      <section className="login-panel">
        <form className={AUTH_CARD_CLASS} onSubmit={handleSubmit} aria-labelledby="signup-title">
          <header className="mb-6 space-y-2">
            <span className="eyebrow">Create account</span>
            <h2 id="signup-title" className="text-2xl font-bold tracking-tight text-[var(--navy)] sm:text-[1.65rem]">
              Sign up for {APP_NAME}
            </h2>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              {usesSupabase ? 'Register with email and password.' : 'Mock mode creates a local viewer account for testing.'}
            </p>
          </header>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AuthField label="First name" icon={<User className="size-3.5 text-[var(--teal)]" aria-hidden="true" />}>
                <TextInput
                  name="firstName"
                  className={AUTH_INPUT_CLASS}
                  value={form.firstName}
                  onChange={(event) => updateField('firstName', event.target.value)}
                  required
                  autoComplete="given-name"
                  placeholder="First name"
                />
              </AuthField>
              <AuthField label="Last name" icon={<User className="size-3.5 text-[var(--teal)]" aria-hidden="true" />}>
                <TextInput
                  name="lastName"
                  className={AUTH_INPUT_CLASS}
                  value={form.lastName}
                  onChange={(event) => updateField('lastName', event.target.value)}
                  required
                  autoComplete="family-name"
                  placeholder="Last name"
                />
              </AuthField>
            </div>

            <AuthField label="Email" icon={<Mail className="size-3.5 text-[var(--teal)]" aria-hidden="true" />}>
              <TextInput
                name="email"
                type="email"
                className={AUTH_INPUT_CLASS}
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
              />
            </AuthField>

            <AuthField label="Password" icon={<Lock className="size-3.5 text-[var(--teal)]" aria-hidden="true" />}>
              <PasswordInput
                name="password"
                className={AUTH_INPUT_CLASS}
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                required
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
            </AuthField>

            <AuthField label="Confirm password" icon={<Lock className="size-3.5 text-[var(--teal)]" aria-hidden="true" />}>
              <PasswordInput
                name="confirmPassword"
                className={AUTH_INPUT_CLASS}
                value={form.confirmPassword}
                onChange={(event) => updateField('confirmPassword', event.target.value)}
                required
                autoComplete="new-password"
                placeholder="Re-enter password"
              />
            </AuthField>
          </div>

          {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}
          {success ? <AuthAlert tone="success">{success}</AuthAlert> : null}

          <button type="submit" className={AUTH_PRIMARY_BTN_CLASS} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <UserPlus className="size-4" aria-hidden="true" />
            )}
            {isLoading ? 'Creating account…' : 'Create account'}
          </button>

          <AuthDivider />

          <div className="auth-secondary-actions">
            <button type="button" className={AUTH_GHOST_BTN_CLASS} onClick={() => navigate('/login')}>
              <LogIn className="size-3.5" aria-hidden="true" />
              Sign in
            </button>
            <button
              type="button"
              className={AUTH_GHOST_BTN_CLASS}
              onClick={() => navigate('/forgot-password', { state: { email: form.email } })}
            >
              <KeyRound className="size-3.5" aria-hidden="true" />
              Forgot password?
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
