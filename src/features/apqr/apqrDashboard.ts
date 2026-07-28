import { buildDashboardMetrics } from './apqrService'
import {
  addCalendarDays,
  assignCommitmentPriority,
  daysRemainingOrOverdue,
  PRIORITY_SORT,
} from './scheduling'
import { formatAppDate } from '../../utils/dateUtils'
import type {
  ApqrDashboardMetrics,
  ApqrDatabaseRow,
  ApqrMetricTrend,
  ApqrPriority,
  ApqrSchedulerRowInput,
  ApqrTriageSlice,
  ApqrUpcomingAction,
  DashboardWorkFilter,
} from './types'

export type { DashboardWorkFilter }

export const DASHBOARD_WORK_FILTER_LABELS: Record<DashboardWorkFilter, string> = {
  all: 'All',
  overdue: 'Overdue',
  dueSoon: 'Due soon',
  missingInfo: 'Missing info',
  awaitingClient: 'Awaiting client',
  followUps: 'Follow-ups due',
  stability: 'Stability due',
}

const TRIAGE_COLORS: Record<string, string> = {
  Overdue: '#e03131',
  Critical: '#c92a2a',
  'High Priority': '#f08c00',
  Moderate: '#fab005',
  Low: '#4dabf7',
  Completed: '#2f9e44',
}

const TRIAGE_ORDER = ['Overdue', 'Critical', 'High Priority', 'Moderate', 'Low', 'Completed'] as const

function triageBucket(priority: ApqrPriority): (typeof TRIAGE_ORDER)[number] {
  if (priority === 'Overdue Commitment' || priority === 'Overdue Stability Action') return 'Overdue'
  if (priority === 'Critical Commitment' || priority === 'Critical Stability Action') return 'Critical'
  if (priority === 'High-Priority Commitment') return 'High Priority'
  if (priority === 'Moderate Priority') return 'Moderate'
  if (priority === 'Completed') return 'Completed'
  return 'Low'
}

export function defaultApqrReviewCycle(today = new Date()): { start: string; end: string } {
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth()
  const startYear = month >= 10 ? year : year - 1
  const endYear = startYear + 1
  return { start: `${startYear}-11-01`, end: `${endYear}-10-31` }
}

/** Nov–Oct review window label for a cycle year (dashboard filter range). */
export function reviewCycleFromYear(cycleYear: number): { start: string; end: string } {
  return { start: `${cycleYear - 1}-11-01`, end: `${cycleYear}-10-31` }
}

/** Operational APQR cycle year = calendar year when the entry is created (not review coverage). */
export function defaultApqrCycleYear(today = new Date()): number {
  return today.getUTCFullYear()
}

/** Legacy APQR-YYYY-xxxx IDs only; short IDs use review coverage for cycle year. */
export function apqrIdYear(apqrId: string): number | null {
  const match = /^APQR-(\d{4})-/.exec(apqrId)
  return match ? Number(match[1]) : null
}

export function apqrCycleYearFromCoverage(endDate: string): number {
  return Number(endDate.slice(0, 4))
}

/** Scheduler cycle year = calendar year of the Commitment Date. */
export function apqrCycleYearFromCommitment(commitmentDate: string | null | undefined): number | null {
  if (!commitmentDate?.trim()) return null
  const year = Number(commitmentDate.slice(0, 4))
  return Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : null
}

export function schedulerCycleYearOptions(
  rows: Array<{ commitment_schedule?: string | null }>,
  today = new Date(),
): number[] {
  const current = defaultApqrCycleYear(today)
  const years = new Set<number>([current - 1, current, current + 1, current + 2])
  for (const row of rows) {
    const year = apqrCycleYearFromCommitment(row.commitment_schedule)
    if (year != null) years.add(year)
  }
  return [...years].sort((a, b) => b - a)
}

/** Standard Nov 1 – Oct 31 review coverage for the given cycle year. */
export function isStandardApqrCycleCoverage(start: string, end: string): boolean {
  const cycleYear = apqrCycleYearFromCoverage(end)
  const canonical = reviewCycleFromYear(cycleYear)
  return start === canonical.start && end === canonical.end
}

