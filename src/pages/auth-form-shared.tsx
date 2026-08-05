import type { ReactNode } from 'react'
import { Alert, Divider } from 'antd'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

import { iconSize, iconStroke } from '../theme/iconSizes'

export const AUTH_INPUT_CLASS = 'gxp-auth-input'

export const AUTH_CARD_CLASS = 'login-card-modern gxp-auth-card'

export const AUTH_PRIMARY_BTN_CLASS = 'gxp-auth-primary-btn'

export const AUTH_GHOST_BTN_CLASS = 'gxp-auth-ghost-btn'

/** Split long auth messages into a short title + supporting detail for scannable alerts. */
export function splitAuthAlertMessage(message: string): { title: string; detail?: string } {
  const text = message.trim()
  const breakAt = text.indexOf('. ')
  if (breakAt > 12 && breakAt < 90) {
    return {
      title: text.slice(0, breakAt + 1),
      detail: text.slice(breakAt + 2).trim() || undefined,
    }
  }
  return { title: text }
}

export function AuthField({
  label,
  icon,
  htmlFor,
  hint,
  children,
}: {
  label: string
  icon: ReactNode
  htmlFor?: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="gxp-auth-field">
      <div className="gxp-auth-field-top">
        <label className="gxp-auth-label" htmlFor={htmlFor}>
          <span className="gxp-auth-label-icon" aria-hidden>
            {icon}
          </span>
          {label}
        </label>
        {hint ? <div className="gxp-auth-field-hint">{hint}</div> : null}
      </div>
      {children}
    </div>
  )
}

export function AuthDivider({ label = 'OR' }: { label?: string }) {
  return (
    <Divider plain className="gxp-auth-divider">
      {label}
    </Divider>
  )
}

export function AuthAlert({
  tone,
  children,
}: {
  tone: 'error' | 'success'
  children: ReactNode
}) {
  const isError = tone === 'error'
  const text = typeof children === 'string' ? children : null
  const split = text ? splitAuthAlertMessage(text) : null

  return (
    <Alert
      className={`gxp-auth-alert gxp-auth-alert--${tone}`}
      type={isError ? 'error' : 'success'}
      showIcon
      role="alert"
      aria-live="assertive"
      icon={
        isError ? (
          <AlertCircle size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
        ) : (
          <CheckCircle2 size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
        )
      }
      message={split?.title ?? children}
      description={split?.detail}
    />
  )
}
