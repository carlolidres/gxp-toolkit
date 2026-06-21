import type { ReactNode } from 'react'

type AuthProvider = 'google' | 'azure'

interface AuthProviderButtonProps {
  provider: AuthProvider
  label: string
  disabled?: boolean
  onClick: () => void
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.43Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.34l-3.24-2.51c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.75-5.59-4.11H3.07v2.59A9.99 9.99 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.99a6.02 6.02 0 0 1 0-3.98V7.42H3.07a10.01 10.01 0 0 0 0 9.16l3.34-2.59Z" />
      <path fill="#EA4335" d="M12 5.9c1.47 0 2.8.51 3.84 1.5l2.88-2.88C16.97 2.9 14.7 2 12 2a9.99 9.99 0 0 0-8.93 5.42l3.34 2.59C7.2 7.65 9.4 5.9 12 5.9Z" />
    </svg>
  )
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#F25022" d="M3 3h8.5v8.5H3V3Z" />
      <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5V3Z" />
      <path fill="#00A4EF" d="M3 12.5h8.5V21H3v-8.5Z" />
      <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5v-8.5Z" />
    </svg>
  )
}

function ProviderLogo({ provider }: { provider: AuthProvider }): ReactNode {
  return provider === 'google' ? <GoogleLogo /> : <MicrosoftLogo />
}

export function AuthProviderButton({
  provider,
  label,
  disabled,
  onClick,
}: AuthProviderButtonProps) {
  return (
    <button type="button" className="auth-provider-button" disabled={disabled} onClick={onClick}>
      <span className="auth-provider-logo">{ProviderLogo({ provider })}</span>
      <span>{label}</span>
    </button>
  )
}