/** Cycle year when creating a scheduler row (calendar year at save time). */
export function resolveApqrIdYear(
  _row: Pick<ApqrSchedulerRowInput, 'review_coverage_start' | 'review_coverage_end'>,
  today = new Date(),
): number {
  return defaultApqrCycleYear(today)
}

export function apqrCycleYearOptions(rows: ApqrDatabaseRow[], today = new Date()): number[] {
  const current = defaultApqrCycleYear(today)
  const years = new Set<number>([current - 1, current, current + 1, current + 2])
  for (const row of rows) {
    years.add(apqrCycleYearFromCoverage(row.review_coverage_end))
    const legacyYear = apqrIdYear(row.apqr_id)
    if (legacyYear) years.add(legacyYear)
  }
  return [...years].sort((a, b) => b - a)
}

export function filterRowsByReviewCycle(
  rows: ApqrDatabaseRow[],
  start: string,
  end: string,
): ApqrDatabaseRow[] {
  return rows.filter((row) => row.review_coverage_start <= end && row.review_coverage_end >= start)
}

export function rowsAsOf(rows: ApqrDatabaseRow[], asOf: string): ApqrDatabaseRow[] {
  return rows.map((row) => ({
    ...row,
    days_remaining_or_overdue: daysRemainingOrOverdue(row.commitment_schedule, asOf),
    priority: assignCommitmentPriority(row, asOf),
  }))
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round(((current - previous) / previous) * 100)
}

export function formatMetricTrend(
  current: number,
  previous: number,
  higherIsBetter: boolean,
): ApqrMetricTrend {
  const delta = pctChange(current, previous)
  if (delta === null || delta === 0) {
    return { text: 'No change vs prev. period', tone: 'neutral' }
  }
  const arrow = delta > 0 ? '↑' : '↓'
  const magnitude = Math.abs(delta)
  const improved = higherIsBetter ? delta > 0 : delta < 0
  return {
    text: `${arrow} ${magnitude}% vs prev. period`,
    tone: improved ? 'good' : 'bad',
  }
}

export function buildDashboardTrends(rows: ApqrDatabaseRow[]): Record<keyof ApqrDashboardMetrics, ApqrMetricTrend> {
  const today = new Date().toISOString().slice(0, 10)
  const prior = addCalendarDays(today, -30)
  const current = buildDashboardMetrics(rows, today)
  const previous = buildDashboardMetrics(rowsAsOf(rows, prior), prior)

  return {
    totalActive: formatMetricTrend(current.totalActive, previous.totalActive, true),
    overdueCommitments: formatMetricTrend(current.overdueCommitments, previous.overdueCommitments, false),
    criticalCommitments: formatMetricTrend(current.criticalCommitments, previous.criticalCommitments, false),
    highPriorityCommitments: formatMetricTrend(current.highPriorityCommitments, previous.highPriorityCommitments, false),
    dueThisMonth: formatMetricTrend(current.dueThisMonth, previous.dueThisMonth, false),
    deliveredThisMonth: formatMetricTrend(current.deliveredThisMonth, previous.deliveredThisMonth, true),
    onTimeDeliveryRate: formatMetricTrend(current.onTimeDeliveryRate, previous.onTimeDeliveryRate, true),
    onTimeDelivered: formatMetricTrend(current.onTimeDelivered, previous.onTimeDelivered, true),
    totalDelivered: formatMetricTrend(current.totalDelivered, previous.totalDelivered, true),
    overdueDeliveries: formatMetricTrend(current.overdueDeliveries, previous.overdueDeliveries, false),
    pendingClientApproval: formatMetricTrend(current.pendingClientApproval, previous.pendingClientApproval, false),
    followUpsDue: formatMetricTrend(current.followUpsDue, previous.followUpsDue, false),
    stabilityActionsDue: formatMetricTrend(current.stabilityActionsDue, previous.stabilityActionsDue, false),
    missingCriticalInformation: formatMetricTrend(
      current.missingCriticalInformation,
      previous.missingCriticalInformation,
      false,
    ),
  }
}

