import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import {
  ApqrError,
  ApqrIcon,
  ApqrLoading,
  ApqrPackageBadge,
  ApqrPage,
} from '../../components/apqr/ApqrComponents'
import {
  ApqrSchedulerFormPanel,
  ApqrSchedulerViewDialog,
} from '../../components/apqr/ApqrSchedulerFormPanel'
import {
  ApqrSchedulerScheduleTable,
  exportSchedulerScheduleCsv,
} from '../../components/apqr/ApqrSchedulerScheduleTable'
import { useToast } from '../../components/feedback/ToastProvider'
import { useAuth } from '../../hooks/useAuth'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { logApqrAudit, buildFieldDescription } from '../../features/apqr/apqrAudit'
import {
  appendRemark,
  computedScheduleDates,
  currentCycleYear,
  emptyScheduleRow,
  formatOverrideRemark,
  generateNextApqrCycle,
  reviewCoverageNeedsReason,
  rowFromSchedulerEntry,
  stabilityTabulationConflict,
  type ScheduleRowDraft,
} from '../../features/apqr/schedulerForm'
import { saveSchedulerRows } from '../../features/apqr/apqrService'
import { useApqrClients, useApqrScheduler } from '../../features/apqr/useApqrData'

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

function rowIdentity(row: ScheduleRowDraft, index: number) {
  return row.id ?? `draft-${index}-${row.product_code}-${row.review_coverage_start}`
}

