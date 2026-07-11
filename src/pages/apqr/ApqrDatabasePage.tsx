import { useId, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input } from 'antd'

import {
  ApqrDeliveryBadge,
  ApqrError,
  ApqrIcon,
  ApqrLoading,
  ApqrPage,
  ApqrPriorityBadge,
  ApqrReportStatusBadge,
} from '../../components/apqr/ApqrComponents'
import { AppDateInput } from '../../components/forms/AppDateInput'
import { formatApqrDate, formatReviewCoverage } from '../../features/apqr/apqrService'
import {
  apqrCycleYearFromCommitment,
  apqrCycleYearOptions,
  defaultApqrCycleYear,
} from '../../features/apqr/apqrDashboard'
import type { ApqrDatabaseRow, ApqrPriority, DeliveryClassification } from '../../features/apqr/types'
import {
  apqrPriorityDisplay,
  commitmentMonthFromGenerationMonth,
  defaultApqrGenerationDate,
  defaultCommitmentSchedule,
  defaultStabilityPullOutDate,
  linkedFilterMonthsFromField,
  linkedManualFilterMonthsFromField,
  manualApqrGenerationFromCommitment,
  manualStabilityPullOutDate,
  type ApqrLinkedDateField,
} from '../../features/apqr/scheduling'
import { useColumnResize } from '../../hooks/useColumnResize'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { useApqrDatabase } from '../../features/apqr/useApqrData'
import { currentAppMonthYear, dateInAppMonthYear } from '../../utils/dateUtils'
import { exportRows } from '../../utils/exportUtils'

type ColumnKey =
  | 'apqr_id'
  | 'client'
  | 'product'
  | 'department'
  | 'review_coverage'
  | 'commitment_schedule'
  | 'report_status'
  | 'apr_ref'
  | 'delivery'
  | 'priority'

type ViewMode = 'list' | 'grid'
type DeliveryFilter = 'all' | DeliveryClassification | 'pending'
type ReportFilter = 'all' | NonNullable<ApqrDatabaseRow['apqr_report_status']> | 'none'
type PriorityFilter = 'all' | ApqrPriority
type SummaryFilter = 'all' | 'overdue' | 'delivered' | 'clientApproved' | 'missingInfo'
type CycleYearFilter = 'all' | number

const DEFAULT_CYCLE_YEAR = defaultApqrCycleYear()
const DEFAULT_MONTH_YEAR = currentAppMonthYear()
const DEFAULT_LINKED_MONTHS = linkedFilterMonthsFromField('generation', DEFAULT_MONTH_YEAR) ?? {
  pullout: DEFAULT_MONTH_YEAR,
  generation: DEFAULT_MONTH_YEAR,
  commitment: DEFAULT_MONTH_YEAR,
}

const COLUMN_LABELS: Record<ColumnKey, string> = {
  apqr_id: 'APQR ID',
  client: 'Client',
  product: 'Product',
  department: 'Department',
  review_coverage: 'Review Coverage',
  commitment_schedule: 'Commitment Schedule',
  report_status: 'Report Status',
  apr_ref: 'APR Ref.',
  delivery: 'Delivery',
  priority: 'Priority',
}

const DEFAULT_COLUMNS: ColumnKey[] = Object.keys(COLUMN_LABELS) as ColumnKey[]

const DATABASE_PAGE_PROPS = {
  icon: 'database',
  headerClassName: 'apqr-page-header--database',
  title: 'APQR Database',
  description: 'Consolidated APQR records from Scheduler and Form.',
  action: (
    <Link className="button secondary apqr-page-header-action" to="/apqr/scheduler">
      <ApqrIcon name="calendar" />
      APQR Scheduler
    </Link>
  ),
} as const

