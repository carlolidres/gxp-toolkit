import { vmpMasterlistConfig } from './vmpMasterlistConfig'

export type CalculatedDueStatus = 'Overdue' | 'DueSoon' | 'Current'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

function parseDateOnly(value: string): Date | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function getDueMonth(nextDueDate: string): string {
  const parsed = parseDateOnly(nextDueDate)
  if (!parsed) return ''
  return MONTH_NAMES[parsed.getMonth()] ?? ''
}

export function getDueYear(nextDueDate: string): string {
  const parsed = parseDateOnly(nextDueDate)
  if (!parsed) return ''
  return String(parsed.getFullYear())
}

export function getDaysRemaining(nextDueDate: string, now = new Date()): number | null {
  const due = parseDateOnly(nextDueDate)
  if (!due) return null
  const today = startOfDay(now)
  const dueDay = startOfDay(due)
  return Math.ceil((dueDay.getTime() - today.getTime()) / 86_400_000)
}

export function getCalculatedDueStatus(
  nextDueDate: string,
  now = new Date(),
  warningDays = vmpMasterlistConfig.dueSoonWarningDays,
): CalculatedDueStatus | null {
  const days = getDaysRemaining(nextDueDate, now)
  if (days === null) return null
  if (days < 0) return 'Overdue'
  if (days <= warningDays) return 'DueSoon'
  return 'Current'
}

export function isDueSoonByDate(nextDueDate: string, now = new Date(), warningDays = vmpMasterlistConfig.dueSoonWarningDays): boolean {
  return getCalculatedDueStatus(nextDueDate, now, warningDays) === 'DueSoon'
}