export function ApqrSchedulerPage() {
  const { data: clients, loading: clientsLoading, error: clientsError } = useApqrClients()
  const [searchParams] = useSearchParams()
  const [clientId, setClientId] = useState<string | null>(searchParams.get('client'))
  const scheduler = useApqrScheduler(clientId)
  const { canCreate, canEdit, canExport } = useMenuPermission('apqr-scheduler')
  const { user } = useAuth()
  const { notify } = useToast()
  const actorName = user?.name ?? 'System'

  const [rows, setRows] = useState<ScheduleRowDraft[]>([])
  const [form, setForm] = useState<ScheduleRowDraft>(() => emptyScheduleRow())
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [viewRow, setViewRow] = useState<ScheduleRowDraft | null>(null)
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
  const canMutate = Boolean(canCreate || canEdit)

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
      setEditingKey(null)
      return
    }
    const clientName = selectedClient?.client_name ?? ''
    setRows(scheduler.data.map((entry) => rowFromSchedulerEntry(entry, clientName)))
    setEditingKey(null)
    setPage(1)
  }, [scheduler.data, selectedClient?.client_name])

  useEffect(() => {
    if (!selectedClient) return
    setForm((prev) => ({
      ...emptyScheduleRow(selectedClient.client_name),
      ...prev,
      client_name: selectedClient.client_name,
    }))
  }, [selectedClient?.id, selectedClient?.client_name])

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
    setForm(emptyScheduleRow(clients?.find((c) => c.id === id)?.client_name ?? ''))
    setEditingKey(null)
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

  function clearForm() {
    setForm(emptyScheduleRow(selectedClient?.client_name ?? ''))
    setEditingKey(null)
  }

  function validateForm(draft: ScheduleRowDraft): string | null {
    if (!draft.product_name.trim() || !draft.product_code.trim()) {
      return 'Product name and code are required.'
    }
    if (draft.review_coverage_end < draft.review_coverage_start) {
      return 'Review coverage end date cannot be before the start date.'
    }
    if (
      reviewCoverageNeedsReason(draft.review_coverage_start, draft.review_coverage_end) &&
      !draft.review_coverage_adjustment_reason?.trim()
    ) {
      return 'A reason is required for non-standard review coverage.'
    }
    const dates = computedScheduleDates(draft.review_coverage_end)
    const commitment = draft.commitment_schedule ?? dates.commitment_schedule
    if (stabilityTabulationConflict(draft.stability_pull_out_date, commitment)) {
      return 'Stability tabulation completion exceeds commitment date. Adjust dates or add justification.'
    }
    return null
  }

  async function handleSubmit() {
    const error = validateForm(form)
    if (error) {
      notify(error)
      return
    }
    if (!clientId || !canMutate) {
      notify('Select a client and ensure you have edit permission.')
      return
    }

    const submitted: ScheduleRowDraft = {
      ...form,
      product_name: form.product_name.trim(),
      product_code: form.product_code.trim().toUpperCase(),
      schedule_status_date: form.schedule_status_date ?? new Date().toISOString().slice(0, 10),
      client_name: selectedClient?.client_name ?? form.client_name,
    }

    const nextRows = editingKey
      ? rows.map((row, index) => (rowIdentity(row, index) === editingKey ? { ...submitted } : row))
      : [...rows, submitted]

    setBusy(true)
    try {
      await saveSchedulerRows(clientId, nextRows, nextRows.map((r) => r.id))
      if (!editingKey) {
        setPage(Math.max(1, Math.ceil(nextRows.length / pageSize)))
      }
      await scheduler.reload()
      notify(editingKey ? 'Schedule entry updated.' : 'Schedule entry saved.')
      clearForm()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save schedule entry')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveAll() {
    if (!clientId || !canMutate || rows.length === 0) return
    setBusy(true)
    try {
      await saveSchedulerRows(clientId, rows, rows.map((r) => r.id))
      notify('Successfully Saved')
      await scheduler.reload()
      clearForm()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to Save')
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkEol(row: ScheduleRowDraft) {
    if (!canMutate) return
    const reason = window.prompt('Enter reason for marking this product as End-of-Life:')?.trim()
    if (!reason) return

    const remark = formatOverrideRemark('Product Status', row.product_status ?? 'Active', 'End-of-Life', reason, actorName)
    const updated: ScheduleRowDraft = {
      ...row,
      product_status: 'End-of-Life',
      scheduler_remarks: appendRemark(row.scheduler_remarks ?? [''], remark),
    }

    const index = rows.findIndex((item) => (row.id ? item.id === row.id : item === row))
    setRows((prev) => prev.map((item, i) => (i === index ? updated : item)))

    if (row.id) {
      await logApqrAudit({
        entity_type: 'scheduler',
        entity_id: row.id,
        entity_label: row.apqr_id ?? row.product_code,
        field_name: 'product_status',
        old_value: row.product_status ?? 'Active',
        new_value: 'End-of-Life',
        action_type: 'updated',
        description: buildFieldDescription(
          'updated',
          row.apqr_id ?? row.product_code,
          'Product Status',
          row.product_status ?? 'Active',
          'End-of-Life',
        ),
        reason,
      })
    }

    notify('Product marked as End-of-Life.')
  }

  function loadIntoForm(row: ScheduleRowDraft, editKey: string | null) {
    setForm({ ...row, client_name: selectedClient?.client_name ?? row.client_name })
    setEditingKey(editKey)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleEditSave(row: ScheduleRowDraft) {
    const index = rows.findIndex((item) => (row.id ? item.id === row.id : item === row))
    loadIntoForm(row, index >= 0 ? rowIdentity(row, index) : null)
  }

  function handleNextCycle(row: ScheduleRowDraft) {
    const next = generateNextApqrCycle({ ...row, client_name: selectedClient?.client_name ?? '' })
    loadIntoForm(next, null)
    notify('Next APQR cycle loaded into the form. Review dates and submit when ready.')
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

      {clientId && selectedClient ? (
        <>
          {bannerOpen ? (
            <div className="apqr-scheduler-banner" role="status">
              <ApqrIcon name="info" aria-hidden />
              <p>
                Commitment Date is automatically calculated as 90 days from the end of Review Coverage. Stability Pull-Out
                defaults to 60 days before coverage end. Override any calculated date with a documented reason.
              </p>
              <button
                type="button"
                className="apqr-banner-close"
                aria-label="Dismiss scheduling notice"
                onClick={() => setBannerOpen(false)}
              >
                <ApqrIcon name="close" aria-hidden />
              </button>
            </div>
          ) : null}

          <ApqrSchedulerFormPanel
            form={form}
            clientName={selectedClient.client_name}
            productSuggestions={productSuggestions}
            editable={canMutate}
            busy={busy}
            modeLabel={editingKey ? `Editing ${form.product_name || 'entry'}` : 'New schedule entry'}
            actorName={actorName}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onSubmit={handleSubmit}
            onClear={clearForm}
          />

          {scheduler.loading ? <ApqrLoading /> : null}

          <ApqrSchedulerScheduleTable
            rows={rows}
            clientName={selectedClient.client_name}
            cycleYear={currentCycleYear()}
            pagedRows={pagedRows}
            currentPage={currentPage}
            totalPages={totalPages}
            pageStart={pageStart}
            pageEnd={pageEnd}
            totalRows={totalRows}
            pageSize={pageSize}
            canExport={canExport}
            canEdit={canMutate}
            busy={busy}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            onExport={() => exportSchedulerScheduleCsv(rows, selectedClient.client_name)}
            onSaveAll={() => void handleSaveAll()}
            onView={setViewRow}
            onLoad={(row) => loadIntoForm(row, null)}
            onEditSave={handleEditSave}
            onNextCycle={handleNextCycle}
            onMarkEol={(row) => void handleMarkEol(row)}
          />

          <ApqrSchedulerViewDialog
            row={viewRow}
            clientName={selectedClient.client_name}
            open={Boolean(viewRow)}
            onClose={() => setViewRow(null)}
          />
        </>
      ) : null}
    </ApqrPage>
  )
}
