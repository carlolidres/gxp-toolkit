import { describe, expect, it } from 'vitest'

import {
  buildTriageDistribution,
  buildUpcomingActions,
  defaultApqrReviewCycle,
  filterRowsByReviewCycle,
  formatMetricTrend,
  formatReviewCycleLabel,
} from './apqrDashboard'
import type { ApqrDatabaseRow } from './types'

function row(partial: Partial<ApqrDatabaseRow>): ApqrDatabaseRow {
  return {
    apqr_id: 'APQR-2026-0001',
    scheduler_entry_id: 's1',
    record_id: 'r1',
    client_id: 'c1',
    client_code: '001',
    client_name: 'Client',
    account_manager: 'AM',
    apqr_package: 'Billable',
    product_name: 'Product',
    product_code: 'P1',
    department: 'Dry',
    review_coverage_start: '2025-11-01',
    review_coverage_end: '2026-10-31',
    stability_pull_out_date: '2026-09-01',
    expected_stability_tabulation_completion_date: '2026-11-30',
    stability_tabulation_status: 'Not Sent',
    commitment_schedule: '2027-01-31',
    commitment_schedule_status: 'Planned',
    apqr_report_status: null,
    apr_reference_number: null,
    number_of_batches: 1,
    billing_reference_number: null,
    date_sent: null,
    last_follow_up_date: null,
    next_follow_up_due_date: null,
    date_client_signed: null,
    final_apqr_delivery_date: null,
    delivery_classification: null,
    days_remaining_or_overdue: -10,
    record_status: 'active',
    updated_at: '2026-06-26T00:00:00.000Z',
    priority: 'Overdue Commitment',
    missing_critical_count: 2,
    ...partial,
  }
}

describe('apqrDashboard', () => {
  it('builds default APQR review cycle as Nov–Oct', () => {
    const cycle = defaultApqrReviewCycle(new Date('2026-07-04T12:00:00Z'))
    expect(cycle).toEqual({ start: '2025-11-01', end: '2026-10-31' })
    expect(formatReviewCycleLabel(cycle.start, cycle.end)).toContain('Nov 2025')
  })

  it('filters rows by overlapping review coverage', () => {
    const rows = [
      row({ apqr_id: 'A' }),
      row({
        apqr_id: 'B',
        review_coverage_start: '2024-11-01',
        review_coverage_end: '2025-10-31',
      }),
    ]
    const filtered = filterRowsByReviewCycle(rows, '2025-11-01', '2026-10-31')
    expect(filtered.map((item) => item.apqr_id)).toEqual(['A'])
  })

  it('groups triage distribution buckets', () => {
    const slices = buildTriageDistribution([
      row({ priority: 'Overdue Commitment' }),
      row({ apqr_id: '2', priority: 'Completed' }),
    ])
    expect(slices.find((slice) => slice.name === 'Overdue')?.value).toBe(1)
    expect(slices.find((slice) => slice.name === 'Completed')?.value).toBe(1)
  })

  it('prioritises upcoming actions by urgency', () => {
    const actions = buildUpcomingActions([
      row({ priority: 'Moderate Priority', days_remaining_or_overdue: 40 }),
      row({ apqr_id: '2', priority: 'Overdue Commitment', days_remaining_or_overdue: -5 }),
    ])
    expect(actions[0]?.title).toBe('Overdue Commitments')
  })

  it('formats metric trend direction', () => {
    expect(formatMetricTrend(12, 10, false).tone).toBe('bad')
    expect(formatMetricTrend(8, 10, false).tone).toBe('good')
  })
})
