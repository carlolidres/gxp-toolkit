import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

import {
  onNaOptionalBlur,
  onNaOptionalFocus,
  resolveNaOptionalDisplayValue,
  shouldShowNaOptionalStyle,
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
  const [focused, setFocused] = useState(false)
  const showNa = shouldShowNaOptionalStyle(value, focused)
  const classes = [className, showNa ? 'is-na' : ''].filter(Boolean).join(' ') || undefined

  return (
    <input
      {...props}
      className={classes}
      value={resolveNaOptionalDisplayValue(value, focused)}
      onFocus={(event) => {
        setFocused(true)
        onNaOptionalFocus(value, onChange)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        onNaOptionalBlur(event.target.value, onChange)
        onBlur?.(event)
      }}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function NaOptionalTextarea({ value, onChange, className, onFocus, onBlur, ...props }: NaOptionalTextareaProps) {
  const [focused, setFocused] = useState(false)
  const showNa = shouldShowNaOptionalStyle(value, focused)
  const classes = [className, showNa ? 'is-na' : ''].filter(Boolean).join(' ') || undefined

  return (
    <textarea
      {...props}
      className={classes}
      value={resolveNaOptionalDisplayValue(value, focused)}
      onFocus={(event) => {
        setFocused(true)
        onNaOptionalFocus(value, onChange)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        onNaOptionalBlur(event.target.value, onChange)
        onBlur?.(event)
      }}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
