import { describe, expect, it } from 'vitest'

import type { ApqrDatabaseRow } from '../apqr/types'
import { uniqueApqrProducts } from './apqrProductCatalog'

function row(partial: Partial<ApqrDatabaseRow> & Pick<ApqrDatabaseRow, 'product_code' | 'product_name'>): ApqrDatabaseRow {
  return {
    apqr_id: 'id',
    scheduler_entry_id: 'sched',
    record_id: 'rec',
    client_id: 'client',
    client_code: 'C1',
    client_name: 'Zuellig',
    account_manager: 'AM',
    apqr_package: 'Billable',
    auto_compute_dates: true,
    department: 'Dry',
    review_coverage_start: '2026-01-01',
    review_coverage_end: '2026-12-31',
    stability_pull_out_date: null,
    apqr_generation_date: null,
    expected_stability_tabulation_completion_date: null,
    stability_tabulation_status: null,
    commitment_schedule: '2026-03-01',
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
    days_remaining_or_overdue: null,
    record_status: 'active',
    updated_at: '2026-01-01T00:00:00.000Z',
    priority: 'Low Priority',
    missing_critical_count: 0,
    ...partial,
  }
}

describe('uniqueApqrProducts', () => {
  it('deduplicates by product code and prefers the latest active row', () => {
    const products = uniqueApqrProducts([
      row({
        product_code: 'abc-1',
        product_name: 'Old Name',
        client_name: 'Old Client',
        record_status: 'archived',
        updated_at: '2026-08-01T00:00:00.000Z',
      }),
      row({
        apqr_id: 'current',
        product_code: 'ABC-1',
        product_name: 'Current Name',
        client_name: 'Zuellig Pharma',
        updated_at: '2026-06-01T00:00:00.000Z',
      }),
      row({
        product_code: 'XYZ-9',
        product_name: 'Second',
        client_name: 'Other',
      }),
    ])
    expect(products).toEqual([
      {
        product_code: 'ABC-1',
        product_name: 'Current Name',
        client_name: 'Zuellig Pharma',
        department: 'Dry',
        apqr_id: 'current',
      },
      {
        product_code: 'XYZ-9',
        product_name: 'Second',
        client_name: 'Other',
        department: 'Dry',
        apqr_id: 'id',
      },
    ])
  })

  it('keeps the APQR department from an earlier review when the latest cycle has none', () => {
    const products = uniqueApqrProducts([
      row({
        apqr_id: 'latest',
        product_code: 'TCN',
        product_name: 'Latest',
        client_name: 'Client',
        department: null,
        updated_at: '2026-09-01T00:00:00.000Z',
      }),
      row({
        product_code: 'tcn',
        product_name: 'Earlier',
        client_name: 'Client',
        department: 'Liquids',
        updated_at: '2026-03-01T00:00:00.000Z',
      }),
    ])

    expect(products).toEqual([
      {
        product_code: 'TCN',
        product_name: 'Latest',
        client_name: 'Client',
        department: 'Liquids',
        apqr_id: 'latest',
      },
    ])
  })
})