export function buildTriageDistribution(rows: ApqrDatabaseRow[]): ApqrTriageSlice[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const bucket = triageBucket(row.priority)
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
  }
  return TRIAGE_ORDER.filter((name) => (counts.get(name) ?? 0) > 0).map((name) => ({
    name,
    value: counts.get(name) ?? 0,
    color: TRIAGE_COLORS[name],
  }))
}

function dueLabelForRow(row: ApqrDatabaseRow, today: string): { label: string; tone: ApqrUpcomingAction['tone'] } {
  const days = row.days_remaining_or_overdue ?? daysRemainingOrOverdue(row.commitment_schedule, today)
  if (days < 0) return { label: 'Overdue', tone: 'danger' }
  if (days === 0) return { label: 'Due today', tone: 'warning' }
  if (days <= 7) return { label: `Due in ${days} day${days === 1 ? '' : 's'}`, tone: 'warning' }
  if (days <= 30) return { label: `Due in ${days} days`, tone: 'info' }
  return { label: `Due in ${days} days`, tone: 'neutral' }
}

function isCommitmentDueThisMonth(row: ApqrDatabaseRow, asOf: string): boolean {
  if (!row.commitment_schedule) return false
  const d = new Date(`${row.commitment_schedule}T12:00:00Z`)
  const today = new Date(`${asOf}T12:00:00Z`)
  return d.getUTCFullYear() === today.getUTCFullYear() && d.getUTCMonth() === today.getUTCMonth()
}

function isFollowUpDue(row: ApqrDatabaseRow, asOf: string): boolean {
  return Boolean(row.next_follow_up_due_date && row.next_follow_up_due_date <= asOf)
}

function isStabilityActionDue(row: ApqrDatabaseRow, asOf: string): boolean {
  return Boolean(
    row.stability_pull_out_date &&
      row.stability_pull_out_date <= asOf &&
      (!row.stability_tabulation_status || row.stability_tabulation_status === 'Not Sent'),
  )
}

function isOverdueCommitment(row: ApqrDatabaseRow): boolean {
  return row.priority === 'Overdue Commitment' || row.priority === 'Overdue Stability Action'
}

/** Critical / High-Priority / due this month — excludes already-overdue rows. */
export function isDueSoon(row: ApqrDatabaseRow, asOf = new Date().toISOString().slice(0, 10)): boolean {
  if (isOverdueCommitment(row)) return false
  if (
    row.priority === 'Critical Commitment' ||
    row.priority === 'Critical Stability Action' ||
    row.priority === 'High-Priority Commitment'
  ) {
    return true
  }
  return isCommitmentDueThisMonth(row, asOf)
}

export function countDueSoon(rows: ApqrDatabaseRow[], asOf = new Date().toISOString().slice(0, 10)): number {
  return rows.filter((row) => isDueSoon(row, asOf)).length
}

export function matchesDashboardWorkFilter(
  row: ApqrDatabaseRow,
  filter: DashboardWorkFilter,
  asOf = new Date().toISOString().slice(0, 10),
): boolean {
  if (filter === 'all') return true
  if (filter === 'overdue') return isOverdueCommitment(row)
  if (filter === 'dueSoon') return isDueSoon(row, asOf)
  if (filter === 'missingInfo') return row.missing_critical_count > 0
  if (filter === 'awaitingClient') return row.apqr_report_status === 'For Client Approval'
  if (filter === 'followUps') return isFollowUpDue(row, asOf)
  if (filter === 'stability') return isStabilityActionDue(row, asOf)
  return true
}

/** Lower rank = more urgent. Ties break by days remaining (more overdue first). */
export function urgencyRank(row: ApqrDatabaseRow, asOf = new Date().toISOString().slice(0, 10)): number {
  if (isOverdueCommitment(row)) return 0
  if (row.priority === 'Critical Commitment' || row.priority === 'Critical Stability Action') return 1
  if (row.missing_critical_count > 0) return 2
  if (isFollowUpDue(row, asOf) || isStabilityActionDue(row, asOf)) return 3
  if (row.priority === 'High-Priority Commitment') return 4
  if (isDueSoon(row, asOf)) return 5
  return 10 + (PRIORITY_SORT[row.priority] ?? 9)
}

