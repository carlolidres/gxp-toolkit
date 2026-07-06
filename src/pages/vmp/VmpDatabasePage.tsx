import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { FilterSelect, StatusPill, VmpIcon } from '../../components/vmp/VmpFormFields'
import { VmpRecordDrawer } from '../../components/vmp/VmpRecordDrawer'
import { useToast } from '../../components/feedback/ToastProvider'
import { VrmsPage } from '../../components/vrms/VrmsPage'
import { useVmpApp } from '../../context/VmpAppContext'
import { useVrmsApp } from '../../context/VrmsAppContext'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { formatAppDate } from '../../utils/dateUtils'
import {
  applyVmpMasterlistFilters,
  criticalities,
  emptyVmpFilters,
  getDueMonthFromDate,
  getDueYear,
  getUniqueOptions,
  lifecycleStatuses,
  mergeVmpOptions,
  validationAreas,
  validationStatuses,
  type VmpMasterlistFilters,
  type VmpMasterlistRecord,
} from '../../lib/vmpMasterlist'

type SortKey = keyof Pick<
  VmpMasterlistRecord,
  | 'recordId'
  | 'itemName'
  | 'validationArea'
  | 'sitePlant'
  | 'department'
  | 'group'
  | 'assetTagNo'
  | 'protocolTracer'
  | 'reportTracer'
  | 'nextDueDate'
  | 'validationStatus'
>

type ColumnKey = SortKey | 'actions'

const defaultVisibleColumns: ColumnKey[] = [
  'recordId',
  'itemName',
  'validationArea',
  'sitePlant',
  'department',
  'group',
  'assetTagNo',
  'protocolTracer',
  'reportTracer',
  'nextDueDate',
  'validationStatus',
  'actions',
]

const optionalColumns: Array<{ key: ColumnKey; label: string }> = [
  { key: 'recordId', label: 'Record ID' },
  { key: 'itemName', label: 'Item / System / Area' },
  { key: 'validationArea', label: 'Validation Area' },
  { key: 'sitePlant', label: 'Site / Plant' },
  { key: 'department', label: 'Department' },
  { key: 'group', label: 'Group / Subcategory' },
  { key: 'assetTagNo', label: 'Asset / Tag No.' },
  { key: 'protocolTracer', label: 'Protocol Tracer' },
  { key: 'reportTracer', label: 'Report Tracer' },
  { key: 'nextDueDate', label: 'Next Due Date' },
  { key: 'validationStatus', label: 'Status' },
  { key: 'actions', label: 'Actions' },
]

