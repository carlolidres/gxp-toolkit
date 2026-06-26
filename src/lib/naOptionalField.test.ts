import { describe, expect, it } from 'vitest'

import {
  NA_OPTIONAL_VALUE,
  displayNaOptionalValue,
  isNaOptionalValue,
  normalizeNaOptionalValue,
  onNaOptionalBlur,
  onNaOptionalFocus,
  resolveNaOptionalDisplayValue,
  shouldShowNaOptionalStyle,
} from './naOptionalField'

describe('naOptionalField', () => {
  it('treats empty and n/a variants as N/A', () => {
    expect(isNaOptionalValue('')).toBe(true)
    expect(isNaOptionalValue('n/a')).toBe(true)
    expect(isNaOptionalValue('N/A')).toBe(true)
    expect(isNaOptionalValue(' real ')).toBe(false)
  })

  it('displays N/A for placeholder values', () => {
    expect(displayNaOptionalValue('n/a')).toBe(NA_OPTIONAL_VALUE)
    expect(displayNaOptionalValue('Batch 1')).toBe('Batch 1')
  })

  it('normalizes placeholder values to n/a storage', () => {
    expect(normalizeNaOptionalValue('N/A')).toBe('n/a')
    expect(normalizeNaOptionalValue('note')).toBe('note')
  })

  it('clears on focus and restores on blur when empty', () => {
    let value = 'n/a'
    const set = (next: string) => {
      value = next
    }
    onNaOptionalFocus(value, set)
    expect(value).toBe('')
    onNaOptionalBlur(value, set)
    expect(value).toBe(NA_OPTIONAL_VALUE)
  })

  it('shows an empty string while focused so the field stays editable', () => {
    expect(resolveNaOptionalDisplayValue('', true)).toBe('')
    expect(resolveNaOptionalDisplayValue('n/a', true)).toBe('n/a')
    expect(resolveNaOptionalDisplayValue('', false)).toBe(NA_OPTIONAL_VALUE)
    expect(shouldShowNaOptionalStyle('', false)).toBe(true)
    expect(shouldShowNaOptionalStyle('', true)).toBe(false)
    expect(shouldShowNaOptionalStyle('Saved note', false)).toBe(false)
  })
})
