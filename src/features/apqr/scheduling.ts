import type { ApqrDatabaseRow, ApqrPriority, DeliveryClassification } from './types'

const MS_PER_DAY = 86_400_000

export function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function calendarDaysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T12:00:00Z`).getTime()
  const to = new Date(`${toIso}T12:00:00Z`).getTime()
  return Math.round((to - from) / MS_PER_DAY)
}

export function defaultStabilityPullOutDate(reviewCoverageEnd: string): string {
  return addCalendarDays(reviewCoverageEnd, -60)
}

export function defaultCommitmentSchedule(reviewCoverageEnd: string): string {
  return addCalendarDays(reviewCoverageEnd, 90)
}

export function expectedStabilityTabulationCompletionDate(stabilityPullOutDate: string): string {
  return addCalendarDays(stabilityPullOutDate, 90)
}

export function isStandardOneYearCoverage(start: string, end: string): boolean {
  const expectedEnd = addCalendarDays(addCalendarDays(start, 365), -1)
  return end === expectedEnd
}

export function classifyDelivery(
  commitmentSchedule: string,
  finalDeliveryDate: string | null,
  todayIso = new Date().toISOString().slice(0, 10),
): DeliveryClassification | null {
  if (finalDeliveryDate) {
    return finalDeliveryDate <= commitmentSchedule ? 'Delivered On Time' : 'Delivered Overdue'
  }
  if (todayIso > commitmentSchedule) return 'Currently Overdue and Undelivered'
  return null
}

export function daysRemainingOrOverdue(commitmentSchedule: string, todayIso = new Date().toISOString().slice(0, 10)): number {
  return calendarDaysBetween(todayIso, commitmentSchedule)
}

export function assignCommitmentPriority(
  row: Pick<
    ApqrDatabaseRow,
    | 'commitment_schedule'
    | 'final_apqr_delivery_date'
    | 'date_client_signed'
    | 'apqr_report_status'
    | 'commitment_schedule_status'
    | 'department'
    | 'number_of_batches'
    | 'apr_reference_number'
    | 'billing_reference_number'
    | 'apqr_package'
  >,
  todayIso = new Date().toISOString().slice(0, 10),
): ApqrPriority {
  if (isCompleted(row)) return 'Completed'

  const days = daysRemainingOrOverdue(row.commitment_schedule, todayIso)
  if (days < 0 && !row.final_apqr_delivery_date) return 'Overdue Commitment'
  if (days >= 0 && days <= 15) return 'Critical Commitment'
  if (days >= 16 && days <= 30) return 'High-Priority Commitment'
  if (days >= 31 && days <= 60) return 'Moderate Priority'
  return 'Low Priority'
}

export function isCompleted(
  row: Pick<
    ApqrDatabaseRow,
    | 'commitment_schedule_status'
    | 'apqr_report_status'
    | 'date_client_signed'
    | 'final_apqr_delivery_date'
    | 'department'
    | 'number_of_batches'
    | 'apr_reference_number'
    | 'billing_reference_number'
    | 'apqr_package'
  >,
): boolean {
  if (row.commitment_schedule_status !== 'Client Approved') return false
  if (row.apqr_report_status !== 'Client Approved') return false
  if (!row.date_client_signed) return false
  if (!row.final_apqr_delivery_date) return false
  if (!row.department) return false
  if (row.number_of_batches == null) return false
  if (!row.apr_reference_number) return false
  if (row.apqr_package === 'Billable' && !row.billing_reference_number) return false
  return true
}

export function countMissingCritical(
  row: Pick<
    ApqrDatabaseRow,
    | 'stability_tabulation_status'
    | 'apqr_report_status'
    | 'date_sent'
    | 'date_client_signed'
    | 'final_apqr_delivery_date'
    | 'apr_reference_number'
    | 'number_of_batches'
    | 'billing_reference_number'
    | 'apqr_package'
    | 'department'
    | 'commitment_schedule'
  >,
): number {
  let count = 0
  if (!row.stability_tabulation_status) count += 1
  if (!row.apqr_report_status) count += 1
  if (row.apqr_report_status && !row.date_sent) count += 1
  if (row.apqr_report_status === 'Client Approved' && !row.date_client_signed) count += 1
  if (!row.apr_reference_number) count += 1
  if (row.number_of_batches == null) count += 1
  if (!row.department) count += 1
  if (row.apqr_package === 'Billable' && !row.billing_reference_number) count += 1
  if (!row.commitment_schedule) count += 1
  return count
}

export const PRIORITY_SORT: Record<ApqrPriority, number> = {
  'Overdue Commitment': 0,
  'Critical Commitment': 1,
  'High-Priority Commitment': 2,
  'Overdue Stability Action': 3,
  'Critical Stability Action': 4,
  'Moderate Priority': 5,
  'Low Priority': 6,
  Completed: 7,
}