const extendedColumnLabels: Record<string, string> = {
  reportApprovalDate: 'Report Approval Date',
  reviewFrequency: 'Review / Revalidation Frequency',
  lifecycleStatus: 'Lifecycle Status',
  criticality: 'Criticality',
  responsibleOwner: 'Responsible Owner',
  remarks: 'Remarks',
  createdBy: 'Created By',
  createdAt: 'Created At',
  updatedBy: 'Updated By',
  updatedAt: 'Updated At',
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function exportCsv(rows: VmpMasterlistRecord[]) {
  const headers = [
    'Record ID',
    'Item / System / Area Name',
    'Validation Area',
    'Site / Plant',
    'Department / Facility',
    'Group / Subcategory',
    'Asset / Tag No.',
    'Protocol Tracer',
    'Report Tracer',
    'Report Approval Date',
    'Review / Revalidation Frequency',
    'Next Due Date',
    'Validation Status',
    'Lifecycle Status',
    'Criticality',
    'Responsible Owner',
    'Remarks',
  ]
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      [
        row.recordId,
        row.itemName,
        row.validationArea,
        row.sitePlant,
        row.department,
        row.group,
        row.assetTagNo,
        row.protocolTracer,
        row.reportTracer,
        row.reportApprovalDate,
        row.reviewFrequency,
        row.nextDueDate,
        row.validationStatus,
        row.lifecycleStatus,
        row.criticality,
        row.responsibleOwner,
        row.remarks,
      ]
        .map((value) => escapeCsv(String(value ?? '')))
        .join(','),
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `vmp-database-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function isSortKey(key: ColumnKey): key is SortKey {
  return key !== 'actions'
}

export function VmpDatabasePage() {
  const { records, loading, error, archiveRecord, restoreRecord } = useVmpApp()
  const { appData } = useVrmsApp()
  const { canExport } = useMenuPermission('vmp-database')
  const { canEdit: canEditForm, canDelete: canArchive } = useMenuPermission('vmp-masterlist')
  const { notify } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState<VmpMasterlistFilters>(() => ({
    ...emptyVmpFilters,
    validationArea: searchParams.get('area') ?? '',
    sitePlant: searchParams.get('site') ?? '',
    department: searchParams.get('department') ?? '',
    group: searchParams.get('group') ?? '',
    validationStatus: searchParams.get('status') ?? '',
    lifecycleStatus: searchParams.get('lifecycle') ?? '',
    criticality: searchParams.get('criticality') ?? '',
    dueMonth: searchParams.get('dueMonth') ?? '',
    dueYear: searchParams.get('year') ?? '',
    search: searchParams.get('q') ?? '',
    showArchived: searchParams.get('archived') === '1',
  }))
  const [sortKey, setSortKey] = useState<SortKey>('nextDueDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [visibleColumns, setVisibleColumns] = useState(() => new Set<ColumnKey>(defaultVisibleColumns))
  const [selectedRecord, setSelectedRecord] = useState<VmpMasterlistRecord | null>(null)
  const [viewsOpen, setViewsOpen] = useState(false)

  const departmentOptions = useMemo(
    () => mergeVmpOptions(appData?.registries.Department ?? [], getUniqueOptions(records, 'department')),
    [appData?.registries.Department, records],
  )

  const filterOptions = useMemo(
    () => ({
      sitePlant: mergeVmpOptions(['Plant 1', 'Plant 2', 'Shared / General'], getUniqueOptions(records, 'sitePlant')),
      group: getUniqueOptions(records, 'group'),
      dueYear: Array.from(new Set(records.map((record) => getDueYear(record)).filter(Boolean))).sort(),
      dueMonth: Array.from(
        new Set(records.map((record) => getDueMonthFromDate(record.nextDueDate)).filter(Boolean)),
      ).sort(),
    }),
    [records],
  )

  const filteredRecords = useMemo(
    () => applyVmpMasterlistFilters(records, filters, 'all', new Date()),
    [filters, records],
  )

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      const left = String(a[sortKey] ?? '')
      const right = String(b[sortKey] ?? '')
      const comparison = left.localeCompare(right, undefined, { numeric: true })
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredRecords, sortDirection, sortKey])

  const pageCount = Math.max(1, Math.ceil(sortedRecords.length / rowsPerPage))
  const pageRows = sortedRecords.slice((page - 1) * rowsPerPage, page * rowsPerPage)
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'showArchived') return value === true
    return Boolean(value)
  }).length

  useEffect(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams()
      if (filters.validationArea) next.set('area', filters.validationArea)
      if (filters.sitePlant) next.set('site', filters.sitePlant)
      if (filters.department) next.set('department', filters.department)
      if (filters.group) next.set('group', filters.group)
      if (filters.validationStatus) next.set('status', filters.validationStatus)
      if (filters.lifecycleStatus) next.set('lifecycle', filters.lifecycleStatus)
      if (filters.criticality) next.set('criticality', filters.criticality)
      if (filters.dueMonth) next.set('dueMonth', filters.dueMonth)
      if (filters.dueYear) next.set('year', filters.dueYear)
      if (filters.search) next.set('q', filters.search)
      if (filters.showArchived) next.set('archived', '1')
      const recordId = current.get('recordId')
      if (recordId) next.set('recordId', recordId)
      return next
    }, { replace: true })
  }, [filters, setSearchParams])

  useEffect(() => {
    setPage(1)
  }, [filters, rowsPerPage])

  useEffect(() => {
    const recordId = searchParams.get('recordId')
    if (!recordId) return
    const match = records.find((record) => record.recordId === recordId)
    if (match) setSelectedRecord(match)
  }, [records, searchParams])

  function updateFilter<K extends keyof VmpMasterlistFilters>(key: K, value: VmpMasterlistFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function clearFilters() {
    setFilters(emptyVmpFilters)
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  async function handleArchive(record: VmpMasterlistRecord) {
    try {
      const archived = await archiveRecord(record.id)
      setSelectedRecord(archived)
      notify('Record archived.')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to archive record.')
    }
  }

  async function handleRestore(record: VmpMasterlistRecord) {
    try {
      const restored = await restoreRecord(record.id)
      setSelectedRecord(restored)
      notify('Record restored.')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to restore record.')
    }
  }

  function renderCell(record: VmpMasterlistRecord, key: ColumnKey) {
    if (key === 'actions') {
      return (
        <div className="vmp-row-actions">
          <button type="button" aria-label="View record" onClick={() => setSelectedRecord(record)}>
            <VmpIcon name="eye" />
          </button>
          {canEditForm ? (
            <Link
              to={`/vmp/masterlist?edit=${encodeURIComponent(record.recordId)}`}
              aria-label="Edit record"
              className="vmp-row-link"
            >
              <VmpIcon name="edit" />
            </Link>
          ) : null}
          {canArchive && !record.isArchived ? (
            <button type="button" aria-label="Archive record" onClick={() => void handleArchive(record)}>
              <VmpIcon name="archive" />
            </button>
          ) : null}
          {canArchive && record.isArchived ? (
            <button type="button" aria-label="Restore record" onClick={() => void handleRestore(record)}>
              <VmpIcon name="restore" />
            </button>
          ) : null}
        </div>
      )
    }
    if (key === 'validationStatus') return <StatusPill status={record.validationStatus} />
    if (key === 'nextDueDate') {
      const formatted = formatAppDate(record.nextDueDate, '')
      return formatted || <span className="vmp-empty-value">—</span>
    }
    const value = String(record[key] ?? '')
    return value || <span className="vmp-empty-value">—</span>
  }

  const columnLabels: Record<ColumnKey, string> = {
    recordId: 'Record ID',
    itemName: 'Item / System / Area',
    validationArea: 'Validation Area',
    sitePlant: 'Site / Plant',
    department: 'Department',
    group: 'Group / Subcategory',
    assetTagNo: 'Asset / Tag No.',
    protocolTracer: 'Protocol Tracer',
    reportTracer: 'Report Tracer',
    nextDueDate: 'Next Due Date',
    validationStatus: 'Status',
    actions: 'Actions',
  }

  return (
    <VrmsPage
      eyebrow="Validation Master Plan"
      title="VMP / Database"
      description="View and manage all saved validation masterlist records."
      actions={
        <div className="vmp-header-actions" aria-label="Database actions">
          <Link className="vrms-btn-primary vmp-action-primary" to="/vmp/masterlist">
            <VmpIcon name="plus" /> Masterlist Form
          </Link>
          {canExport ? (
            <button
              type="button"
              className="vrms-btn-secondary vmp-action-secondary"
              onClick={() => exportCsv(filteredRecords)}
            >
              <VmpIcon name="download" /> Export
            </button>
          ) : null}
          <button
            type="button"
            className="vrms-btn-secondary vmp-action-secondary"
            onClick={() => setViewsOpen((current) => !current)}
          >
            <VmpIcon name="sliders" /> Columns
          </button>
        </div>
      }
    >
      <section className="vrms-panel vmp-filter-panel" aria-label="Database filters">
        <div className="vmp-panel-heading">
          <div>
            <h2>Search and Filters</h2>
            <p>{activeFilterCount ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}` : 'No active filters'}</p>
          </div>
          <div className="vmp-filter-actions">
            <button type="button" className="vrms-btn-secondary" onClick={clearFilters}>
              Clear Filters
            </button>
            <label className="vmp-check-row">
              <input
                type="checkbox"
                checked={filters.showArchived}
                onChange={(event) => updateFilter('showArchived', event.target.checked)}
              />
              Include archived
            </label>
          </div>
        </div>
        <div className="vmp-filter-grid">
          <FilterSelect label="Validation Area" value={filters.validationArea} options={validationAreas} onChange={(value) => updateFilter('validationArea', value)} />
          <FilterSelect label="Site / Plant" value={filters.sitePlant} options={filterOptions.sitePlant} onChange={(value) => updateFilter('sitePlant', value)} />
          <FilterSelect label="Department / Facility" value={filters.department} options={departmentOptions} onChange={(value) => updateFilter('department', value)} />
          <FilterSelect label="Group / Subcategory" value={filters.group} options={filterOptions.group} onChange={(value) => updateFilter('group', value)} />
          <FilterSelect label="Validation Status" value={filters.validationStatus} options={validationStatuses} onChange={(value) => updateFilter('validationStatus', value)} />
          <FilterSelect label="Lifecycle Status" value={filters.lifecycleStatus} options={lifecycleStatuses} onChange={(value) => updateFilter('lifecycleStatus', value)} />
          <FilterSelect label="Criticality" value={filters.criticality} options={criticalities} onChange={(value) => updateFilter('criticality', value)} />
          <FilterSelect label="Due Month" value={filters.dueMonth} options={filterOptions.dueMonth} onChange={(value) => updateFilter('dueMonth', value)} />
          <FilterSelect label="Due Year" value={filters.dueYear} options={filterOptions.dueYear} onChange={(value) => updateFilter('dueYear', value)} />
          <label className="vmp-field vmp-search-field">
            <span>Search</span>
            <span className="vmp-search-input">
              <VmpIcon name="search" />
              <input
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
                placeholder="Record ID, item name, tag, tracers, department, owner…"
              />
            </span>
          </label>
        </div>
      </section>

      {viewsOpen ? (
        <section className="vrms-panel vmp-views-panel">
          <div>
            <h2>Column visibility</h2>
            <p className="vrms-muted">Additional fields are available in the record details drawer.</p>
          </div>
          <div className="vmp-column-grid">
            {optionalColumns.map((column) => (
              <label key={column.key} className="vmp-check-row">
                <input
                  type="checkbox"
                  checked={visibleColumns.has(column.key)}
                  disabled={column.key === 'actions' || column.key === 'recordId'}
                  onChange={(event) => {
                    setVisibleColumns((current) => {
                      const next = new Set(current)
                      if (event.target.checked) next.add(column.key)
                      else next.delete(column.key)
                      return next
                    })
                  }}
                />
                {column.label}
              </label>
            ))}
            {Object.entries(extendedColumnLabels).map(([key, label]) => (
              <span key={key} className="vmp-check-row vmp-check-row-muted">
                {label} (details drawer)
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="vrms-panel vmp-table-panel">
        <div className="vmp-panel-heading">
          <div>
            <h2>Saved Masterlist Records</h2>
            <p>{loading ? 'Loading…' : `${sortedRecords.length} records match the current view`}</p>
          </div>
          <label className="vmp-rows-select">
            Rows
            <select value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value))}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
          </label>
        </div>

        {error ? <p className="vmp-form-error">{error}</p> : null}

        {loading ? (
          <p className="vrms-muted">Loading masterlist records…</p>
        ) : sortedRecords.length === 0 ? (
          <div className="vmp-empty-state">
            <strong>No records found</strong>
            <p>Create a record in Masterlist Form or adjust your filters.</p>
            <Link className="vrms-btn-primary" to="/vmp/masterlist">
              Open Masterlist Form
            </Link>
          </div>
        ) : (
          <>
            <div className="vmp-table-scroll">
              <table className="vrms-table vmp-table">
                <thead>
                  <tr>
                    {optionalColumns
                      .filter((column) => visibleColumns.has(column.key))
                      .map((column) => {
                        if (!isSortKey(column.key)) {
                          return <th key={column.key}>{column.label}</th>
                        }
                        const key = column.key
                        return (
                          <th key={key}>
                            <button type="button" className="vmp-sort-button" onClick={() => handleSort(key)}>
                              {columnLabels[key]}
                              {sortKey === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
                            </button>
                          </th>
                        )
                      })}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((record) => (
                    <tr
                      key={record.id}
                      className={selectedRecord?.id === record.id ? 'is-selected' : ''}
                      onClick={() => setSelectedRecord(record)}
                    >
                      {optionalColumns
                        .filter((column) => visibleColumns.has(column.key))
                        .map((column) => (
                          <td
                            key={column.key}
                            onClick={column.key === 'actions' ? (event) => event.stopPropagation() : undefined}
                          >
                            {renderCell(record, column.key)}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="vmp-pagination">
              <button type="button" className="vrms-btn-secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </button>
              <span>
                Page {page} of {pageCount}
              </span>
              <button
                type="button"
                className="vrms-btn-secondary"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>

      {selectedRecord ? (
        <VmpRecordDrawer
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onArchive={() => void handleArchive(selectedRecord)}
          onRestore={() => void handleRestore(selectedRecord)}
          canEdit={canEditForm}
          canArchive={canArchive}
        />
      ) : null}
    </VrmsPage>
  )
}
