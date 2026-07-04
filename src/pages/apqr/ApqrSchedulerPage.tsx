import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import {
  ApqrCommitmentStatusBadge,
  ApqrError,
  ApqrIcon,
  ApqrLoading,
  ApqrPackageBadge,
  ApqrPage,
} from '../../components/apqr/ApqrComponents'
import { useToast } from '../../components/feedback/ToastProvider'
import { useMenuPermission } from '../../hooks/usePermissions'
import { defaultApqrReviewCycle } from '../../features/apqr/apqrDashboard'
import {
  defaultCommitmentSchedule,
  defaultStabilityPullOutDate,
  expectedStabilityTabulationCompletionDate,
} from '../../features/apqr/scheduling'
import {
  archiveSchedulerEntry,
  formatApqrDate,
  formatReviewCoverage,
  saveSchedulerRows,
} from '../../features/apqr/apqrService'
import { useApqrClients, useApqrScheduler } from '../../features/apqr/useApqrData'
import type { ApqrSchedulerEntry, ApqrSchedulerRowInput, CommitmentScheduleStatus } from '../../features/apqr/types'
import { exportRows } from '../../utils/exportUtils'

type RowDraft = ApqrSchedulerRowInput & { id?: string; apqr_id?: string }

const PAGE_SIZE_OPTIONS = [6, 10, 25, 50]

const SCHEDULER_PAGE_PROPS = {
  icon: 'calendar',
  title: 'APQR Scheduler',
  description: 'Register products, review periods, and commitment schedules.',
  action: (
    <Link className="button secondary" to="/apqr/registry">
      <ApqrIcon name="users" />
      Client Registry
    </Link>
  ),
} as const

function emptyRow(): RowDraft {
  const cycle = defaultApqrReviewCycle()
  return {
    stability_pull_out_date: defaultStabilityPullOutDate(cycle.end),
    product_name: '',
    product_code: '',
    review_coverage_start: cycle.start,
    review_coverage_end: cycle.end,
    commitment_schedule_status: 'Planned',
    schedule_status_date: null,
  }
}

function rowFromEntry(entry: ApqrSchedulerEntry): RowDraft {
  return {
    id: entry.id,
    apqr_id: entry.apqr_id,
    stability_pull_out_date: entry.stability_pull_out_date ?? defaultStabilityPullOutDate(entry.review_coverage_end),
    product_name: entry.product_name,
    product_code: entry.product_code,
    review_coverage_start: entry.review_coverage_start,
    review_coverage_end: entry.review_coverage_end,
    review_coverage_adjustment_reason: entry.review_coverage_adjustment_reason ?? undefined,
    commitment_schedule_status: entry.commitment_schedule_status,
    schedule_status_date: entry.schedule_status_date,
    stability_pull_out_adjustment_reason: entry.stability_pull_out_adjustment_reason ?? undefined,
  }
}

