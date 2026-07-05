const APP_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** Parse YYYY-MM-DD (optional time suffix) without timezone drift. */
export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  return { year, month, day }
}

/** Display format used across the app: dd Mmm YYYY (e.g. 01 Jan 2025). */
export function formatAppDate(value: string | null | undefined, empty = '—'): string {
  if (!value?.trim()) return empty

  const parts = parseIsoDate(value)
  if (!parts) return value

  return `${String(parts.day).padStart(2, '0')} ${APP_MONTHS[parts.month - 1]} ${parts.year}`
}

/** Date + time display: dd Mmm YYYY, hh:mm am/pm */
export function formatAppDateTime(value: string | null | undefined, empty = '—'): string {
  if (!value?.trim()) return empty

  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value

  const pad = (n: number) => String(n).padStart(2, '0')
  const day = pad(d.getDate())
  const month = APP_MONTHS[d.getMonth()]
  const year = d.getFullYear()
  const hours = d.getHours()
  const hour12 = hours % 12 || 12
  const ampm = hours >= 12 ? 'pm' : 'am'

  return `${day} ${month} ${year}, ${pad(hour12)}:${pad(d.getMinutes())} ${ampm}`
}

export function formatDate(value: string): string {
  if (!value?.trim()) return ''
  const formatted = formatAppDate(value, '')
  return formatted || value
}

export function daysUntil(value: string): number {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000)
}
