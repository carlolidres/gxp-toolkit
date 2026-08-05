import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button, Card } from 'antd'
import {
  KeyRound,
  Lock,
  LogIn,
  Mail,
  User,
  UserPlus,
} from 'lucide-react'

import { PasswordInput, TextInput } from '../components/forms/FormControls'
import { AuthLegalLinks } from '../components/auth/AuthLegalLinks'
import { AuthStoryCarousel } from '../components/auth/AuthStoryCarousel'
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
      <div className="login-story">
        <AuthStoryCarousel />
      </div>

      <section className="login-panel">
        <div className="login-panel-stack">
        <Card className={AUTH_CARD_CLASS} bordered>
          <form onSubmit={handleSubmit} aria-labelledby="signup-title">
            <header className="gxp-auth-header">
              <span className="eyebrow">Create account</span>
              <h2 id="signup-title">Sign up for {APP_NAME}</h2>
              <p>
                {usesSupabase ? 'Register with email and password.' : 'Mock mode creates a local viewer account for testing.'}
              </p>
            </header>

            <div className="gxp-auth-fields">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AuthField label="First name" icon={<User size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}>
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
                <AuthField label="Last name" icon={<User size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}>
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

              <AuthField label="Email" icon={<Mail size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}>
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

              <AuthField label="Password" icon={<Lock size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}>
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

              <AuthField label="Confirm password" icon={<Lock size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}>
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

            <Button
              type="primary"
              htmlType="submit"
              className={AUTH_PRIMARY_BTN_CLASS}
              loading={isLoading}
              icon={!isLoading ? <UserPlus size={iconSize.sm} strokeWidth={iconStroke} aria-hidden /> : undefined}
              block
              size="large"
            >
              {isLoading ? 'Creating account…' : 'Create account'}
            </Button>

            <AuthDivider />

            <div className="auth-secondary-actions">
              <Button
                className={AUTH_GHOST_BTN_CLASS}
                icon={<LogIn size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}
                onClick={() => navigate('/login')}
              >
                Return to Login
              </Button>
              <Button
                className={AUTH_GHOST_BTN_CLASS}
                icon={<KeyRound size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />}
                onClick={() => navigate('/forgot-password', { state: { email: form.email } })}
              >
                Forgot password?
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
