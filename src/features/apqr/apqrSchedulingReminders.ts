import { apqrCycleYearFromCoverage, formatApqrCycleYearLabel } from './apqrDashboard'
import { scheduleStatusLabel } from './schedulerForm'
import type { ApqrClient, ApqrDatabaseRow, CommitmentScheduleStatus } from './types'

export type ApqrSchedulingReminderKind = 'prepare-client' | 'prepare-product' | 'draft' | 'approve' | 'stability'

export interface ApqrSchedulingReminderItem {
  id: string
  kind: ApqrSchedulingReminderKind
  clientId: string
  clientCode: string
  clientName: string
  productName: string | null
  productCode: string | null
  cycleYear: number
  scheduleStatus: CommitmentScheduleStatus | null
  title: string
  message: string
  link: string
}

export interface ApqrSchedulingReminderSummary {
  active: boolean
  cycleYear: number
  cycleLabel: string
  items: ApqrSchedulingReminderItem[]
  pendingCount: number
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

export function namesMatch(assignee: string | null | undefined, userName: string): boolean {
  if (!assignee?.trim() || !userName.trim()) return false
  return normalizeName(assignee) === normalizeName(userName)
}

/** Annual APQR scheduling window: September through October (local calendar). */
export function isApqrSchedulingSeason(today = new Date()): boolean {
  const month = today.getMonth()
  return month === 8 || month === 9
}

/** Cycle year being prepared during the Sep–Oct scheduling season. */
export function schedulingSeasonTargetCycleYear(today = new Date()): number {
  return today.getFullYear() + 1
}

function schedulerLink(clientId: string): string {
  return `/apqr/scheduler?client=${encodeURIComponent(clientId)}`
}

function actionForStatus(status: CommitmentScheduleStatus): Pick<ApqrSchedulingReminderItem, 'kind' | 'title' | 'message'> {
  if (status === 'Planned') {
    return {
      kind: 'draft',
      title: 'Prepare and send schedule',
      message: 'Complete drafting, confirm stability pull-out dates, and send the schedule to the client for review.',
    }
  }
  if (status === 'For Client Approval') {
    return {
      kind: 'approve',
      title: 'Review and approve schedule',
      message: 'Follow up with the client and record approval once the APQR schedule is signed.',
    }
  }
  return {
    kind: 'draft',
    title: 'Update schedule',
    message: 'Review the schedule status and complete the required workflow step.',
  }
}

export function buildAnnualSchedulingReminders(
  rows: ApqrDatabaseRow[],
  clients: ApqrClient[],
  userName: string,
  isAdmin: boolean,
  today = new Date(),
): ApqrSchedulingReminderSummary {
  const cycleYear = schedulingSeasonTargetCycleYear(today)
  const cycleLabel = formatApqrCycleYearLabel(cycleYear)
  const empty: ApqrSchedulingReminderSummary = {
    active: false,
    cycleYear,
    cycleLabel,
    items: [],
    pendingCount: 0,
  }

  if (!isApqrSchedulingSeason(today)) return empty

  const activeClients = clients.filter(
    (client) => client.status === 'active' && (isAdmin || namesMatch(client.account_manager, userName)),
  )

  const items: ApqrSchedulingReminderItem[] = []

  for (const client of activeClients) {
    const clientRows = rows.filter((row) => row.client_id === client.id)
    const targetRows = clientRows.filter((row) => apqrCycleYearFromCoverage(row.review_coverage_end) === cycleYear)
    const priorRows = clientRows.filter((row) => apqrCycleYearFromCoverage(row.review_coverage_end) === cycleYear - 1)

    if (targetRows.length === 0) {
      items.push({
        id: `prepare-client-${client.id}-${cycleYear}`,
        kind: 'prepare-client',
        clientId: client.id,
        clientCode: client.code,
        clientName: client.client_name,
        productName: null,
        productCode: null,
        cycleYear,
        scheduleStatus: null,
        title: 'Prepare APQR schedules',
        message: `Create ${cycleLabel} schedules for client products and stability batches, then send them for review and approval.`,
        link: schedulerLink(client.id),
      })
      continue
    }

    const targetCodes = new Set(targetRows.map((row) => row.product_code))
    for (const prior of priorRows) {
      if (targetCodes.has(prior.product_code)) continue
      items.push({
        id: `prepare-product-${client.id}-${prior.product_code}-${cycleYear}`,
        kind: 'prepare-product',
        clientId: client.id,
        clientCode: client.code,
        clientName: client.client_name,
        productName: prior.product_name,
        productCode: prior.product_code,
        cycleYear,
        scheduleStatus: null,
        title: 'Add next-cycle product schedule',
        message: `Register ${prior.product_name} (${prior.product_code}) for ${cycleLabel}, including stability pull-out and commitment dates.`,
        link: schedulerLink(client.id),
      })
    }

    for (const row of targetRows) {
      if (row.commitment_schedule_status === 'Client Approved') continue

      const action = actionForStatus(row.commitment_schedule_status)
      const statusLabel = scheduleStatusLabel(row.commitment_schedule_status)
      const stabilityNote = row.stability_pull_out_date
        ? ''
        : ' Confirm stability batch pull-out dates before sending the schedule.'

      items.push({
        id: `schedule-${row.scheduler_entry_id}`,
        kind: row.stability_pull_out_date ? action.kind : 'stability',
        clientId: client.id,
        clientCode: client.code,
        clientName: client.client_name,
        productName: row.product_name,
        productCode: row.product_code,
        cycleYear,
        scheduleStatus: row.commitment_schedule_status,
        title: action.title,
        message: `${row.product_name} (${row.product_code}) is ${statusLabel}.${stabilityNote} ${action.message}`,
        link: schedulerLink(client.id),
      })
    }
  }

  return {
    active: items.length > 0,
    cycleYear,
    cycleLabel,
    items,
    pendingCount: items.length,
  }
}
