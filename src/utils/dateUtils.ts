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

/** Accept dd Mmm YYYY or YYYY-MM-DD and return YYYY-MM-DD. */
export function parseAppDate(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const iso = parseIsoDate(trimmed)
    if (!iso || !isRealDate(iso.year, iso.month, iso.day)) return null
    return trimmed
  }
  const match = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(trimmed)
  if (!match) return null
  const day = Number(match[1])
  const month = APP_MONTHS.findIndex((name) => name.toLowerCase() === match[2].toLowerCase()) + 1
  const year = Number(match[3])
  if (!month || !isRealDate(year, month, day)) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/** Parse YYYY-MM (optional day/time suffix) without timezone drift. */
export function parseIsoMonthYear(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})/.exec(value.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null

  return { year, month }
}

/** Display format for month filters: Mmm YYYY (e.g. Jul 2026). */
export function formatAppMonthYear(value: string | null | undefined, empty = '—'): string {
  if (!value?.trim()) return empty

  const parts = parseIsoMonthYear(value)
  if (!parts) return value

  return `${APP_MONTHS[parts.month - 1]} ${parts.year}`
}

/** Current calendar month as YYYY-MM. */
export function currentAppMonthYear(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** True when an ISO date falls in the given YYYY-MM month. */
export function dateInAppMonthYear(isoDate: string | null | undefined, monthYear: string): boolean {
  if (!monthYear.trim()) return true
  if (!isoDate?.trim()) return false
  return isoDate.trim().slice(0, 7) === monthYear.trim()
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