export function ApqrDatabasePage() {
  const { data, loading, error } = useApqrDatabase()
  const { canExport } = useMenuPermission('apqr-database')
  const { canEdit: canEditForm } = useMenuPermission('apqr-form')

  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const autoComputeDatesId = useId()
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('all')
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [cycleYearFilter, setCycleYearFilter] = useState<CycleYearFilter>(DEFAULT_CYCLE_YEAR)
  const [autoComputeDates, setAutoComputeDates] = useState(true)
  const [linkedDateDriver, setLinkedDateDriver] = useState<ApqrLinkedDateField>('generation')
  const [pulloutDateFilter, setPulloutDateFilter] = useState(DEFAULT_LINKED_MONTHS.pullout)
  const [generationDateFilter, setGenerationDateFilter] = useState(DEFAULT_LINKED_MONTHS.generation)
  const [commitmentDateFilter, setCommitmentDateFilter] = useState(DEFAULT_LINKED_MONTHS.commitment)
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>('all')

  const { getColumnStyle, onResizeHandleMouseDown } = useColumnResize<ColumnKey>('apqr-database-column-widths')
  const rows = data ?? []
  const cycleYearOptions = useMemo(() => apqrCycleYearOptions(rows), [rows])
  const clientOptions = useMemo(() => {
    const byCode = new Map<string, string>()
    for (const row of rows) {
      if (!row.client_code || byCode.has(row.client_code)) continue
      byCode.set(row.client_code, row.client_name)
    }
    return [...byCode.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code))
  }, [rows])

  const hasDateFilters = autoComputeDates
    ? generationDateFilter !== ''
    : pulloutDateFilter !== '' || generationDateFilter !== '' || commitmentDateFilter !== ''

  const hasActiveFilters =
    summaryFilter !== 'all' ||
    cycleYearFilter !== 'all' ||
    hasDateFilters ||
    clientFilter !== 'all' ||
    deliveryFilter !== 'all' ||
    reportFilter !== 'all' ||
    priorityFilter !== 'all' ||
    search.trim().length > 0

  const summary = useMemo(
    () => ({
      totalRecords: rows.length,
      overdue: rows.filter(
        (row) =>
          row.priority === 'Overdue Commitment' ||
          row.delivery_classification === 'Currently Overdue and Undelivered',
      ).length,
      delivered: rows.filter((row) => row.final_apqr_delivery_date).length,
      clientApproved: rows.filter((row) => row.apqr_report_status === 'Client Approved').length,
      missingInfo: rows.filter((row) => row.missing_critical_count > 0).length,
    }),
    [rows],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matches = rows.filter((row) => {
      if (!rowMatchesSummaryFilter(row, summaryFilter)) return false
      if (
        cycleYearFilter !== 'all' &&
        apqrCycleYearFromCommitment(
          autoComputeDates && row.review_coverage_end?.trim()
            ? row.auto_compute_dates === false
              ? row.commitment_schedule || defaultCommitmentSchedule(row.review_coverage_end)
              : defaultCommitmentSchedule(row.review_coverage_end)
            : row.commitment_schedule,
        ) !== cycleYearFilter
      ) {
        return false
      }
      if (autoComputeDates) {
        if (!row.review_coverage_end?.trim()) return false
        const rowAuto = row.auto_compute_dates !== false
        if (linkedDateDriver === 'commitment' && commitmentDateFilter) {
          if (rowAuto) {
            const computedGeneration = defaultApqrGenerationDate(row.review_coverage_end)
            const computedCommitmentMonth = commitmentMonthFromGenerationMonth(computedGeneration.slice(0, 7))
            if (computedCommitmentMonth !== commitmentDateFilter) return false
          } else {
            const commitment =
              row.commitment_schedule || defaultCommitmentSchedule(row.review_coverage_end)
            if (!dateInAppMonthYear(commitment, commitmentDateFilter)) return false
          }
        } else if (linkedDateDriver === 'pullout' && pulloutDateFilter) {
          const pullout = rowAuto
            ? defaultStabilityPullOutDate(row.review_coverage_end)
            : manualStabilityPullOutDate(row.review_coverage_end)
          if (!dateInAppMonthYear(pullout, pulloutDateFilter)) return false
        } else if (generationDateFilter) {
          if (rowAuto) {
            if (!dateInAppMonthYear(defaultApqrGenerationDate(row.review_coverage_end), generationDateFilter)) {
              return false
            }
          } else {
            const commitment =
              row.commitment_schedule || defaultCommitmentSchedule(row.review_coverage_end)
            const generation = manualApqrGenerationFromCommitment(commitment)
            if (!dateInAppMonthYear(generation, generationDateFilter)) return false
          }
        }
      } else {
        if (pulloutDateFilter && !dateInAppMonthYear(row.stability_pull_out_date, pulloutDateFilter)) return false
        if (generationDateFilter && !dateInAppMonthYear(row.apqr_generation_date, generationDateFilter)) return false
        if (commitmentDateFilter && !dateInAppMonthYear(row.commitment_schedule, commitmentDateFilter)) return false
      }
      if (clientFilter !== 'all' && row.client_code !== clientFilter) return false
      if (deliveryFilter === 'pending' && row.delivery_classification) return false
      if (deliveryFilter !== 'all' && deliveryFilter !== 'pending' && row.delivery_classification !== deliveryFilter) {
        return false
      }
      if (reportFilter === 'none' && row.apqr_report_status) return false
      if (reportFilter !== 'all' && reportFilter !== 'none' && row.apqr_report_status !== reportFilter) return false
      if (priorityFilter !== 'all' && row.priority !== priorityFilter) return false
      if (!q) return true
      return (
        row.apqr_id.toLowerCase().includes(q) ||
        row.client_name.toLowerCase().includes(q) ||
        row.client_code.toLowerCase().includes(q) ||
        row.product_name.toLowerCase().includes(q) ||
        row.product_code.toLowerCase().includes(q) ||
        (row.apr_reference_number ?? '').toLowerCase().includes(q) ||
        (row.department ?? '').toLowerCase().includes(q)
      )
    })
    return sortRowsBySummaryFilter(matches, summaryFilter)
  }, [
    rows,
    search,
    clientFilter,
    deliveryFilter,
    reportFilter,
    priorityFilter,
    summaryFilter,
    cycleYearFilter,
    autoComputeDates,
    linkedDateDriver,
    pulloutDateFilter,
    generationDateFilter,
    commitmentDateFilter,
  ])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (summaryFilter !== 'all') count += 1
    if (cycleYearFilter !== 'all') count += 1
    if (autoComputeDates) {
      if (generationDateFilter) count += 1
    } else {
      if (pulloutDateFilter) count += 1
      if (generationDateFilter) count += 1
      if (commitmentDateFilter) count += 1
    }
    if (clientFilter !== 'all') count += 1
    if (deliveryFilter !== 'all') count += 1
    if (reportFilter !== 'all') count += 1
    if (priorityFilter !== 'all') count += 1
    return count
  }, [
    summaryFilter,
    cycleYearFilter,
    autoComputeDates,
    pulloutDateFilter,
    generationDateFilter,
    commitmentDateFilter,
    clientFilter,
    deliveryFilter,
    reportFilter,
    priorityFilter,
  ])

  function applyLinkedMonths(months: { pullout: string; generation: string; commitment: string }) {
    setPulloutDateFilter(months.pullout)
    setGenerationDateFilter(months.generation)
    setCommitmentDateFilter(months.commitment)
  }

  function handleAutoComputeToggle(enabled: boolean) {
    setAutoComputeDates(enabled)
    if (enabled) {
      const base =
        generationDateFilter || pulloutDateFilter || commitmentDateFilter || DEFAULT_MONTH_YEAR
      const field: ApqrLinkedDateField = generationDateFilter
        ? 'generation'
        : pulloutDateFilter
          ? 'pullout'
          : commitmentDateFilter
            ? 'commitment'
            : 'generation'
      const linked = linkedFilterMonthsFromField(field, base) ?? DEFAULT_LINKED_MONTHS
      setLinkedDateDriver(field)
      applyLinkedMonths(linked)
      return
    }
    // Manual Dates: keep current months; Commitment will drive Generation on change.
    setLinkedDateDriver('commitment')
  }

  function handleDateFilterChange(field: ApqrLinkedDateField, value: string) {
    if (!autoComputeDates) {
      const linked = linkedManualFilterMonthsFromField(field, value, {
        pullout: pulloutDateFilter,
        generation: generationDateFilter,
        commitment: commitmentDateFilter,
      })
      setLinkedDateDriver(field)
      applyLinkedMonths(linked)
      return
    }
    if (!value) {
      setPulloutDateFilter('')
      setGenerationDateFilter('')
      setCommitmentDateFilter('')
      return
    }
    const linked = linkedFilterMonthsFromField(field, value)
    if (linked) {
      setLinkedDateDriver(field)
      applyLinkedMonths(linked)
    }
  }

  function clearAllFilters() {
    setSearch('')
    setSummaryFilter('all')
    setCycleYearFilter('all')
    setLinkedDateDriver('generation')
    setPulloutDateFilter('')
    setGenerationDateFilter('')
    setCommitmentDateFilter('')
    setClientFilter('all')
    setDeliveryFilter('all')
    setReportFilter('all')
    setPriorityFilter('all')
  }

  function toggleSummaryFilter(next: Exclude<SummaryFilter, 'all'>) {
    setSummaryFilter((current) => (current === next ? 'all' : next))
  }

  if (loading) {
    return (
      <ApqrPage {...DATABASE_PAGE_PROPS}>
        <ApqrLoading />
      </ApqrPage>
    )
  }

  return (
    <ApqrPage {...DATABASE_PAGE_PROPS}>
      {error ? <ApqrError message={error} /> : null}

      <div className="apqr-database-summary-board">
        <section className="apqr-database-summary" aria-label="APQR database summary">
          <SummaryStat
            label="Total Records"
            value={summary.totalRecords}
            tone="info"
            icon="stack"
            active={summaryFilter === 'all'}
            onClick={() => setSummaryFilter('all')}
          />
          <SummaryStat
            label="Overdue"
            value={summary.overdue}
            tone="danger"
            icon="alert"
            active={summaryFilter === 'overdue'}
            onClick={() => toggleSummaryFilter('overdue')}
          />
          <SummaryStat
            label="Delivered"
            value={summary.delivered}
            tone="success"
            icon="check"
            active={summaryFilter === 'delivered'}
            onClick={() => toggleSummaryFilter('delivered')}
          />
          <SummaryStat
            label="Client Approved"
            value={summary.clientApproved}
            tone="success"
            icon="user"
            active={summaryFilter === 'clientApproved'}
            onClick={() => toggleSummaryFilter('clientApproved')}
          />
          <SummaryStat
            label="Missing Info"
            value={summary.missingInfo}
            tone="warning"
            icon="info"
            active={summaryFilter === 'missingInfo'}
            onClick={() => toggleSummaryFilter('missingInfo')}
          />
        </section>
      </div>

      <section className="panel apqr-database-panel" aria-labelledby="apqr-database-list-title">
        <div className="panel-heading apqr-database-heading">
          <div className="apqr-database-heading-title">
            <h2 id="apqr-database-list-title">
              <ApqrIcon name="database" />
              All APQR Records
            </h2>
            <span className="apqr-database-count" aria-label={`${filtered.length} records`}>
              {filtered.length}
            </span>
          </div>
          <div className="apqr-table-toolbar">
            <label className="apqr-search-field">
              <ApqrIcon name="search" />
              <Input
                type="search"
                value={search}
                placeholder="Search APQR ID, client, product, APR ref…"
                aria-label="Search APQR records"
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <Button
              className={`button secondary${filtersOpen || activeFilterCount > 0 ? ' is-active' : ''}`}
              aria-expanded={filtersOpen}
              aria-controls="apqr-database-filters"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <ApqrIcon name="filter" />
              Filter
              {activeFilterCount > 0 ? (
                <span className="apqr-filter-count" aria-hidden>
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
            <div className="apqr-columns-menu">
              <Button
                className={`button secondary${columnsOpen ? ' is-active' : ''}`}
                aria-expanded={columnsOpen}
                aria-controls="apqr-database-columns-popover"
                onClick={() => setColumnsOpen((open) => !open)}
              >
                <ApqrIcon name="columns" />
                Columns
              </Button>
              {columnsOpen ? (
                <div
                  id="apqr-database-columns-popover"
                  className="apqr-columns-popover apqr-database-columns-popover"
                  role="menu"
                >
                  <p className="apqr-columns-popover-title">
                    <ApqrIcon name="columns" />
                    Visible columns
                  </p>
                  {DEFAULT_COLUMNS.map((key) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(key)}
                        onChange={() => {
                          setVisibleColumns((current) =>
                            current.includes(key)
                              ? current.filter((col) => col !== key)
                              : [...current, key],
                          )
                        }}
                      />
                      {COLUMN_LABELS[key]}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            {canExport ? (
              <Button
                className="button secondary apqr-icon-btn"
                aria-label="Export"
                onClick={() => exportDatabaseCsv(filtered)}
              >
                <ApqrIcon name="export" />
              </Button>
            ) : null}
            <div className="apqr-view-toggle" role="group" aria-label="View mode">
              <Button
                className={`button secondary apqr-icon-btn${viewMode === 'list' ? ' is-active' : ''}`}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}
              >
                <ApqrIcon name="list" />
              </Button>
              <Button
                className={`button secondary apqr-icon-btn${viewMode === 'grid' ? ' is-active' : ''}`}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
              >
                <ApqrIcon name="grid" />
              </Button>
            </div>
          </div>
        </div>

        {filtersOpen ? (
          <div id="apqr-database-filters" className="apqr-database-filters" role="search" aria-label="APQR record filters">
            <div className="apqr-database-filters-header">
              <div className="apqr-database-filters-title">
                <ApqrIcon name="filter" width={16} height={16} />
                <span>Record filters</span>
                {activeFilterCount > 0 ? (
                  <span className="apqr-database-filters-active-count" aria-live="polite">
                    {activeFilterCount} active
                  </span>
                ) : null}
              </div>
              <label className="apqr-database-auto-compute-toggle" htmlFor={autoComputeDatesId}>
                <input
                  id={autoComputeDatesId}
                  type="checkbox"
                  checked={autoComputeDates}
                  onChange={(e) => handleAutoComputeToggle(e.target.checked)}
                />
                {autoComputeDates ? 'Auto-Compute Dates' : 'Manual Dates'}
              </label>
            </div>
            <p className="apqr-database-auto-compute-hint help-text">
              {autoComputeDates
                ? 'Auto-Compute: Pullout = coverage end − 60 days, Generation = end + 30 days, Commitment = Generation + 2 months. Per-client Manual Dates rows use Pullout = end − 2 months and Generation = Commitment − 2 months.'
                : 'Manual Dates: edit months independently. Changing Commitment recalculates Generation (−2 months); changing Generation does not change Commitment. Table matches stored dates.'}
            </p>
            <div className="apqr-database-filters-grid">
              <DatabaseFilterField label="APQR Cycle Year" htmlFor="apqr-db-filter-cycle-year">
                <select
                  id="apqr-db-filter-cycle-year"
                  value={cycleYearFilter === 'all' ? 'all' : String(cycleYearFilter)}
                  onChange={(e) => {
                    const value = e.target.value
                    setCycleYearFilter(value === 'all' ? 'all' : Number(value))
                  }}
                >
                  <option value="all">All cycle years</option>
                  {cycleYearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </DatabaseFilterField>
              <DatabaseFilterField label="Pullout Date" htmlFor="apqr-db-filter-pullout">
                <AppDateInput
                  id="apqr-db-filter-pullout"
                  picker="month"
                  value={pulloutDateFilter}
                  onChange={(e) => handleDateFilterChange('pullout', e.target.value)}
                />
              </DatabaseFilterField>
              <DatabaseFilterField label="APQR Generation Date" htmlFor="apqr-db-filter-generation">
                <AppDateInput
                  id="apqr-db-filter-generation"
                  picker="month"
                  value={generationDateFilter}
                  onChange={(e) => handleDateFilterChange('generation', e.target.value)}
                />
              </DatabaseFilterField>
              <DatabaseFilterField label="Commitment Date" htmlFor="apqr-db-filter-commitment">
                <AppDateInput
                  id="apqr-db-filter-commitment"
                  picker="month"
                  value={commitmentDateFilter}
                  onChange={(e) => handleDateFilterChange('commitment', e.target.value)}
                />
              </DatabaseFilterField>
              <DatabaseFilterField label="Client" htmlFor="apqr-db-filter-client">
                <select
                  id="apqr-db-filter-client"
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                >
                  <option value="all">All clients</option>
                  {clientOptions.map((client) => (
                    <option key={client.code} value={client.code}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </DatabaseFilterField>
              <DatabaseFilterField label="Delivery" htmlFor="apqr-db-filter-delivery">
                <select
                  id="apqr-db-filter-delivery"
                  value={deliveryFilter}
                  onChange={(e) => setDeliveryFilter(e.target.value as DeliveryFilter)}
                >
                  <option value="all">All delivery states</option>
                  <option value="pending">Not yet delivered</option>
                  <option value="Delivered On Time">Delivered On Time</option>
                  <option value="Delivered Overdue">Delivered Overdue</option>
                  <option value="Currently Overdue and Undelivered">Currently Overdue and Undelivered</option>
                </select>
              </DatabaseFilterField>
              <DatabaseFilterField label="Report Status" htmlFor="apqr-db-filter-report">
                <select
                  id="apqr-db-filter-report"
                  value={reportFilter}
                  onChange={(e) => setReportFilter(e.target.value as ReportFilter)}
                >
                  <option value="all">All report statuses</option>
                  <option value="none">Not started</option>
                  <option value="Draft Sent">Draft Sent</option>
                  <option value="For Client Approval">For Client Approval</option>
                  <option value="Client Approved">Client Approved</option>
                </select>
              </DatabaseFilterField>
              <DatabaseFilterField label="Priority" htmlFor="apqr-db-filter-priority">
                <select
                  id="apqr-db-filter-priority"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
                >
                  <option value="all">All priorities</option>
                  <option value="Overdue Commitment">Overdue Commitment</option>
                  <option value="Critical Commitment">Critical Commitment</option>
                  <option value="High-Priority Commitment">High-Priority Commitment</option>
                  <option value="Moderate Priority">Moderate Priority</option>
                  <option value="Low Priority">Low Priority</option>
                  <option value="Completed">Completed</option>
                </select>
              </DatabaseFilterField>
            </div>
            <div className="apqr-database-filters-footer">
              <button
                type="button"
                className="button secondary apqr-database-filters-reset"
                disabled={!hasActiveFilters}
                aria-label="Clear all record filters"
                onClick={clearAllFilters}
              >
                <ApqrIcon name="reset" width={15} height={15} />
                Clear all filter
              </button>
            </div>
          </div>
        ) : null}

        {viewMode === 'list' ? (
          <div className="table-scroll apqr-database-table-scroll">
            <table className="data-table apqr-database-table compact">
              <thead>
                <tr>
                  {visibleColumns.map((key) => (
                    <th key={key} scope="col" style={getColumnStyle(key)}>
                      <span className="apqr-th-label">{COLUMN_LABELS[key]}</span>
                      <span
                        className="apqr-col-resize-handle"
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${COLUMN_LABELS[key]} column`}
                        onMouseDown={(event) => onResizeHandleMouseDown(key, event)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.apqr_id}>
                    {visibleColumns.map((key) => (
                      <td key={key} style={getColumnStyle(key)}>
                        {renderDatabaseCell(key, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 ? (
              <DatabaseEmptyState hasRecords={rows.length > 0} hasActiveFilters={hasActiveFilters} />
            ) : null}
          </div>
        ) : (
          <div className="apqr-database-grid">
            {filtered.map((row) => {
              const formHref = `/apqr/form?apqr=${encodeURIComponent(row.apqr_id)}`
              return (
              <article key={row.apqr_id} className="apqr-database-card">
                <header>
                  <Link className="apqr-database-card-id" to={formHref}>
                    {row.apqr_id}
                  </Link>
                  <ApqrDeliveryBadge
                    classification={row.delivery_classification}
                    fallbackStatus={row.commitment_schedule_status}
                  />
                </header>
                <p className="apqr-database-card-client">{row.client_name}</p>
                <p className="apqr-database-card-product">{row.product_name}</p>
                <dl className="apqr-database-card-meta">
                  <div>
                    <dt>Department</dt>
                    <dd>
                      <span className="apqr-database-card-meta-value">
                        <span className={`apqr-database-card-dept-icon dept-${departmentTone(row.department)}`} aria-hidden>
                          <ApqrIcon name={departmentIconName(row.department)} />
                        </span>
                        {row.department ?? '—'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Commitment</dt>
                    <dd>
                      <span className="apqr-database-card-meta-value apqr-database-card-meta-value--commitment">
                        <ApqrIcon name="calendar" />
                        {formatApqrDate(row.commitment_schedule)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Report</dt>
                    <dd>
                      <ApqrReportStatusBadge status={row.apqr_report_status} />
                    </dd>
                  </div>
                  <div>
                    <dt>Delivery</dt>
                    <dd>
                      <ApqrDeliveryBadge
                        classification={row.delivery_classification}
                        fallbackStatus={row.commitment_schedule_status}
                      />
                    </dd>
                  </div>
                </dl>
                <div className="apqr-database-card-actions">
                  <Link className="button apqr-icon-btn apqr-database-card-action-primary" to={formHref} aria-label={`Open ${row.apqr_id}`}>
                    <ApqrIcon name="send" />
                  </Link>
                  {canEditForm ? (
                    <Link className="button secondary apqr-icon-btn" to={formHref} aria-label={`Edit ${row.apqr_id}`}>
                      <ApqrIcon name="edit" />
                    </Link>
                  ) : null}
                </div>
              </article>
              )
            })}
            {filtered.length === 0 ? <DatabaseEmptyState hasRecords={rows.length > 0} hasActiveFilters={hasActiveFilters} /> : null}
          </div>
        )}

      </section>
    </ApqrPage>
  )
}

function renderDatabaseCell(key: ColumnKey, row: ApqrDatabaseRow) {
  if (key === 'apqr_id') {
    return (
      <Link className="apqr-db-link-primary" to={`/apqr/form?apqr=${encodeURIComponent(row.apqr_id)}`}>
        {row.apqr_id}
      </Link>
    )
  }
  if (key === 'client') {
    return (
      <Link className="apqr-db-link-secondary" to={`/apqr/registry?code=${encodeURIComponent(row.client_code)}`}>
        {row.client_name}
      </Link>
    )
  }
  if (key === 'product') {
    return (
      <Link className="apqr-db-link-secondary" to={`/apqr/form?apqr=${encodeURIComponent(row.apqr_id)}`}>
        {row.product_name}
      </Link>
    )
  }
  if (key === 'department') return row.department ?? '—'
  if (key === 'review_coverage') return formatReviewCoverage(row.review_coverage_start, row.review_coverage_end)
  if (key === 'commitment_schedule') return formatApqrDate(row.commitment_schedule)
  if (key === 'report_status') return <ApqrReportStatusBadge status={row.apqr_report_status} />
  if (key === 'apr_ref') return row.apr_reference_number ?? '—'
  if (key === 'delivery') {
    return (
      <ApqrDeliveryBadge
        classification={row.delivery_classification}
        fallbackStatus={row.commitment_schedule_status}
      />
    )
  }
  return <ApqrPriorityBadge {...apqrPriorityDisplay(row)} />
}

function DatabaseEmptyState({
  hasRecords,
  hasActiveFilters,
}: {
  hasRecords: boolean
  hasActiveFilters: boolean
}) {
  if (!hasRecords) {
    return (
      <div className="apqr-database-empty" role="status">
        <span className="apqr-database-empty-icon" aria-hidden>
          <ApqrIcon name="database" width={28} height={28} />
        </span>
        <p className="apqr-database-empty-title">No APQR records yet</p>
        <p className="apqr-database-empty-hint">Records appear here once scheduler and form data are available.</p>
      </div>
    )
  }

  if (hasActiveFilters) {
    return (
      <div className="apqr-database-empty" role="status">
        <span className="apqr-database-empty-icon" aria-hidden>
          <ApqrIcon name="search" width={28} height={28} />
        </span>
        <p className="apqr-database-empty-title">No matching records</p>
        <p className="apqr-database-empty-hint">Try clearing search or filters to see more APQR records.</p>
      </div>
    )
  }

  return (
    <div className="apqr-database-empty" role="status">
      <span className="apqr-database-empty-icon" aria-hidden>
        <ApqrIcon name="document" width={28} height={28} />
      </span>
      <p className="apqr-database-empty-title">No records to display</p>
      <p className="apqr-database-empty-hint">Try another APQR cycle year or clear filters.</p>
    </div>
  )
}

function DatabaseFilterField({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="apqr-database-filter-field">
      <label className="apqr-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}

function departmentIconName(department: string | null | undefined): string {
  if (department === 'Liquids') return 'droplet'
  if (department === 'Dry') return 'tag'
  if (department === 'Creams and Ointments') return 'package'
  if (department === 'Topicals') return 'info'
  if (department === 'Cosmetics') return 'users'
  return 'building'
}

function departmentTone(department: string | null | undefined): string {
  if (department === 'Liquids') return 'liquids'
  if (department === 'Dry') return 'dry'
  if (department === 'Creams and Ointments') return 'creams'
  if (department === 'Topicals') return 'topicals'
  if (department === 'Cosmetics') return 'cosmetics'
  return 'default'
}

function rowMatchesSummaryFilter(row: ApqrDatabaseRow, filter: SummaryFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'overdue') {
    return (
      row.priority === 'Overdue Commitment' ||
      row.delivery_classification === 'Currently Overdue and Undelivered'
    )
  }
  if (filter === 'delivered') return Boolean(row.final_apqr_delivery_date)
  if (filter === 'clientApproved') return row.apqr_report_status === 'Client Approved'
  if (filter === 'missingInfo') return row.missing_critical_count > 0
  return true
}

function sortRowsBySummaryFilter(rows: ApqrDatabaseRow[], filter: SummaryFilter): ApqrDatabaseRow[] {
  if (filter === 'all') return rows
  const sorted = [...rows]
  if (filter === 'overdue') {
    return sorted.sort((a, b) => (a.days_remaining_or_overdue ?? 0) - (b.days_remaining_or_overdue ?? 0))
  }
  if (filter === 'delivered') {
    return sorted.sort((a, b) => (b.final_apqr_delivery_date ?? '').localeCompare(a.final_apqr_delivery_date ?? ''))
  }
  if (filter === 'clientApproved') {
    return sorted.sort((a, b) => (b.date_client_signed ?? '').localeCompare(a.date_client_signed ?? ''))
  }
  if (filter === 'missingInfo') {
    return sorted.sort((a, b) => b.missing_critical_count - a.missing_critical_count)
  }
  return sorted
}

function SummaryStat({
  label,
  value,
  tone,
  icon,
  active = false,
  onClick,
}: {
  label: string
  value: number
  tone: 'info' | 'success' | 'warning' | 'danger'
  icon: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`apqr-database-stat tone-${tone}${active ? ' is-active' : ''}`}
      aria-pressed={active}
      aria-label={`${label}: ${value}. Filter records.`}
      onClick={onClick}
    >
      <span className={`apqr-database-stat-icon tone-${tone}`} aria-hidden>
        <SummaryIcon name={icon} />
      </span>
      <strong className="apqr-database-stat-value">{value}</strong>
      <span className="apqr-database-stat-label">{label}</span>
    </button>
  )
}

function SummaryIcon({ name }: { name: string }) {
  const shared = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  if (name === 'alert') {
    return (
      <svg {...shared}>
        <path d="M12 3 2.5 20h19L12 3Z" />
        <path d="M12 9v5" />
      </svg>
    )
  }
  if (name === 'check') {
    return (
      <svg {...shared}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.6 2.6L16 9" />
      </svg>
    )
  }
  if (name === 'user') {
    return (
      <svg {...shared}>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    )
  }
  if (name === 'info') {
    return (
      <svg {...shared}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10v6" />
        <path d="M12 7h.01" />
      </svg>
    )
  }
  return (
    <svg {...shared}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  )
}

function exportDatabaseCsv(rows: ApqrDatabaseRow[]) {
  exportRows(
    rows.map((row) => ({
      apqr_id: row.apqr_id,
      client_code: row.client_code,
      client_name: row.client_name,
      product_name: row.product_name,
      product_code: row.product_code,
      department: row.department ?? '',
      review_coverage: formatReviewCoverage(row.review_coverage_start, row.review_coverage_end),
      commitment_schedule: row.commitment_schedule,
      report_status: row.apqr_report_status ?? '',
      apr_reference_number: row.apr_reference_number ?? '',
      delivery_classification: row.delivery_classification ?? '',
      priority: row.priority,
      missing_critical_count: row.missing_critical_count,
    })),
    `apqr-database-${new Date().toISOString().slice(0, 10)}.csv`,
  )
}
