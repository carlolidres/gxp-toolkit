import type { ReactNode } from 'react'

export const AUTH_INPUT_CLASS =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--app-text)] shadow-sm transition-[border-color,box-shadow] placeholder:text-[var(--muted)] focus-visible:border-[var(--teal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow-ring)] disabled:cursor-not-allowed disabled:opacity-60'

export const AUTH_CARD_CLASS =
  'login-card-modern w-full max-w-[440px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-8'

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
