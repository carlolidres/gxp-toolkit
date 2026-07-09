import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export const AUTH_INPUT_CLASS =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--app-text)] shadow-sm transition-[border-color,box-shadow] placeholder:text-[var(--muted)] focus-visible:border-[var(--teal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow-ring)] disabled:cursor-not-allowed disabled:opacity-60'

export const AUTH_CARD_CLASS =
  'login-card-modern w-full max-w-[440px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-8'

export const AUTH_PRIMARY_BTN_CLASS =
  'button primary wide mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

export const AUTH_GHOST_BTN_CLASS =
  'auth-ghost-btn inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--teal)] transition-[border-color,background-color,color] hover:border-[color-mix(in_srgb,var(--teal)_42%,var(--border))] hover:bg-[color-mix(in_srgb,var(--teal)_6%,var(--surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow-ring)] disabled:cursor-not-allowed disabled:opacity-60'

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
  return (
    <div className="auth-divider" role="separator" aria-label={label}>
      <span>{label}</span>
    </div>
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
  return (
    <p
      className={
        isError
          ? 'mt-4 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] px-3 py-2.5 text-sm text-[var(--danger)]'
          : 'mt-4 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--teal)_40%,var(--border))] bg-[color-mix(in_srgb,var(--teal)_10%,var(--surface))] px-3 py-2.5 text-sm text-[var(--teal)]'
      }
      role={isError ? 'alert' : 'status'}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <span>{children}</span>
    </p>
  )
}
