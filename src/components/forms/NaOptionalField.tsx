import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

import {
  displayNaOptionalValue,
  isNaOptionalValue,
  onNaOptionalBlur,
  onNaOptionalFocus,
} from '../../lib/naOptionalField'

type NaOptionalInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

type NaOptionalTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

export function NaOptionalInput({ value, onChange, className, onFocus, onBlur, ...props }: NaOptionalInputProps) {
  const displayNa = isNaOptionalValue(value)
  const classes = [className, displayNa ? 'is-na' : ''].filter(Boolean).join(' ') || undefined

  return (
    <input
      {...props}
      className={classes}
      value={displayNaOptionalValue(value)}
      onFocus={(event) => {
        onNaOptionalFocus(value, onChange)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        onNaOptionalBlur(event.target.value, onChange)
        onBlur?.(event)
      }}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function NaOptionalTextarea({ value, onChange, className, onFocus, onBlur, ...props }: NaOptionalTextareaProps) {
  const displayNa = isNaOptionalValue(value)
  const classes = [className, displayNa ? 'is-na' : ''].filter(Boolean).join(' ') || undefined

  return (
    <textarea
      {...props}
      className={classes}
      value={displayNaOptionalValue(value)}
      onFocus={(event) => {
        onNaOptionalFocus(value, onChange)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        onNaOptionalBlur(event.target.value, onChange)
        onBlur?.(event)
      }}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
