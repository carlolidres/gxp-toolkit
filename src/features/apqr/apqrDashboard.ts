import { buildDashboardMetrics } from './apqrService'
import { addCalendarDays, assignCommitmentPriority, daysRemainingOrOverdue } from './scheduling'
import { formatAppDate } from '../../utils/dateUtils'
import type {
  ApqrDashboardMetrics,
  ApqrDatabaseRow,
  ApqrMetricTrend,
  ApqrPriority,
  ApqrSchedulerRowInput,
  ApqrTriageSlice,
  ApqrUpcomingAction,
} from './types'

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

export function buildUpcomingActions(rows: ApqrDatabaseRow[], limit = 6): ApqrUpcomingAction[] {
  const today = new Date().toISOString().slice(0, 10)

  const categories: Array<{
    title: string
    tone: ApqrUpcomingAction['tone']
    match: (row: ApqrDatabaseRow) => boolean
    dueLabel: (row: ApqrDatabaseRow) => string
    rank: (row: ApqrDatabaseRow) => number
  }> = [
    {
      title: 'Stability Actions Due',
      tone: 'warning',
      match: (row) =>
        Boolean(
          row.stability_pull_out_date &&
            row.stability_pull_out_date <= today &&
            (!row.stability_tabulation_status || row.stability_tabulation_status === 'Not Sent'),
        ),
      dueLabel: () => 'Action required',
      rank: (row) => row.days_remaining_or_overdue ?? 0,
    },
    {
      title: 'Overdue Commitments',
      tone: 'danger',
      match: (row) => row.priority === 'Overdue Commitment',
      dueLabel: () => 'Overdue',
      rank: (row) => row.days_remaining_or_overdue ?? 0,
    },
    {
      title: 'Critical Commitments',
      tone: 'danger',
      match: (row) => row.priority === 'Critical Commitment',
      dueLabel: (row) => dueLabelForRow(row, today).label,
      rank: (row) => row.days_remaining_or_overdue ?? 999,
    },
    {
      title: 'Follow-Ups Due',
      tone: 'info',
      match: (row) => Boolean(row.next_follow_up_due_date && row.next_follow_up_due_date <= today),
      dueLabel: () => 'Follow-up due',
      rank: () => 0,
    },
    {
      title: 'High-Priority Commitments',
      tone: 'warning',
      match: (row) => row.priority === 'High-Priority Commitment',
      dueLabel: (row) => dueLabelForRow(row, today).label,
      rank: (row) => row.days_remaining_or_overdue ?? 999,
    },
    {
      title: 'Moderate Priority',
      tone: 'neutral',
      match: (row) => row.priority === 'Moderate Priority',
      dueLabel: (row) => dueLabelForRow(row, today).label,
      rank: (row) => row.days_remaining_or_overdue ?? 999,
    },
  ]

  return categories
    .map((category) => {
      const match = rows
        .filter(category.match)
        .sort((a, b) => category.rank(a) - category.rank(b))[0]
      if (!match) return null
      return {
        id: `${category.title}-${match.apqr_id}`,
        title: category.title,
        productName: match.product_name,
        dueLabel: category.dueLabel(match),
        tone: category.tone,
        link: `/apqr/form?apqr=${encodeURIComponent(match.apqr_id)}`,
      }
    })
    .filter((action): action is ApqrUpcomingAction => action !== null)
    .slice(0, limit)
}

export function formatReviewCycleLabel(start: string, end: string): string {
  return `${formatAppDate(start)} – ${formatAppDate(end)}`
}

export function formatApqrCycleYearLabel(cycleYear: number): string {
  const { start, end } = reviewCycleFromYear(cycleYear)
  return formatReviewCycleLabel(start, end)
}
