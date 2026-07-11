import type { ApqrDatabaseRow, ApqrPriority, DeliveryClassification } from './types'

const MS_PER_DAY = 86_400_000

export function isCancelledReportStatus(status: string | null | undefined): boolean {
  return status?.trim().toLowerCase() === 'cancelled'
}

export function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Shift an ISO date by whole calendar months, clamping day to the target month length. */
export function addCalendarMonths(isoDate: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim())
  if (!match) return isoDate
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1 + months
  const day = Number(match[3])
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const clampedDay = Math.min(day, lastDay)
  const d = new Date(Date.UTC(year, monthIndex, clampedDay))
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

export function defaultApqrGenerationDate(reviewCoverageEnd: string): string {
  return addCalendarDays(reviewCoverageEnd, 30)
}

export function defaultCommitmentSchedule(reviewCoverageEnd: string): string {
  return addCalendarDays(reviewCoverageEnd, 90)
}

/** Manual Dates: Stability Pull-Out = Review Coverage end − 2 calendar months. */
export function manualStabilityPullOutDate(reviewCoverageEnd: string): string {
  return addCalendarMonths(reviewCoverageEnd, -2)
}

/** Manual Dates: APQR Generation = Commitment − 2 calendar months. */
export function manualApqrGenerationFromCommitment(commitmentDate: string): string {
  return addCalendarMonths(commitmentDate, -2)
}

/** Shift a YYYY-MM value by whole calendar months. */
export function addMonthYear(monthYear: string, months: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthYear.trim())
  if (!match) return monthYear
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1 + months
  const d = new Date(Date.UTC(year, monthIndex, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Auto-compute filter: Commitment month is always Generation month + 2. */
export function commitmentMonthFromGenerationMonth(generationMonth: string): string {
  return addMonthYear(generationMonth, 2)
}

/** Manual Dates filter: Generation month is Commitment month − 2. */
export function generationMonthFromCommitmentMonth(commitmentMonth: string): string {
  return addMonthYear(commitmentMonth, -2)
}

export type ApqrLinkedDateField = 'pullout' | 'generation' | 'commitment'

/**
 * Sync month-year filter values from one selected field (Auto-Compute Dates):
 * pullout = coverage end − 60d, generation = coverage end + 30d,
 * commitment = generation month + 2 (always).
 */
export function linkedFilterMonthsFromField(
  field: ApqrLinkedDateField,
  monthYear: string,
): { pullout: string; generation: string; commitment: string } | null {
  if (!/^\d{4}-\d{2}$/.test(monthYear.trim())) return null
  const selected = monthYear.trim()

  if (field === 'commitment') {
    const generation = addMonthYear(selected, -2)
    const coverageEnd = addCalendarDays(`${generation}-01`, -30)
    return {
      pullout: defaultStabilityPullOutDate(coverageEnd).slice(0, 7),
      generation,
      commitment: selected,
    }
  }

  const anchor = `${selected}-01`
  const coverageEnd = field === 'pullout' ? addCalendarDays(anchor, 60) : addCalendarDays(anchor, -30)
  const generation = defaultApqrGenerationDate(coverageEnd).slice(0, 7)

  return {
    pullout: defaultStabilityPullOutDate(coverageEnd).slice(0, 7),
    generation,
    commitment: commitmentMonthFromGenerationMonth(generation),
  }
}

/**
 * Manual Dates filter linking:
 * - Commitment change → Generation = Commitment − 2 months (pullout unchanged)
 * - Generation change → Generation only (commitment unchanged)
 * - Pullout change → Pullout only
 */
export function linkedManualFilterMonthsFromField(
  field: ApqrLinkedDateField,
  monthYear: string,
  current: { pullout: string; generation: string; commitment: string },
): { pullout: string; generation: string; commitment: string } {
  const selected = /^\d{4}-\d{2}$/.test(monthYear.trim()) ? monthYear.trim() : ''
  if (field === 'commitment') {
    return {
      pullout: current.pullout,
      generation: selected ? generationMonthFromCommitmentMonth(selected) : '',
      commitment: selected,
    }
  }
  if (field === 'generation') {
    return {
      pullout: current.pullout,
      generation: selected,
      commitment: current.commitment,
    }
  }
  return {
    pullout: selected,
    generation: current.generation,
    commitment: current.commitment,
  }
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
  apqrReportStatus?: string | null,
): DeliveryClassification | null {
  if (isCancelledReportStatus(apqrReportStatus)) return 'NA'
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
  if (isCancelledReportStatus(row.apqr_report_status)) return 'Low Priority'
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

export function apqrPriorityDisplay(
  row: Pick<ApqrDatabaseRow, 'priority' | 'apqr_report_status'>,
): { priority: ApqrPriority; label: string } {
  if (isCancelledReportStatus(row.apqr_report_status)) {
    return { priority: 'Low Priority', label: 'Low' }
  }
  return { priority: row.priority, label: row.priority }
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