export function ApqrSchedulerPage() {
  const { data: clients, loading: clientsLoading, error: clientsError } = useApqrClients()
  const [searchParams] = useSearchParams()
  const [clientId, setClientId] = useState<string | null>(searchParams.get('client'))
  const scheduler = useApqrScheduler(clientId)
  const { canCreate, canEdit, canExport } = useMenuPermission('apqr-scheduler')
  const { notify } = useToast()
  const [rows, setRows] = useState<RowDraft[]>([])
  const [draftRow, setDraftRow] = useState<RowDraft | null>(emptyRow())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [bannerOpen, setBannerOpen] = useState(true)
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [clientHighlight, setClientHighlight] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(6)
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const clientSearchRef = useRef<HTMLInputElement | null>(null)
  const clientListId = useId()
  const clientSearchId = useId()
  const clientPickerTriggerId = useId()
  const clientPickerLabelId = useId()

  const selectedClient = useMemo(() => clients?.find((c) => c.id === clientId), [clients, clientId])

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    const list = clients ?? []
    if (!q) return list
    return list.filter(
      (client) =>
        client.code.toLowerCase().includes(q) ||
        client.client_name.toLowerCase().includes(q) ||
        client.account_manager.toLowerCase().includes(q),
    )
  }, [clients, clientSearch])

  const productSuggestions = useMemo(() => {
    const names = new Set(rows.map((row) => row.product_name).filter(Boolean))
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [rows])

  const totalRows = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, currentPage, pageSize])

  const pageStart = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = Math.min(currentPage * pageSize, totalRows)

  useEffect(() => {
    const param = searchParams.get('client')
    if (param) setClientId(param)
  }, [searchParams])

  useEffect(() => {
    if (!scheduler.data) {
      setRows([])
      setEditingId(null)
      return
    }
    setRows(scheduler.data.map(rowFromEntry))
    setEditingId(null)
    setPage(1)
  }, [scheduler.data])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setClientPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  useEffect(() => {
    if (!clientPickerOpen) {
      setClientHighlight(0)
      return
    }
    setClientHighlight(0)
    clientSearchRef.current?.focus()
  }, [clientPickerOpen])

  useEffect(() => {
    setClientHighlight(0)
  }, [clientSearch, filteredClients.length])

  function selectClient(id: string) {
    setClientId(id)
    setClientPickerOpen(false)
    setClientSearch('')
  }

  function onClientMenuKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setClientPickerOpen(false)
      return
    }
    if (filteredClients.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setClientHighlight((index) => Math.min(index + 1, filteredClients.length - 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setClientHighlight((index) => Math.max(index - 1, 0))
    }
    if (event.key === 'Enter') {
      const client = filteredClients[clientHighlight]
      if (client) {
        event.preventDefault()
        selectClient(client.id)
      }
    }
  }

  function updateRow(index: number, patch: Partial<RowDraft>) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row
        const next = { ...row, ...patch }
        if (patch.review_coverage_end) {
          next.stability_pull_out_date = defaultStabilityPullOutDate(patch.review_coverage_end)
        }
        return next
      }),
    )
  }

  function updateDraft(patch: Partial<RowDraft>) {
    setDraftRow((prev) => {
      const base = prev ?? emptyRow()
      const next = { ...base, ...patch }
      if (patch.review_coverage_end) {
        next.stability_pull_out_date = defaultStabilityPullOutDate(patch.review_coverage_end)
      }
      return next
    })
  }

  function confirmDraft() {
    if (!draftRow?.product_name.trim() || !draftRow.product_code.trim()) {
      notify('Product name and code are required.')
      return
    }
    setRows((prev) => [...prev, { ...draftRow }])
    setDraftRow(emptyRow())
    setPage(Math.max(1, Math.ceil((rows.length + 1) / pageSize)))
  }

  function clearDraft() {
    setDraftRow(emptyRow())
  }

  async function removeRow(index: number) {
    const row = rows[index]
    if (!window.confirm('Are you sure you want to remove this APQR Scheduler row?')) return

    if (row.id) {
      const reason = window.prompt('Enter the reason for removing this saved scheduler row:')
      if (!reason?.trim()) return
      setBusy(true)
      try {
        await archiveSchedulerEntry(row.id, reason)
        notify('Successfully Saved')
        setRows((prev) => prev.filter((_, i) => i !== index))
        await scheduler.reload()
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Failed to Save')
      } finally {
        setBusy(false)
      }
      return
    }

    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!clientId || (!canCreate && !canEdit) || rows.length === 0) return
    setBusy(true)
    try {
      await saveSchedulerRows(
        clientId,
        rows,
        rows.map((r) => r.id).filter((id): id is string => Boolean(id)),
      )
      notify('Successfully Saved')
      await scheduler.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to Save')
    } finally {
      setBusy(false)
    }
  }

  if (clientsLoading) {
    return (
      <ApqrPage {...SCHEDULER_PAGE_PROPS}>
        <ApqrLoading />
      </ApqrPage>
    )
  }

  return (
    <ApqrPage {...SCHEDULER_PAGE_PROPS}>
      {clientsError ? <ApqrError message={clientsError} /> : null}
      {scheduler.error ? <ApqrError message={scheduler.error} /> : null}

      <section className="panel apqr-scheduler-client-panel" aria-labelledby={clientPickerLabelId}>
        <div className="apqr-scheduler-client-row">
          <div className="apqr-client-picker" ref={pickerRef}>
            <label id={clientPickerLabelId} className="apqr-field-label" htmlFor={clientPickerTriggerId}>
              Client
            </label>
            <button
              id={clientPickerTriggerId}
              type="button"
              className={[
                'apqr-client-picker-trigger',
                clientPickerOpen ? 'is-open' : '',
                selectedClient ? 'has-selection' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-haspopup="listbox"
              aria-expanded={clientPickerOpen}
              aria-controls={clientPickerOpen ? clientListId : undefined}
              onClick={() => setClientPickerOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                  if (!clientPickerOpen) {
                    event.preventDefault()
                    setClientPickerOpen(true)
                  }
                }
                if (event.key === 'Escape' && clientPickerOpen) {
                  event.preventDefault()
                  setClientPickerOpen(false)
                }
              }}
            >
              <span className="apqr-client-picker-trigger-icon" aria-hidden="true">
                <ApqrIcon name="users" />
              </span>
              <span className="apqr-client-picker-trigger-label">
                {selectedClient ? (
                  <>
                    <span className="apqr-client-picker-code">{selectedClient.code}</span>
                    <span className="apqr-client-picker-name">{selectedClient.client_name}</span>
                  </>
                ) : (
                  <span className="apqr-client-picker-trigger-placeholder">Select client…</span>
                )}
              </span>
              <span className="apqr-client-picker-trigger-chevron" aria-hidden="true">
                <ApqrIcon name="chevron" />
              </span>
            </button>
            {clientPickerOpen ? (
              <div className="apqr-client-picker-menu" onKeyDown={onClientMenuKeyDown}>
                <div className="apqr-client-picker-search">
                  <label className="apqr-search-field" htmlFor={clientSearchId}>
                    <span className="sr-only">Search clients</span>
                    <ApqrIcon name="search" aria-hidden />
                    <input
                      ref={clientSearchRef}
                      id={clientSearchId}
                      type="search"
                      role="combobox"
                      aria-expanded
                      aria-controls={clientListId}
                      aria-autocomplete="list"
                      value={clientSearch}
                      placeholder="Search code, name, or account manager…"
                      onChange={(e) => setClientSearch(e.target.value)}
                    />
                  </label>
                </div>
                <ul
                  id={clientListId}
                  className="apqr-client-picker-list apqr-client-picker-scroll"
                  role="listbox"
                  aria-label="Clients"
                >
                  {filteredClients.length === 0 ? (
                    <li className="apqr-client-picker-empty" role="presentation">
                      <span>No clients match your search.</span>
                    </li>
                  ) : (
                    filteredClients.map((client, index) => {
                      const selected = client.id === clientId
                      const highlighted = index === clientHighlight
                      return (
                        <li key={client.id} role="option" aria-selected={selected}>
                          <button
                            type="button"
                            className={[
                              selected ? 'is-selected' : '',
                              highlighted ? 'is-highlighted' : '',
                            ]
                              .filter(Boolean)
                              .join(' ') || undefined}
                            onMouseEnter={() => setClientHighlight(index)}
                            onClick={() => selectClient(client.id)}
                          >
                            <span className="apqr-client-picker-code">{client.code}</span>
                            <span className="apqr-client-picker-name">{client.client_name}</span>
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>
                <div className="apqr-client-picker-footer">
                  <Link className="apqr-client-picker-add" to="/apqr/registry">
                    <ApqrIcon name="plus" aria-hidden />
                    Add new client
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          {selectedClient ? (
            <article className="apqr-scheduler-client-card" aria-label="Selected client details">
              <header className="apqr-scheduler-client-card-header">
                <div className="apqr-scheduler-client-card-title">
                  <span className="apqr-scheduler-client-card-code">{selectedClient.code}</span>
                  <h2 className="apqr-scheduler-client-card-name">{selectedClient.client_name}</h2>
                </div>
                <ApqrPackageBadge apqrPackage={selectedClient.apqr_package} />
              </header>
              <dl className="apqr-scheduler-client-card-meta">
                <div className="apqr-scheduler-client-card-field">
                  <dt>Account Manager</dt>
                  <dd>{selectedClient.account_manager}</dd>
                </div>
              </dl>
            </article>
          ) : null}
        </div>
      </section>

      {clientId ? (
        <>
          {bannerOpen ? (
            <div className="apqr-scheduler-banner" role="status">
              <ApqrIcon name="info" aria-hidden />
              <p>Commitment Schedule is automatically calculated as 90 days from the end of Review Coverage.</p>
              <button
                type="button"
                className="apqr-banner-close"
                aria-label="Dismiss commitment schedule notice"
                onClick={() => setBannerOpen(false)}
              >
                <ApqrIcon name="close" aria-hidden />
              </button>
            </div>
          ) : null}

          <section className="panel apqr-scheduler-table-panel">
            <div className="panel-heading apqr-scheduler-heading">
              <h2>Scheduler Rows</h2>
              <div className="apqr-table-toolbar">
                {(canCreate || canEdit) ? (
                  <button type="button" className="button secondary" onClick={() => setDraftRow(emptyRow())}>
                    <ApqrIcon name="plus" aria-hidden />
                    Add Row
                  </button>
                ) : null}
                {(canCreate || canEdit) && rows.length > 0 ? (
                  <button type="button" className="button primary" disabled={busy} onClick={() => void handleSave()}>
                    <ApqrIcon name="save" aria-hidden />
                    Save Changes
                  </button>
                ) : null}
                {canExport ? (
                  <button type="button" className="button secondary" onClick={() => exportSchedulerCsv(rows, selectedClient?.client_name ?? 'client')}>
                    <ApqrIcon name="export" aria-hidden />
                    Export
                  </button>
                ) : null}
              </div>
            </div>

            {scheduler.loading ? <ApqrLoading /> : null}

            <div className="table-scroll apqr-scheduler-table-scroll">
              <table className="data-table apqr-scheduler-table compact">
                <thead>
                  <tr>
                    <th>Stability Pull-out Date</th>
                    <th>Product Name</th>
                    <th>Product Code</th>
                    <th>Review Coverage</th>
                    <th>Commitment Schedule</th>
                    <th>Commitment Schedule Status</th>
                    <th>Schedule Status Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(canCreate || canEdit) && draftRow ? (
                    <SchedulerEditableRow
                      row={draftRow}
                      productSuggestions={productSuggestions}
                      editable
                      onChange={updateDraft}
                      onConfirm={confirmDraft}
                      onCancel={clearDraft}
                    />
                  ) : null}

                  {pagedRows.map((row) => {
                    const globalIndex = rows.findIndex((item) => item === row)
                    const isEditing = !row.id || editingId === row.id
                    const editable = Boolean(canCreate || canEdit)

                    if (isEditing) {
                      return (
                        <SchedulerEditableRow
                          key={row.id ?? `row-${globalIndex}`}
                          row={row}
                          productSuggestions={productSuggestions}
                          editable={editable}
                          onChange={(patch) => updateRow(globalIndex, patch)}
                          onConfirm={() => {
                            if (!row.product_name.trim() || !row.product_code.trim()) {
                              notify('Product name and code are required.')
                              return
                            }
                            if (row.id) setEditingId(null)
                          }}
                          onCancel={() => {
                            if (!row.id) {
                              void removeRow(globalIndex)
                              return
                            }
                            const original = scheduler.data?.find((entry) => entry.id === row.id)
                            if (original) updateRow(globalIndex, rowFromEntry(original))
                            setEditingId(null)
                          }}
                          onDelete={() => void removeRow(globalIndex)}
                          showDelete={Boolean(row.id)}
                        />
                      )
                    }

                    return (
                      <SchedulerViewRow
                        key={row.id ?? `row-${globalIndex}`}
                        row={row}
                        editable={editable}
                        onEdit={() => row.id && setEditingId(row.id)}
                        onDelete={() => void removeRow(globalIndex)}
                      />
                    )
                  })}
                </tbody>
              </table>
              {rows.length === 0 && !draftRow ? (
                <p className="messages-empty apqr-scheduler-empty">No scheduler rows yet. Use Add Row to register a product.</p>
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
                      setPageSize(Number(e.target.value))
                      setPage(1)
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="apqr-pagination-buttons">
                  <button type="button" className="button secondary" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
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
                            onClick={() => setPage(n)}
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
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </ApqrPage>
  )
}

function SchedulerViewRow({
  row,
  editable,
  onEdit,
  onDelete,
}: {
  row: RowDraft
  editable: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const commitment = defaultCommitmentSchedule(row.review_coverage_end)

  return (
    <tr className="apqr-scheduler-view-row">
      <td className="apqr-scheduler-date-cell">{formatApqrDate(row.stability_pull_out_date)}</td>
      <td>
        {row.apqr_id ? (
          <Link to={`/apqr/form?apqr=${encodeURIComponent(row.apqr_id)}`}>{row.product_name}</Link>
        ) : (
          row.product_name
        )}
      </td>
      <td className="apqr-scheduler-code-cell">{row.product_code}</td>
      <td className="apqr-scheduler-coverage-cell">
        <span className="apqr-scheduler-coverage">
          {formatReviewCoverage(row.review_coverage_start, row.review_coverage_end)}
        </span>
      </td>
      <td className="apqr-scheduler-date-cell">{formatApqrDate(commitment)}</td>
      <td className="apqr-scheduler-status-cell">
        <ApqrCommitmentStatusBadge status={row.commitment_schedule_status} />
      </td>
      <td className="apqr-scheduler-date-cell">{formatApqrDate(row.schedule_status_date)}</td>
      <td>
        <div className="apqr-scheduler-row-actions">
          {editable ? (
            <>
              <button type="button" className="button secondary apqr-icon-btn" aria-label="Edit row" onClick={onEdit}>
                <ApqrIcon name="edit" />
              </button>
              <button type="button" className="button secondary apqr-icon-btn" aria-label="Delete row" onClick={onDelete}>
                <ApqrIcon name="trash" />
              </button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

function SchedulerEditableRow({
  row,
  productSuggestions,
  editable,
  onChange,
  onConfirm,
  onCancel,
  onDelete,
  showDelete = true,
}: {
  row: RowDraft
  productSuggestions: string[]
  editable: boolean
  onChange: (patch: Partial<RowDraft>) => void
  onConfirm: () => void
  onCancel: () => void
  onDelete?: () => void
  showDelete?: boolean
}) {
  const commitment = defaultCommitmentSchedule(row.review_coverage_end)
  const expectedStab = expectedStabilityTabulationCompletionDate(row.stability_pull_out_date)
  const stabConflict = expectedStab > commitment

  return (
    <tr className="apqr-scheduler-edit-row">
      <td>
        <input
          type="date"
          value={row.stability_pull_out_date}
          disabled={!editable}
          onChange={(e) => onChange({ stability_pull_out_date: e.target.value })}
        />
        {stabConflict ? <span className="form-error">Stability completion exceeds commitment</span> : null}
      </td>
      <td>
        <input
          list={`apqr-products-${row.id ?? 'draft'}`}
          value={row.product_name}
          disabled={!editable}
          placeholder="Select product"
          onChange={(e) => onChange({ product_name: e.target.value })}
        />
        <datalist id={`apqr-products-${row.id ?? 'draft'}`}>
          {productSuggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </td>
      <td>
        <input
          value={row.product_code}
          disabled={!editable}
          placeholder="Code"
          onChange={(e) => onChange({ product_code: e.target.value.toUpperCase() })}
        />
      </td>
      <td className="apqr-scheduler-coverage-cell">
        <div className="apqr-review-range apqr-review-range--edit">
          <input
            type="date"
            value={row.review_coverage_start}
            disabled={!editable}
            aria-label="Review coverage start"
            onChange={(e) => onChange({ review_coverage_start: e.target.value })}
          />
          <span className="apqr-review-range-sep" aria-hidden>to</span>
          <input
            type="date"
            value={row.review_coverage_end}
            disabled={!editable}
            aria-label="Review coverage end"
            onChange={(e) => onChange({ review_coverage_end: e.target.value })}
          />
        </div>
      </td>
      <td>
        <input type="date" value={commitment} readOnly aria-label="Commitment schedule" />
      </td>
      <td>
        <select
          value={row.commitment_schedule_status}
          disabled={!editable}
          onChange={(e) => onChange({ commitment_schedule_status: e.target.value as CommitmentScheduleStatus })}
        >
          <option value="Planned">Planned</option>
          <option value="For Client Approval">For Client Approval</option>
          <option value="Client Approved">Client Approved</option>
        </select>
      </td>
      <td>
        <input
          type="date"
          value={row.schedule_status_date ?? ''}
          disabled={!editable}
          onChange={(e) => onChange({ schedule_status_date: e.target.value || null })}
        />
      </td>
      <td>
        <div className="apqr-scheduler-row-actions">
          <button type="button" className="button secondary apqr-icon-btn" aria-label="Confirm row" onClick={onConfirm}>
            <ApqrIcon name="check" />
          </button>
          <button type="button" className="button secondary apqr-icon-btn" aria-label="Cancel edit" onClick={onCancel}>
            <ApqrIcon name="close" />
          </button>
          {onDelete && showDelete ? (
            <button type="button" className="button secondary apqr-icon-btn" aria-label="Delete row" onClick={onDelete}>
              <ApqrIcon name="trash" />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

function exportSchedulerCsv(rows: RowDraft[], clientName: string) {
  exportRows(
    rows.map((row) => ({
      'Stability Pull-out Date': row.stability_pull_out_date,
      'Product Name': row.product_name,
      'Product Code': row.product_code,
      'Review Coverage Start': row.review_coverage_start,
      'Review Coverage End': row.review_coverage_end,
      'Commitment Schedule': defaultCommitmentSchedule(row.review_coverage_end),
      'Commitment Schedule Status': row.commitment_schedule_status,
      'Schedule Status Date': row.schedule_status_date ?? '',
    })),
    `apqr-scheduler-${clientName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
  )
}
