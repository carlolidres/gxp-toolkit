import type { InputHTMLAttributes } from 'react'

import { formatAppDate, formatAppMonthYear } from '../../utils/dateUtils'

export function AppDateInput({
  className,
  value,
  disabled,
  readOnly,
  picker = 'date',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  className?: string
  /** `month` uses native month input and displays Mmm YYYY. */
  picker?: 'date' | 'month'
}) {
  const isoValue = typeof value === 'string' ? value : ''
  const isMonth = picker === 'month'
  const display = isMonth ? formatAppMonthYear(isoValue, '') : formatAppDate(isoValue, '')
  const wrapperClass = ['app-date-input', className].filter(Boolean).join(' ')

  return (
    <div className={wrapperClass}>
      <span className="app-date-input-display" aria-hidden="true">
        {display || (
          <span className="app-date-input-placeholder">{isMonth ? 'Mmm yyyy' : 'dd Mmm yyyy'}</span>
        )}
      </span>
      <input
        {...props}
        type={isMonth ? 'month' : 'date'}
        className="app-date-input-native"
        value={isoValue}
        disabled={disabled}
        readOnly={readOnly}
      />
    </div>
  )
}
