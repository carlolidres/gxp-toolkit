function truthyFlag(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

/**
 * C15: production builds stay off until VITE_ENABLE_CPV=true.
 * Local `npm run dev` shows CPV unless the flag is explicitly false.
 */
export function isCpvEnabled(): boolean {
  const raw = import.meta.env.VITE_ENABLE_CPV
  if (raw == null || String(raw).trim() === '') return Boolean(import.meta.env.DEV)
  return truthyFlag(String(raw))
}
