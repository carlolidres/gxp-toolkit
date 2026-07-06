import type { ApqrDatabaseRow } from './types'
import { classifyDelivery, calendarDaysBetween, isCancelledReportStatus } from './scheduling'

export interface MonthlyDeliveryPoint {
  label: string
  monthKey: string
  delivered: number
  onTime: number
  overdue: number
  onTimeRate: number
}

export function buildMonthlyDeliveryTrend(rows: ApqrDatabaseRow[], months = 12): MonthlyDeliveryPoint[] {
  const today = new Date()
  const points: MonthlyDeliveryPoint[] = []

  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1))
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const label = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d)

    const monthRows = rows.filter((row) => {
      if (!row.final_apqr_delivery_date) return false
      return row.final_apqr_delivery_date.startsWith(monthKey)
    })

    const onTime = monthRows.filter((r) => r.delivery_classification === 'Delivered On Time').length
    const overdue = monthRows.filter((r) => r.delivery_classification === 'Delivered Overdue').length
    const delivered = monthRows.length

    points.push({
      label,
      monthKey,
      delivered,
      onTime,
      overdue,
      onTimeRate: delivered ? Math.round((onTime / delivered) * 100) : 0,
    })
  }

  return points
}

export const DELAY_CATEGORIES = [
  'Client Approval Delay',
  'Stability Data Delay',
  'Testing or Laboratory Delay',
  'APQR Preparation Delay',
  'Data or Document Availability Delay',
  'Internal Review or Approval Delay',
  'Regulatory Requirement',
  'Resource or Manpower Constraint',
  'Scheduling Issue',
  'System or Technical Issue',
  'Other',
] as const

export function requiresDelayInfo(
  commitmentSchedule: string,
  finalDeliveryDate: string | null,
): boolean {
  if (!finalDeliveryDate) return false
  return finalDeliveryDate > commitmentSchedule
}

export function computeDaysOverdue(commitmentSchedule: string, finalDeliveryDate: string): number {
  return Math.max(0, calendarDaysBetween(commitmentSchedule, finalDeliveryDate))
}

export function deliveryFieldsFromInput(
  commitmentSchedule: string,
  finalDeliveryDate: string | null,
  delayCategory: string | null,
  delayReason: string | null,
  apqrReportStatus?: string | null,
) {
  if (isCancelledReportStatus(apqrReportStatus)) {
    return { delivery_classification: 'NA' as const, days_early_or_overdue: null }
  }

  const delivery_classification = classifyDelivery(commitmentSchedule, finalDeliveryDate)
  const days_early_or_overdue =
    finalDeliveryDate != null ? calendarDaysBetween(commitmentSchedule, finalDeliveryDate) : null

  if (requiresDelayInfo(commitmentSchedule, finalDeliveryDate)) {
    if (!delayCategory?.trim()) throw new Error('Delay Category is required for overdue delivery.')
    if (!delayReason?.trim()) throw new Error('Delay Reason is required for overdue delivery.')
    if (delayCategory === 'Other' && delayReason.trim().length < 5) {
      throw new Error('Please specify the delay category when Other is selected.')
    }
  }

  return { delivery_classification, days_early_or_overdue }
}

export function nextFollowUpDueDate(fromIso: string): string {
  const d = new Date(`${fromIso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 7)
  return d.toISOString().slice(0, 10)
}
