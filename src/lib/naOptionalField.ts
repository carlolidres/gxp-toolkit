export const NA_OPTIONAL_VALUE = 'N/A'

export function isNaOptionalValue(value: string | undefined | null): boolean {
  const text = String(value ?? '').trim()
  return !text || text.toLowerCase() === 'n/a'
}

export function displayNaOptionalValue(value: string | undefined | null): string {
  return isNaOptionalValue(value) ? NA_OPTIONAL_VALUE : String(value)
}

/** When focused, show the raw value so an emptied field stays editable instead of snapping back to N/A. */
export function resolveNaOptionalDisplayValue(
  value: string | undefined | null,
  focused: boolean,
): string {
  if (focused) return String(value ?? '')
  return displayNaOptionalValue(value)
}

export function shouldShowNaOptionalStyle(value: string | undefined | null, focused: boolean): boolean {
  return !focused && isNaOptionalValue(value)
}

export function normalizeNaOptionalValue(value: string | undefined | null): string {
  return isNaOptionalValue(value) ? 'n/a' : String(value).trim()
}

export function onNaOptionalFocus(value: string, onChange: (next: string) => void): void {
  if (isNaOptionalValue(value)) onChange('')
}

export function onNaOptionalBlur(value: string, onChange: (next: string) => void): void {
  if (!String(value).trim()) onChange(NA_OPTIONAL_VALUE)
}
