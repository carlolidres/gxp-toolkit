import { describe, expect, it } from 'vitest'

import {
  buildAnnualSchedulingReminders,
  isApqrSchedulingSeason,
  namesMatch,
  schedulingSeasonTargetCycleYear,
} from './apqrSchedulingReminders'
import type { ApqrClient, ApqrDatabaseRow } from './types'

function client(partial: Partial<ApqrClient>): ApqrClient {
  return {
    id: 'c1',
    code: '001',
    account_manager: 'Carlo Lidres',
    client_name: 'Acme',
    qa: null,
    technical: null,
    regulatory: null,
    apqr_package: 'Billable',
    status: 'active',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...partial,
  }
}

function row(partial: Partial<ApqrDatabaseRow>): ApqrDatabaseRow {
  return {
    apqr_id: 'aB01',
    scheduler_entry_id: 's1',
    record_id: 'r1',
    client_id: 'c1',
    client_code: '001',
    client_name: 'Acme',
    account_manager: 'Carlo Lidres',
    apqr_package: 'Billable',
    product_name: 'Product A',
    product_code: 'PA',
    department: 'Dry',
    review_coverage_start: '2026-11-01',
    review_coverage_end: '2027-10-31',
    stability_pull_out_date: '2027-08-01',
    apqr_generation_date: '2027-11-30',
    expected_stability_tabulation_completion_date: '2027-10-30',
    stability_tabulation_status: 'Not Sent',
    commitment_schedule: '2028-01-31',
    commitment_schedule_status: 'Planned',
    apqr_report_status: null,
    apr_reference_number: null,
    number_of_batches: null,
    billing_reference_number: null,
    date_sent: null,
    last_follow_up_date: null,
    next_follow_up_due_date: null,
    date_client_signed: null,
    final_apqr_delivery_date: null,
    delivery_classification: null,
    days_remaining_or_overdue: 30,
    record_status: 'active',
    updated_at: '2026-01-01',
    priority: 'Moderate Priority',
    missing_critical_count: 0,
    ...partial,
  }
}

describe('apqrSchedulingReminders', () => {
  it('detects September and October as scheduling season', () => {
    expect(isApqrSchedulingSeason(new Date('2026-09-15'))).toBe(true)
    expect(isApqrSchedulingSeason(new Date('2026-10-02'))).toBe(true)
    expect(isApqrSchedulingSeason(new Date('2026-11-01'))).toBe(false)
    expect(isApqrSchedulingSeason(new Date('2026-07-06'))).toBe(false)
  })

  it('targets the next cycle year during scheduling season', () => {
    expect(schedulingSeasonTargetCycleYear(new Date('2026-09-01'))).toBe(2027)
  })

  it('matches assignee names case-insensitively', () => {
    expect(namesMatch('Carlo Lidres', 'carlo lidres')).toBe(true)
    expect(namesMatch('Other User', 'Carlo Lidres')).toBe(false)
  })

  it('returns no reminders outside scheduling season', () => {
    const summary = buildAnnualSchedulingReminders(
      [row({})],
      [client({})],
      'Carlo Lidres',
      false,
      new Date('2026-07-06'),
    )
    expect(summary.active).toBe(false)
    expect(summary.items).toHaveLength(0)
  })

  it('reminds assigned users until schedules are client approved', () => {
    const summary = buildAnnualSchedulingReminders(
      [row({ commitment_schedule_status: 'Planned' })],
      [client({})],
      'Carlo Lidres',
      false,
      new Date('2026-09-10'),
    )
    expect(summary.active).toBe(true)
    expect(summary.pendingCount).toBe(1)
    expect(summary.items[0]?.title).toContain('Prepare and send')
  })

  it('clears reminders when all target-cycle schedules are approved', () => {
    const summary = buildAnnualSchedulingReminders(
      [row({ commitment_schedule_status: 'Client Approved' })],
      [client({})],
      'Carlo Lidres',
      false,
      new Date('2026-10-05'),
    )
    expect(summary.active).toBe(false)
    expect(summary.items).toHaveLength(0)
  })

  it('does not notify unrelated account managers', () => {
    const summary = buildAnnualSchedulingReminders(
      [row({})],
      [client({ account_manager: 'Other AM' })],
      'Carlo Lidres',
      false,
      new Date('2026-09-10'),
    )
    expect(summary.items).toHaveLength(0)
  })
})