export function sortRowsByUrgency(
  rows: ApqrDatabaseRow[],
  asOf = new Date().toISOString().slice(0, 10),
): ApqrDatabaseRow[] {
  return [...rows].sort((a, b) => {
    const rankDiff = urgencyRank(a, asOf) - urgencyRank(b, asOf)
    if (rankDiff !== 0) return rankDiff
    const daysA = a.days_remaining_or_overdue ?? daysRemainingOrOverdue(a.commitment_schedule, asOf) ?? 9999
    const daysB = b.days_remaining_or_overdue ?? daysRemainingOrOverdue(b.commitment_schedule, asOf) ?? 9999
    return daysA - daysB
  })
}

function attentionReason(row: ApqrDatabaseRow, asOf: string): {
  title: string
  tone: ApqrUpcomingAction['tone']
  dueLabel: string
} {
  if (isOverdueCommitment(row)) {
    return { title: 'Overdue commitment', tone: 'danger', dueLabel: dueLabelForRow(row, asOf).label }
  }
  if (row.priority === 'Critical Commitment' || row.priority === 'Critical Stability Action') {
    return { title: 'Critical commitment', tone: 'danger', dueLabel: dueLabelForRow(row, asOf).label }
  }
  if (row.missing_critical_count > 0) {
    return {
      title: 'Missing critical info',
      tone: 'danger',
      dueLabel: `${row.missing_critical_count} field${row.missing_critical_count === 1 ? '' : 's'}`,
    }
  }
  if (isStabilityActionDue(row, asOf)) {
    return { title: 'Stability action due', tone: 'warning', dueLabel: 'Action required' }
  }
  if (isFollowUpDue(row, asOf)) {
    return { title: 'Follow-up due', tone: 'info', dueLabel: 'Follow-up due' }
  }
  if (row.priority === 'High-Priority Commitment') {
    return { title: 'High-priority commitment', tone: 'warning', dueLabel: dueLabelForRow(row, asOf).label }
  }
  if (isDueSoon(row, asOf)) {
    return { title: 'Due soon', tone: 'warning', dueLabel: dueLabelForRow(row, asOf).label }
  }
  const due = dueLabelForRow(row, asOf)
  return { title: row.priority, tone: due.tone, dueLabel: due.label }
}

function isActionableAttentionRow(row: ApqrDatabaseRow, asOf: string): boolean {
  if (row.priority === 'Completed') return false
  return (
    isOverdueCommitment(row) ||
    row.priority === 'Critical Commitment' ||
    row.priority === 'Critical Stability Action' ||
    row.missing_critical_count > 0 ||
    isFollowUpDue(row, asOf) ||
    isStabilityActionDue(row, asOf) ||
    row.priority === 'High-Priority Commitment' ||
    isDueSoon(row, asOf)
  )
}

/** Ranked multi-row work queue for the Needs Attention panel. */
export function buildNeedsAttentionQueue(
  rows: ApqrDatabaseRow[],
  limit = 10,
  asOf = new Date().toISOString().slice(0, 10),
): ApqrUpcomingAction[] {
  return sortRowsByUrgency(rows.filter((row) => isActionableAttentionRow(row, asOf)), asOf)
    .slice(0, limit)
    .map((row) => {
      const reason = attentionReason(row, asOf)
      return {
        id: row.apqr_id,
        title: reason.title,
        productName: row.product_name,
        clientName: row.client_name,
        dueLabel: reason.dueLabel,
        tone: reason.tone,
        link: `/apqr/form?apqr=${encodeURIComponent(row.apqr_id)}`,
      }
    })
}

/** @deprecated Prefer buildNeedsAttentionQueue — kept for callers expecting the old name. */
export function buildUpcomingActions(rows: ApqrDatabaseRow[], limit = 10): ApqrUpcomingAction[] {
  return buildNeedsAttentionQueue(rows, limit)
}

export function formatReviewCycleLabel(start: string, end: string): string {
  return `${formatAppDate(start)} – ${formatAppDate(end)}`
}

export function formatApqrCycleYearLabel(cycleYear: number): string {
  const { start, end } = reviewCycleFromYear(cycleYear)
  return formatReviewCycleLabel(start, end)
}
