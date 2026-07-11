import { defaultApqrCycleYear } from './apqrDashboard'
import {
  addCalendarDays,
  defaultApqrGenerationDate,
  defaultCommitmentSchedule,
  defaultStabilityPullOutDate,
  expectedStabilityTabulationCompletionDate,
  isStandardOneYearCoverage,
  manualApqrGenerationFromCommitment,
  manualStabilityPullOutDate,
} from './scheduling'
import { formatAppDate } from '../../utils/dateUtils'
import type {
  ApqrProductStatus,
  ApqrScheduleStatusLabel,
  ApqrSchedulerEntry,
  ApqrSchedulerRowInput,
  CommitmentScheduleStatus,
} from './types'

export type ScheduleRowDraft = ApqrSchedulerRowInput & {
  id?: string
  apqr_id?: string
  client_name?: string
  /** When true, calculated dates are user-entered and required. */
  manual_calculated_dates?: boolean
}

export const SCHEDULE_STATUS_UI: Array<{ label: ApqrScheduleStatusLabel; value: CommitmentScheduleStatus }> = [
  { label: 'Drafting', value: 'Planned' },
  { label: 'Client Approval', value: 'For Client Approval' },
  { label: 'Client Approved', value: 'Client Approved' },
]

export const PRODUCT_STATUS_OPTIONS: ApqrProductStatus[] = ['Active', 'End-of-Life']

const STATUS_LABEL_BY_VALUE = Object.fromEntries(
  SCHEDULE_STATUS_UI.map((item) => [item.value, item.label]),
) as Record<CommitmentScheduleStatus, ApqrScheduleStatusLabel>

export function scheduleStatusLabel(status: CommitmentScheduleStatus): ApqrScheduleStatusLabel {
  return STATUS_LABEL_BY_VALUE[status] ?? 'Drafting'
}

export function computedScheduleDates(reviewCoverageEnd: string, autoComputeDates = true) {
  if (!reviewCoverageEnd.trim()) {
    return {
      stability_pull_out_date: '',
      apqr_generation_date: '',
      commitment_schedule: '',
    }
  }
  if (autoComputeDates) {
    return {
      stability_pull_out_date: defaultStabilityPullOutDate(reviewCoverageEnd),
      apqr_generation_date: defaultApqrGenerationDate(reviewCoverageEnd),
      commitment_schedule: defaultCommitmentSchedule(reviewCoverageEnd),
    }
  }
  const commitment_schedule = defaultCommitmentSchedule(reviewCoverageEnd)
  return {
    stability_pull_out_date: manualStabilityPullOutDate(reviewCoverageEnd),
    commitment_schedule,
    apqr_generation_date: manualApqrGenerationFromCommitment(commitment_schedule),
  }
}

export function emptyScheduleRow(clientName = ''): ScheduleRowDraft {
  return {
    client_name: clientName,
    product_name: '',
    product_code: '',
    product_status: 'Active',
    review_coverage_start: '',
    review_coverage_end: '',
    stability_pull_out_date: '',
    apqr_generation_date: '',
    commitment_schedule: '',
    commitment_schedule_status: 'Planned',
    schedule_status_date: null,
    scheduler_remarks: [''],
    manual_calculated_dates: false,
  }
}

export function parseSchedulerRemarks(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return ['']
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed.length ? parsed : ['']
    }
  } catch {
    // ponytail: legacy plain-text remark
  }
  return [raw]
}

export function serializeSchedulerRemarks(remarks: string[] | undefined): string | null {
  const trimmed = (remarks ?? []).map((r) => r.trim()).filter(Boolean)
  return trimmed.length ? JSON.stringify(trimmed) : null
}

export function rowFromSchedulerEntry(entry: ApqrSchedulerEntry, clientName = ''): ScheduleRowDraft {
  const dates = computedScheduleDates(entry.review_coverage_end)
  const manual = Boolean(
    entry.commitment_schedule_adjustment_reason ||
      entry.stability_pull_out_adjustment_reason ||
      entry.apqr_generation_adjustment_reason,
  )
  return {
    id: entry.id,
    apqr_id: entry.apqr_id,
    client_name: clientName,
    stability_pull_out_date: entry.stability_pull_out_date ?? dates.stability_pull_out_date,
    product_name: entry.product_name,
    product_code: entry.product_code,
    product_status: entry.product_status ?? 'Active',
    review_coverage_start: entry.review_coverage_start,
    review_coverage_end: entry.review_coverage_end,
    review_coverage_adjustment_reason: entry.review_coverage_adjustment_reason ?? undefined,
    commitment_schedule: entry.commitment_schedule_adjustment_reason
      ? entry.commitment_schedule
      : dates.commitment_schedule,
    commitment_schedule_adjustment_reason: entry.commitment_schedule_adjustment_reason ?? undefined,
    apqr_generation_date: entry.apqr_generation_adjustment_reason
      ? entry.apqr_generation_date ?? dates.apqr_generation_date
      : dates.apqr_generation_date,
    apqr_generation_adjustment_reason: entry.apqr_generation_adjustment_reason ?? undefined,
    commitment_schedule_status: entry.commitment_schedule_status,
    schedule_status_date: entry.schedule_status_date,
    stability_pull_out_adjustment_reason: entry.stability_pull_out_adjustment_reason ?? undefined,
    scheduler_remarks: parseSchedulerRemarks(entry.scheduler_remarks),
    manual_calculated_dates: manual,
  }
}

export function generateNextApqrCycle(row: ScheduleRowDraft): ScheduleRowDraft {
  const nextStart = addCalendarDays(row.review_coverage_end, 1)
  const span = Math.max(
    1,
    Math.round(
      (new Date(`${row.review_coverage_end}T12:00:00Z`).getTime() -
        new Date(`${row.review_coverage_start}T12:00:00Z`).getTime()) /
        86_400_000,
    ) + 1,
  )
  const nextEnd = addCalendarDays(nextStart, span - 1)
  const dates = computedScheduleDates(nextEnd)
  return {
    ...emptyScheduleRow(row.client_name),
    product_name: row.product_name,
    product_code: row.product_code,
    product_status: row.product_status ?? 'Active',
    review_coverage_start: nextStart,
    review_coverage_end: nextEnd,
    ...dates,
    commitment_schedule_status: 'Planned',
    schedule_status_date: null,
    scheduler_remarks: [''],
  }
}

export function reviewCoverageNeedsReason(start: string, end: string): boolean {
  if (!start.trim() || !end.trim()) return false
  return !isStandardOneYearCoverage(start, end)
}

export function stabilityTabulationConflict(
  stabilityPullOut: string,
  commitmentSchedule: string,
): boolean {
  return expectedStabilityTabulationCompletionDate(stabilityPullOut) > commitmentSchedule
}

export function formatOverrideRemark(
  fieldLabel: string,
  oldValue: string,
  newValue: string,
  reason: string,
  userName: string,
): string {
  const ts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
  return `[${ts}] ${userName} overrode ${fieldLabel}: ${formatAppDate(oldValue)} → ${formatAppDate(newValue)}. Reason: ${reason}`
}

export function appendRemark(remarks: string[], line: string): string[] {
  const next = remarks.filter((r) => r.trim())
  next.push(line)
  return next.length ? next : ['']
}

export function currentCycleYear(): number {
  return defaultApqrCycleYear()
}
