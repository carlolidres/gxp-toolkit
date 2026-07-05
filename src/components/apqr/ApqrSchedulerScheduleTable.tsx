import { Link } from 'react-router-dom'

import { ApqrIcon } from './ApqrComponents'
import { formatApqrDate, formatReviewCoverage } from '../../features/apqr/apqrService'
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
  clientName,
  cycleYear,
  pagedRows,
  currentPage,
  totalPages,
  pageStart,
  pageEnd,
  totalRows,
  pageSize,
  canExport,
  canEdit,
  busy,
  onPageChange,
  onPageSizeChange,
  onExport,
  onSaveAll,
  onView,
  onLoad,
  onEditSave,
  onNextCycle,
  onMarkEol,
}: {
  rows: ScheduleRowDraft[]
  clientName: string
  cycleYear: number
  pagedRows: ScheduleRowDraft[]
  currentPage: number
  totalPages: number
  pageStart: number
  pageEnd: number
  totalRows: number
  pageSize: number
  canExport: boolean
  canEdit: boolean
  busy: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
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

  return (
    <section className="panel apqr-scheduler-table-panel" aria-labelledby="apqr-scheduler-table-title">
      <div className="panel-heading apqr-scheduler-heading">
        <div className="apqr-scheduler-table-titles">
          <h2 id="apqr-scheduler-table-title">APQR Schedule for {clientName}</h2>
          <p className="apqr-scheduler-cycle-year">APQR Cycle Year: {cycleYear}</p>
        </div>
        <div className="apqr-table-toolbar">
          {canEdit && rows.length > 0 ? (
            <button type="button" className="button primary" disabled={busy} onClick={onSaveAll}>
              <ApqrIcon name="save" />
              Save All
            </button>
          ) : null}
          {canExport ? (
            <button type="button" className="button secondary" disabled={!rows.length} onClick={onExport}>
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
            {pagedRows.map((row) => {
              const rowKey = row.id ?? `${row.product_code}-${row.review_coverage_start}`
              const generationDate = row.apqr_generation_date ?? ''
              const commitmentDate = row.commitment_schedule ?? ''

              return (
                <tr key={rowKey} className="apqr-scheduler-view-row">
                  <td className="apqr-scheduler-date-cell" style={getColumnStyle('stability_pull_out')}>
                    {formatApqrDate(row.stability_pull_out_date)}
                  </td>
                  <td className="apqr-scheduler-date-cell" style={getColumnStyle('apqr_generation')}>
                    {formatApqrDate(generationDate || null)}
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
        ) : null}
      </div>

      {totalRows > 0 ? (
        <div className="apqr-scheduler-pagination">
          <span>
            {pageStart} to {pageEnd} of {totalRows} entries
          </span>
          <label>
            per page
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value))
                onPageChange(1)
              }}
            >
              {[6, 10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="apqr-pagination-buttons">
            <button
              type="button"
              className="button secondary"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
              .map((n, index, list) => {
                const prev = list[index - 1]
                const gap = prev != null && n - prev > 1
                return (
                  <span key={n} className="apqr-pagination-number-wrap">
                    {gap ? <span className="apqr-pagination-ellipsis">…</span> : null}
                    <button
                      type="button"
                      className={`button secondary${n === currentPage ? ' is-active' : ''}`}
                      onClick={() => onPageChange(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button
              type="button"
              className="button secondary"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            >
              Next
            </button>
          </div>
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
