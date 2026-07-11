import { Link } from 'react-router-dom'

import { ApqrIcon } from './ApqrComponents'
import { formatApqrDate, formatReviewCoverage } from '../../features/apqr/apqrService'
import { formatAppMonthYear } from '../../utils/dateUtils'
import { scheduleStatusLabel, type ScheduleRowDraft } from '../../features/apqr/schedulerForm'
import { useColumnResize } from '../../hooks/useColumnResize'
import { exportRows } from '../../utils/exportUtils'

type ColumnKey =
  | 'stability_pull_out'
  | 'apqr_generation'
  | 'product_name'
  | 'product_code'
  | 'review_coverage'
  | 'commitment_date'
  | 'schedule_status'
  | 'schedule_status_date'
  | 'actions'

const COLUMN_LABELS: Record<ColumnKey, string> = {
  stability_pull_out: 'Stability Pull Out Date',
  apqr_generation: 'APQR Generation Report Date',
  product_name: 'Product Name',
  product_code: 'Product Code',
  review_coverage: 'Review Coverage',
  commitment_date: 'Commitment Date',
  schedule_status: 'Schedule Status',
  schedule_status_date: 'Schedule Status Date',
  actions: 'Action',
}

const COLUMN_ORDER: ColumnKey[] = Object.keys(COLUMN_LABELS) as ColumnKey[]

