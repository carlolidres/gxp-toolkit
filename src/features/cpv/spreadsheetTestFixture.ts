import type { ApqrDatabaseRow } from '../apqr/types'
import { createSheet, createWorkbook, normalizeWorkbook, type EquipmentWorkbook } from '../vmp/equipmentWorkbook'

/** Isolated catalog code. It is not a real product and is absent unless the test flag is on. */
export const SPREADSHEET_FIXTURE_CODE = 'ZZ-SHEET-FIXTURE'

export function spreadsheetFixtureEnabled(): boolean {
  return import.meta.env.VITE_SPREADSHEET_FIXTURE === 'true'
}

export function spreadsheetFixtureRow(): ApqrDatabaseRow {
  return {
    apqr_id: 'fixture-apqr',
    scheduler_entry_id: 'fixture-scheduler',
    record_id: 'fixture-record',
    client_id: 'fixture-client',
    client_code: 'FIXTURE',
    client_name: 'Spreadsheet Fixture Client',
    account_manager: 'Fixture',
    apqr_package: 'Not Billable',
    auto_compute_dates: false,
    product_name: 'Spreadsheet Fixture',
    product_code: SPREADSHEET_FIXTURE_CODE,
    department: 'QA Fixture',
    review_coverage_start: '2026-01-01',
    review_coverage_end: '2026-12-31',
    stability_pull_out_date: null,
    apqr_generation_date: null,
    expected_stability_tabulation_completion_date: null,
    stability_tabulation_status: null,
    commitment_schedule: '2026-12-31',
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
  }
}

export function fixtureWorkbook(size: 'small' | 'medium' | 'large' = 'small'): EquipmentWorkbook {
  const data = createSheet('Data')
  data.id = 'fixture-data'
  data.cells = { '0:0': '2', '1:0': '3', '2:0': '=SUM(A1:A2)' }
  const extra = size === 'large' ? 5000 : size === 'medium' ? 500 : 0
  for (let index = 0; index < extra; index += 1) {
    const row = 3 + Math.floor(index / 20)
    const column = index % 20
    data.cells[`${row}:${column}`] = String(index + 1)
  }
  const notes = createSheet('Notes')
  notes.id = 'fixture-notes'
  notes.cells = { '0:0': 'Notes' }
  const book = createWorkbook()
  book.id = 'fixture-workbook'
  book.name = 'Spreadsheet Fixture'
  book.activeSheetId = data.id
  book.sheets = [data, notes]
  return normalizeWorkbook(book) ?? book
}
