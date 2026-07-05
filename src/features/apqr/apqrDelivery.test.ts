import { describe, expect, it } from 'vitest'

import { buildMonthlyDeliveryTrend, requiresDelayInfo } from './apqrDelivery'
import type { ApqrDatabaseRow } from './types'

function row(partial: Partial<ApqrDatabaseRow>): ApqrDatabaseRow {
  return {
    apqr_id: 'aB01',
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
    review_coverage_start: '2026-01-01',
    review_coverage_end: '2026-12-31',
    stability_pull_out_date: '2026-11-01',
    expected_stability_tabulation_completion_date: '2027-01-30',
    stability_tabulation_status: 'Sent',
    commitment_schedule: '2027-03-31',
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
    days_remaining_or_overdue: 0,
    record_status: 'active',
    updated_at: '2026-06-26T00:00:00.000Z',
    priority: 'Low Priority',
    missing_critical_count: 0,
    ...partial,
  }
}

describe('apqrDelivery', () => {
  it('flags overdue delivery delay requirement', () => {
    expect(requiresDelayInfo('2027-03-31', '2027-04-01')).toBe(true)
    expect(requiresDelayInfo('2027-03-31', '2027-03-30')).toBe(false)
  })

  it('builds monthly delivery trend buckets', () => {
    const today = new Date()
    const monthKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`
    const trend = buildMonthlyDeliveryTrend([
      row({ final_apqr_delivery_date: `${monthKey}-15`, delivery_classification: 'Delivered On Time' }),
      row({ apqr_id: 'cD02', final_apqr_delivery_date: `${monthKey}-20`, delivery_classification: 'Delivered Overdue' }),
    ], 1)
    expect(trend).toHaveLength(1)
    expect(trend[0]?.delivered).toBe(2)
    expect(trend[0]?.onTime).toBe(1)
    expect(trend[0]?.overdue).toBe(1)
  })
})
