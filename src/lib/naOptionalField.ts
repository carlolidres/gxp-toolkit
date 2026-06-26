export const NA_OPTIONAL_VALUE = 'N/A'

export function isNaOptionalValue(value: string | undefined | null): boolean {
  const text = String(value ?? '').trim()
  return !text || text.toLowerCase() === 'n/a'
}

export function displayNaOptionalValue(value: string | undefined | null): string {
  return isNaOptionalValue(value) ? NA_OPTIONAL_VALUE : String(value)
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
