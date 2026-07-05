import type { InputHTMLAttributes } from 'react'

import { formatAppDate } from '../../utils/dateUtils'

export function AppDateInput({
  className,
  value,
  disabled,
  readOnly,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  className?: string
}) {
  const isoValue = typeof value === 'string' ? value : ''
  const display = formatAppDate(isoValue, '')
  const wrapperClass = ['app-date-input', className].filter(Boolean).join(' ')

  return (
    <div className={wrapperClass}>
      <span className="app-date-input-display" aria-hidden="true">
        {display || <span className="app-date-input-placeholder">dd Mmm yyyy</span>}
      </span>
      <input
        {...props}
        type="date"
        className="app-date-input-native"
        value={isoValue}
        disabled={disabled}
        readOnly={readOnly}
      />
    </div>
  )
}
