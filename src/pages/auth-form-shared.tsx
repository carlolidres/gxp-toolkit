import type { ReactNode } from 'react'
import { Alert, Divider } from 'antd'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

import { iconSize, iconStroke } from '../theme/iconSizes'

export const AUTH_INPUT_CLASS = 'gxp-auth-input'

export const AUTH_CARD_CLASS = 'login-card-modern gxp-auth-card'

export const AUTH_PRIMARY_BTN_CLASS = 'gxp-auth-primary-btn'

export const AUTH_GHOST_BTN_CLASS = 'gxp-auth-ghost-btn'

export function AuthField({
  label,
  icon,
  children,
}: {
  label: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {icon}
        {label}
      </span>
      {children}
    </label>
  )
}

export function AuthDivider({ label = 'OR' }: { label?: string }) {
  return <Divider plain>{label}</Divider>
}

export function AuthAlert({
  tone,
  children,
}: {
  tone: 'error' | 'success'
  children: ReactNode
}) {
  const isError = tone === 'error'
  return (
    <Alert
      className="mt-4"
      type={isError ? 'error' : 'success'}
      showIcon
      icon={
        isError ? (
          <AlertCircle size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
        ) : (
          <CheckCircle2 size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
        )
      }
      message={children}
    />
  )
}