export function ApqrSchedulerScheduleTable({
  rows,
  filteredRows,
  search,
  onSearchChange,
  clientName,
  cycleYear,
  cycleYearOptions,
  onCycleYearChange,
  canExport,
  canEdit,
  busy,
  onExport,
  onSaveAll,
  onView,
  onLoad,
  onEditSave,
  onNextCycle,
  onMarkEol,
}: {
  rows: ScheduleRowDraft[]
  filteredRows: ScheduleRowDraft[]
  search: string
  onSearchChange: (value: string) => void
  clientName: string
  cycleYear: number
  cycleYearOptions: number[]
  onCycleYearChange: (year: number) => void
  canExport: boolean
  canEdit: boolean
  busy: boolean
  onExport: () => void
  onSaveAll: () => void
  onView: (row: ScheduleRowDraft) => void
  onLoad: (row: ScheduleRowDraft) => void
  onEditSave: (row: ScheduleRowDraft) => void
  onNextCycle: (row: ScheduleRowDraft) => void
  onMarkEol: (row: ScheduleRowDraft) => void
}) {
  const { getColumnStyle, onResizeHandleMouseDown } = useColumnResize<ColumnKey>(
    'apqr-scheduler-column-widths',
  )
  const totalRows = filteredRows.length

  return (
    <section className="panel apqr-scheduler-table-panel" aria-labelledby="apqr-scheduler-table-title">
      <div className="panel-heading apqr-scheduler-heading">
        <div className="apqr-scheduler-table-titles">
          <h2 id="apqr-scheduler-table-title">APQR Schedule for {clientName}</h2>
          <label className="apqr-scheduler-cycle-year" htmlFor="apqr-scheduler-cycle-year">
            <span>APQR Cycle Year</span>
            <select
              id="apqr-scheduler-cycle-year"
              value={cycleYear}
              aria-label="Filter by APQR cycle year from commitment date"
              onChange={(e) => onCycleYearChange(Number(e.target.value))}
            >
              {cycleYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="apqr-table-toolbar">
          <label className="apqr-search-field">
            <ApqrIcon name="search" />
            <input
              type="search"
              value={search}
              placeholder="Search product, code, status…"
              aria-label="Filter APQR schedule entries"
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </label>
          {canEdit && rows.length > 0 ? (
            <button type="button" className="button primary" disabled={busy} onClick={onSaveAll}>
              <ApqrIcon name="save" />
              Save All
            </button>
          ) : null}
          {canExport ? (
            <button type="button" className="button secondary" disabled={!totalRows} onClick={onExport}>
              <ApqrIcon name="export" />
              Export CSV
            </button>
          ) : null}
        </div>
      </div>

      <div className="table-scroll apqr-scheduler-table-scroll">
        <table className="data-table apqr-scheduler-table compact">
          <thead>
            <tr>
              {COLUMN_ORDER.map((key) => (
                <th key={key} style={getColumnStyle(key)}>
                  {COLUMN_LABELS[key]}
                  {key !== 'actions' ? (
                    <span
                      className="apqr-col-resize-handle"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${COLUMN_LABELS[key]} column`}
                      onMouseDown={(event) => onResizeHandleMouseDown(key, event)}
                    />
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const rowKey = row.id ?? `${row.product_code}-${row.review_coverage_start}`
              const generationDate = row.apqr_generation_date ?? ''
              const commitmentDate = row.commitment_schedule ?? ''

              return (
                <tr key={rowKey} className="apqr-scheduler-view-row">
                  <td className="apqr-scheduler-date-cell" style={getColumnStyle('stability_pull_out')}>
                    {formatApqrDate(row.stability_pull_out_date)}
                  </td>
                  <td className="apqr-scheduler-date-cell" style={getColumnStyle('apqr_generation')}>
                    {formatAppMonthYear(generationDate || null)}
                  </td>
                  <td style={getColumnStyle('product_name')}>
                    {row.apqr_id ? (
                      <Link to={`/apqr/form?apqr=${encodeURIComponent(row.apqr_id)}`}>{row.product_name}</Link>
                    ) : (
                      row.product_name
                    )}
                    {row.product_status === 'End-of-Life' ? (
                      <span className="status-pill warning apqr-scheduler-eol-pill">EOL</span>
                    ) : null}
                  </td>
                  <td className="apqr-scheduler-code-cell" style={getColumnStyle('product_code')}>
                    {row.product_code}
                  </td>
                  <td className="apqr-scheduler-coverage-cell" style={getColumnStyle('review_coverage')}>
                    <span className="apqr-scheduler-coverage">
                      {formatReviewCoverage(row.review_coverage_start, row.review_coverage_end)}
                    </span>
                  </td>
                  <td className="apqr-scheduler-date-cell" style={getColumnStyle('commitment_date')}>
                    {formatApqrDate(commitmentDate || null)}
                  </td>
                  <td className="apqr-scheduler-status-cell" style={getColumnStyle('schedule_status')}>
                    <span className={`status-pill ${row.commitment_schedule_status === 'Client Approved' ? 'success' : row.commitment_schedule_status === 'For Client Approval' ? 'warning' : 'info'}`}>
                      {scheduleStatusLabel(row.commitment_schedule_status)}
                    </span>
                  </td>
                  <td className="apqr-scheduler-date-cell" style={getColumnStyle('schedule_status_date')}>
                    {formatApqrDate(row.schedule_status_date)}
                  </td>
                  <td style={getColumnStyle('actions')}>
                    <div className="apqr-scheduler-row-actions">
                      <button
                        type="button"
                        className="button secondary apqr-icon-btn"
                        aria-label={`View schedule for ${row.product_name}`}
                        title="View complete schedule"
                        onClick={() => onView(row)}
                      >
                        <ApqrIcon name="eye" />
                      </button>
                      <button
                        type="button"
                        className="button secondary apqr-icon-btn"
                        aria-label={`Load ${row.product_name} into form`}
                        title="Load into form"
                        disabled={!canEdit}
                        onClick={() => onLoad(row)}
                      >
                        <ApqrIcon name="load" />
                      </button>
                      {canEdit ? (
                        <>
                          <button
                            type="button"
                            className="button secondary apqr-icon-btn"
                            aria-label={`Edit and save ${row.product_name}`}
                            title="Edit and save"
                            onClick={() => onEditSave(row)}
                          >
                            <ApqrIcon name="edit" />
                          </button>
                          <button
                            type="button"
                            className="button secondary apqr-icon-btn"
                            aria-label={`Generate next APQR cycle for ${row.product_name}`}
                            title="Generate next APQR cycle"
                            onClick={() => onNextCycle(row)}
                          >
                            <ApqrIcon name="cycle" />
                          </button>
                          <button
                            type="button"
                            className="button secondary apqr-icon-btn"
                            aria-label={`Mark ${row.product_name} as End-of-Life`}
                            title="Mark End-of-Life"
                            disabled={row.product_status === 'End-of-Life'}
                            onClick={() => onMarkEol(row)}
                          >
                            <ApqrIcon name="warning" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="messages-empty apqr-scheduler-empty">
            No APQR schedule entries yet. Complete the form above and click Submit.
          </p>
        ) : totalRows === 0 ? (
          <p className="messages-empty apqr-scheduler-empty">
            No entries for cycle year {cycleYear}
            {search.trim() ? ' match the current search' : ''}. Try another cycle year
            {search.trim() ? ' or clear the search' : ''}.
          </p>
        ) : null}
      </div>

      {totalRows > 0 ? (
        <div className="apqr-scheduler-table-footer" aria-live="polite">
          {totalRows} {totalRows === 1 ? 'entry' : 'entries'} for cycle year {cycleYear}
        </div>
      ) : null}
    </section>
  )
}

export function exportSchedulerScheduleCsv(rows: ScheduleRowDraft[], clientName: string) {
  exportRows(
    rows.map((row) => ({
      'Stability Pull Out Date': row.stability_pull_out_date,
      'APQR Generation Report Date': row.apqr_generation_date ?? '',
      'Product Name': row.product_name,
      'Product Code': row.product_code,
      'Product Status': row.product_status ?? 'Active',
      'Review Coverage Start': row.review_coverage_start,
      'Review Coverage End': row.review_coverage_end,
      'Commitment Date': row.commitment_schedule ?? '',
      'Schedule Status': scheduleStatusLabel(row.commitment_schedule_status),
      'Schedule Status Date': row.schedule_status_date ?? '',
      'APQR Remarks': (row.scheduler_remarks ?? []).filter(Boolean).join(' | '),
    })),
    `apqr-schedule-${clientName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
  )
}
