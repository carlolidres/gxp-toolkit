import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ApqrError, ApqrIcon, ApqrLoading, ApqrPage, ApqrPriorityBadge } from '../../components/apqr/ApqrComponents'
import { useChartPalette } from '../../components/charts/chartTheme'
import {
  apqrCycleYearOptions,
  buildDashboardTrends,
  buildTriageDistribution,
  buildUpcomingActions,
  defaultApqrCycleYear,
  filterRowsByReviewCycle,
  formatApqrCycleYearLabel,
  reviewCycleFromYear,
} from '../../features/apqr/apqrDashboard'
import {
  buildDashboardMetrics,
  buildMonthlyDeliveryTrend,
  formatApqrDate,
  formatReviewCoverage,
} from '../../features/apqr/apqrService'
import type { ApqrDashboardMetrics, ApqrDatabaseRow, ApqrMetricTrend } from '../../features/apqr/types'
import { useColumnResize } from '../../hooks/useColumnResize'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { useApqrDatabase } from '../../features/apqr/useApqrData'
import { apqrPriorityDisplay } from '../../features/apqr/scheduling'
import { exportRows } from '../../utils/exportUtils'

type ColumnKey =
  | 'priority'
  | 'apqr_id'
  | 'client'
  | 'product'
  | 'review_coverage'
  | 'commitment'
  | 'days'
  | 'report_status'
  | 'missing'

const COLUMN_LABELS: Record<ColumnKey, string> = {
  priority: 'Priority',
  apqr_id: 'APQR ID',
  client: 'Client',
  product: 'Product',
  review_coverage: 'Review Coverage',
  commitment: 'Commitment Schedule',
  days: 'Days Remaining / Overdue',
  report_status: 'Report Status',
  missing: 'Missing Critical Entries',
}

const DEFAULT_COLUMNS: ColumnKey[] = Object.keys(COLUMN_LABELS) as ColumnKey[]

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export function ApqrDashboardPage() {
  const rows = useApqrDatabase()
  const { canExport } = useMenuPermission('apqr-dashboard')
  const [cycleYear, setCycleYear] = useState(defaultApqrCycleYear)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const { getColumnStyle, onResizeHandleMouseDown } = useColumnResize<ColumnKey>('apqr-triage-column-widths')

  const allRows = rows.data ?? []
  const cycleYearOptions = useMemo(() => apqrCycleYearOptions(allRows), [allRows])
  const { start: cycleStart, end: cycleEnd } = useMemo(() => reviewCycleFromYear(cycleYear), [cycleYear])
  const scopedRows = useMemo(
    () => filterRowsByReviewCycle(allRows, cycleStart, cycleEnd),
    [allRows, cycleStart, cycleEnd],
  )

  const m = useMemo(() => buildDashboardMetrics(scopedRows), [scopedRows])
  const trends = useMemo(() => buildDashboardTrends(scopedRows), [scopedRows])
  const monthly = useMemo(() => buildMonthlyDeliveryTrend(scopedRows), [scopedRows])
  const triage = useMemo(() => buildTriageDistribution(scopedRows), [scopedRows])
  const upcoming = useMemo(() => buildUpcomingActions(scopedRows), [scopedRows])

  const filteredTable = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return scopedRows
    return scopedRows.filter(
      (row) =>
        row.apqr_id.toLowerCase().includes(q) ||
        row.client_name.toLowerCase().includes(q) ||
        row.client_code.toLowerCase().includes(q) ||
        row.product_name.toLowerCase().includes(q) ||
        (row.apqr_report_status ?? '').toLowerCase().includes(q),
    )
  }, [scopedRows, search])

  const totalRows = filteredTable.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = Math.min(currentPage * pageSize, totalRows)

  const pagedTableRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredTable.slice(start, start + pageSize)
  }, [filteredTable, currentPage, pageSize])

  useEffect(() => {
    setPage(1)
  }, [search, pageSize, cycleYear])

  if (rows.loading) {
    return (
      <ApqrPage title="Dashboard" description="Commitment-schedule triage and delivery performance.">
        <ApqrLoading />
      </ApqrPage>
    )
  }

  return (
    <ApqrPage
      title="Dashboard"
      description="Commitment-schedule triage and delivery performance."
      action={
        <div className="apqr-dashboard-toolbar">
          <button
            type="button"
            className={`button secondary apqr-toolbar-filters${filtersOpen ? ' is-active' : ''}`}
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
          >
            <ApqrIcon name="filter" />
            Filters
          </button>
          <div className="apqr-cycle-year-filter" role="group" aria-label="APQR cycle year">
            <span className="apqr-dashboard-toolbar-label">APQR Cycle Year</span>
            <label className="apqr-cycle-year-field">
              <select
                value={cycleYear}
                onChange={(e) => setCycleYear(Number(e.target.value))}
                aria-label="APQR cycle year"
              >
                {cycleYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ApqrIcon name="calendar" />
            </label>
          </div>
          <Link className="button primary apqr-toolbar-database" to="/apqr/database">
            <ApqrIcon name="database" />
            Open Database
          </Link>
        </div>
      }
    >
      {rows.error ? <ApqrError message={rows.error} /> : null}

      {filtersOpen ? (
        <section className="panel apqr-filter-panel">
          <div className="apqr-filter-panel-header">
            <h2>Global Filter</h2>
            <p className="help-text apqr-filter-panel-summary">
              Showing APQRs for cycle year <strong>{cycleYear}</strong> (
              {formatApqrCycleYearLabel(cycleYear)}; {scopedRows.length} of {allRows.length} records).
            </p>
          </div>
          <div className="inline-form">
            <button type="button" className="button secondary" onClick={() => setCycleYear(defaultApqrCycleYear())}>
              Reset to current cycle year
            </button>
          </div>
        </section>
      ) : null}

      <div className="apqr-kpi-board">
        <section className="apqr-kpi-grid" aria-label="APQR summary metrics">
          <KpiCard metricKey="totalActive" label="Total Active APQRs" value={m.totalActive} trend={trends.totalActive} icon="stack" />
          <KpiCard metricKey="overdueCommitments" label="Overdue Commitments" value={m.overdueCommitments} trend={trends.overdueCommitments} icon="alert" tone="danger" />
          <KpiCard metricKey="criticalCommitments" label="Critical Commitments" value={m.criticalCommitments} trend={trends.criticalCommitments} icon="flag" tone="danger" />
          <KpiCard metricKey="highPriorityCommitments" label="High-Priority Commitments" value={m.highPriorityCommitments} trend={trends.highPriorityCommitments} icon="priority" tone="warning" />
          <KpiCard metricKey="dueThisMonth" label="Due This Month" value={m.dueThisMonth} trend={trends.dueThisMonth} icon="calendar" tone="warning" />
          <KpiCard metricKey="deliveredThisMonth" label="Delivered This Month" value={m.deliveredThisMonth} trend={trends.deliveredThisMonth} icon="check" tone="success" />
        </section>
        <section className="apqr-kpi-grid" aria-label="APQR delivery metrics">
          <KpiCard metricKey="onTimeDeliveryRate" label="On-Time Delivery Rate" value={`${m.onTimeDeliveryRate}%`} trend={trends.onTimeDeliveryRate} icon="gauge" />
          <KpiCard metricKey="overdueDeliveries" label="Overdue Deliveries" value={m.overdueDeliveries} trend={trends.overdueDeliveries} icon="clock" tone="danger" />
          <KpiCard metricKey="pendingClientApproval" label="Pending Client Approval" value={m.pendingClientApproval} trend={trends.pendingClientApproval} icon="user" />
          <KpiCard metricKey="followUpsDue" label="Follow-Ups Due" value={m.followUpsDue} trend={trends.followUpsDue} icon="mail" />
          <KpiCard metricKey="stabilityActionsDue" label="Stability Actions Due" value={m.stabilityActionsDue} trend={trends.stabilityActionsDue} icon="lab" tone="warning" />
          <KpiCard metricKey="missingCriticalInformation" label="Missing Critical Info" value={m.missingCriticalInformation} trend={trends.missingCriticalInformation} icon="info" tone="danger" />
        </section>
      </div>

      <section className="apqr-dashboard-panels">
        <article className="panel apqr-panel-compact apqr-panel-triage">
          <h2>APQR Commitment Triage Distribution</h2>
          <p className="help-text">{scopedRows.length} active records in range</p>
          <TriageDonutChart data={triage} total={scopedRows.length} />
        </article>
        <div className="apqr-delivery-charts-stack">
          <article className="panel apqr-panel-compact apqr-panel-delivery-trend">
            <h2>Monthly APQR Delivery Trend</h2>
            <p className="help-text">Last 12 months by Final APQR Delivery Date</p>
            <DeliveryTrendChart data={monthly} />
          </article>
          <article className="panel apqr-panel-compact apqr-panel-delivery-performance">
            <h2>Monthly APQR Delivery Performance</h2>
            <p className="help-text">Green = on time · Red = delivered overdue</p>
            <DeliveryPerformanceChart data={monthly} />
          </article>
        </div>
        <article className="panel apqr-panel-compact apqr-panel-actions">
          <div className="apqr-upcoming-header">
            <h2>Upcoming Actions</h2>
            <p className="help-text">Next items requiring attention</p>
          </div>
          <div className="apqr-upcoming-scroll">
            <UpcomingActionsList items={upcoming} />
          </div>
        </article>
      </section>

      <section className="panel apqr-triage-panel">
        <div className="panel-heading apqr-triage-heading">
          <h2>Triage Table</h2>
          <div className="apqr-table-toolbar">
            <label className="apqr-search-field">
              <ApqrIcon name="search" />
              <input
                type="search"
                value={search}
                placeholder="Search APQR ID, client, product…"
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="apqr-columns-menu">
              <button
                type="button"
                className={`button secondary${columnsOpen ? ' is-active' : ''}`}
                onClick={() => setColumnsOpen((open) => !open)}
              >
                Columns
              </button>
              {columnsOpen ? (
                <div className="apqr-columns-popover apqr-triage-columns-popover" role="menu">
                  <p className="apqr-columns-popover-title">Visible columns</p>
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
              <button type="button" className="button secondary" onClick={() => exportTriageCsv(filteredTable, visibleColumns)}>
                <ApqrIcon name="export" />
                Export
              </button>
            ) : null}
          </div>
        </div>
        <div className="table-scroll apqr-triage-table-scroll">
          <table className="data-table apqr-triage-table compact">
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
              {pagedTableRows.map((row) => (
                <tr key={row.apqr_id}>
                  {visibleColumns.map((key) => (
                    <td key={key} style={getColumnStyle(key)}>
                      {renderTriageCell(key, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTable.length === 0 ? <p className="messages-empty apqr-triage-empty">No records match the current filters.</p> : null}
        </div>
        {totalRows > 0 ? (
          <div className="apqr-scheduler-pagination apqr-triage-pagination">
            <span>
              Showing {pageStart} to {pageEnd} of {totalRows} records
            </span>
            <label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
            </label>
            <div className="apqr-pagination-buttons">
              <button type="button" className="button secondary" disabled={currentPage <= 1} onClick={() => setPage(1)}>
                First
              </button>
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
              <button
                type="button"
                className="button secondary"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                Last
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </ApqrPage>
  )
}

function renderTriageCell(key: ColumnKey, row: ApqrDatabaseRow) {
  if (key === 'priority') return <ApqrPriorityBadge {...apqrPriorityDisplay(row)} />
  if (key === 'apqr_id') {
    return <Link to={`/apqr/form?apqr=${encodeURIComponent(row.apqr_id)}`}>{row.apqr_id}</Link>
  }
  if (key === 'client') {
    return (
      <Link to={`/apqr/registry?code=${encodeURIComponent(row.client_code)}`}>{row.client_name}</Link>
    )
  }
  if (key === 'product') {
    return <Link to={`/apqr/form?apqr=${encodeURIComponent(row.apqr_id)}`}>{row.product_name}</Link>
  }
  if (key === 'review_coverage') return formatReviewCoverage(row.review_coverage_start, row.review_coverage_end)
  if (key === 'commitment') return formatApqrDate(row.commitment_schedule)
  if (key === 'days') return <DaysCell value={row.days_remaining_or_overdue} />
  if (key === 'report_status') return row.apqr_report_status ?? '—'
  return row.missing_critical_count || '—'
}

function DaysCell({ value }: { value: number | null }) {
  if (value == null) return <>—</>
  const overdue = value < 0
  const label = overdue ? `${value} days` : value === 0 ? 'Due today' : `${value} days`
  return <span className={`apqr-triage-days${overdue ? ' is-overdue' : ''}`}>{label}</span>
}

function KpiCard({
  label,
  value,
  trend,
  icon,
  tone = 'info',
}: {
  metricKey: keyof ApqrDashboardMetrics
  label: string
  value: number | string
  trend: ApqrMetricTrend
  icon: string
  tone?: 'info' | 'success' | 'warning' | 'danger'
}) {
  return (
    <Link className={`apqr-kpi-card tone-${tone}`} to="/apqr/database">
      <span className={`apqr-kpi-icon tone-${tone}`} aria-hidden>
        <KpiIcon name={icon} />
      </span>
      <span className="apqr-kpi-label">{label}</span>
      <strong className="apqr-kpi-value">{value}</strong>
      <small className={`apqr-kpi-trend trend-${trend.tone}`}>{trend.text}</small>
    </Link>
  )
}

function KpiIcon({ name }: { name: string }) {
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
  if (name === 'calendar') {
    return (
      <svg {...shared}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    )
  }
  if (name === 'clock') {
    return (
      <svg {...shared}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }
  if (name === 'mail') {
    return (
      <svg {...shared}>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="m3 8 9 6 9-6" />
      </svg>
    )
  }
  if (name === 'gauge') {
    return (
      <svg {...shared}>
        <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        <path d="M12 4v2M6.3 6.3l1.4 1.4M4 12h2M18 12h2M17.7 6.3l-1.4 1.4" />
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

function TriageDonutChart({ data, total }: { data: ReturnType<typeof buildTriageDistribution>; total: number }) {
  const palette = useChartPalette()
  if (!total) {
    return <p className="messages-empty">No triage data for the selected range.</p>
  }

  return (
    <div className="apqr-donut-layout">
      <div className="chart apqr-donut-chart">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={2}>
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: palette.tooltipBg, border: `1px solid ${palette.tooltipBorder}` }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="apqr-donut-center">
          <strong>{total}</strong>
          <span>Total</span>
        </div>
      </div>
      <ul className="apqr-donut-legend">
        {data.map((item) => (
          <li key={item.name}>
            <span className="apqr-legend-swatch" style={{ background: item.color }} />
            <span>{item.name}</span>
            <strong>{item.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

const DELIVERY_ON_TIME_COLOR = '#2f9e44'
const DELIVERY_OVERDUE_COLOR = '#e03131'

function deliveryChartTooltipStyle(palette: ReturnType<typeof useChartPalette>) {
  return {
    background: palette.tooltipBg,
    border: `1px solid ${palette.tooltipBorder}`,
    borderRadius: 8,
    fontSize: 12,
    color: palette.tooltipText,
  }
}

function deliveryAxisProps(palette: ReturnType<typeof useChartPalette>) {
  return {
    tick: { fill: palette.axis, fontSize: 10 },
    axisLine: { stroke: palette.grid },
    tickLine: { stroke: palette.grid },
  }
}

function deliveryMonthAxisTick({
  x = 0,
  y = 0,
  payload,
  textAnchor = 'end',
  dy = 4,
  fill,
}: {
  x?: number
  y?: number
  payload?: { value: string }
  textAnchor?: 'end' | 'middle' | 'start'
  dy?: number
  fill?: string
}) {
  return (
    <text x={x} y={y} dy={dy} textAnchor={textAnchor} fill={fill} fontSize={10}>
      {payload?.value ?? ''}
    </text>
  )
}

function renderStackedBarLabel(props: {
  x?: string | number
  y?: string | number
  width?: string | number
  height?: string | number
  value?: string | number
}) {
  const x = Number(props.x ?? 0)
  const y = Number(props.y ?? 0)
  const width = Number(props.width ?? 0)
  const height = Number(props.height ?? 0)
  const value = Number(props.value ?? 0)
  if (!value) return null
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10}
      fontWeight={600}
    >
      {value}
    </text>
  )
}

function DeliveryTrendChart({ data }: { data: ReturnType<typeof buildMonthlyDeliveryTrend> }) {
  const palette = useChartPalette()
  const totalDelivered = data.reduce((sum, point) => sum + point.delivered, 0)
  const gradientId = 'apqr-delivery-trend-fill'
  const axis = deliveryAxisProps(palette)

  return (
    <>
      <div className="chart apqr-chart-compact">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 14, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.secondary} stopOpacity={0.28} />
                <stop offset="100%" stopColor={palette.secondary} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={palette.grid} strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="label"
              {...axis}
              interval="preserveStartEnd"
              dy={4}
              tick={(props) => deliveryMonthAxisTick({ ...props, textAnchor: 'middle', dy: 16, fill: palette.axis })}
            />
            <YAxis
              allowDecimals={false}
              {...axis}
              width={30}
              label={{
                value: 'APQRs Delivered',
                angle: -90,
                position: 'insideLeft',
                offset: 8,
                style: { fill: palette.axis, fontSize: 10, textAnchor: 'middle' },
              }}
            />
            <Tooltip
              cursor={{ stroke: palette.grid, strokeDasharray: '4 4' }}
              contentStyle={deliveryChartTooltipStyle(palette)}
              formatter={(value: number) => [value, 'Delivered']}
            />
            <Area
              type="monotone"
              dataKey="delivered"
              fill={`url(#${gradientId})`}
              stroke="none"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="delivered"
              stroke={palette.secondary}
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: palette.secondary, stroke: '#ffffff', strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: palette.secondary, stroke: '#ffffff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="apqr-chart-summary">
        Total Delivered (12 months): <strong>{totalDelivered} APQR{totalDelivered === 1 ? '' : 's'}</strong>
      </p>
    </>
  )
}

function DeliveryPerformanceChart({ data }: { data: ReturnType<typeof buildMonthlyDeliveryTrend> }) {
  const palette = useChartPalette()
  const recent = data.slice(-6)
  const onTimeTotal = recent.reduce((sum, point) => sum + point.onTime, 0)
  const overdueTotal = recent.reduce((sum, point) => sum + point.overdue, 0)
  const axis = deliveryAxisProps(palette)

  return (
    <>
      <div className="chart apqr-chart-compact">
        <ResponsiveContainer>
          <BarChart data={recent} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 18 }}>
            <CartesianGrid stroke={palette.grid} strokeDasharray="4 4" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              {...axis}
              label={{
                value: 'Number of APQRs',
                position: 'insideBottom',
                offset: -10,
                style: { fill: palette.axis, fontSize: 10, textAnchor: 'middle' },
              }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={76}
              {...axis}
              tick={(props) => deliveryMonthAxisTick({ ...props, textAnchor: 'end', fill: palette.axis })}
            />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              contentStyle={deliveryChartTooltipStyle(palette)}
            />
            <Bar dataKey="onTime" name="Delivered On Time" stackId="delivery" fill={DELIVERY_ON_TIME_COLOR} radius={[0, 0, 0, 0]}>
              <LabelList dataKey="onTime" content={renderStackedBarLabel} />
            </Bar>
            <Bar dataKey="overdue" name="Delivered Overdue" stackId="delivery" fill={DELIVERY_OVERDUE_COLOR} radius={[0, 4, 4, 0]}>
              <LabelList dataKey="overdue" content={renderStackedBarLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="apqr-chart-summary-row">
        <div className="apqr-chart-summary-tile tone-on-time">
          <span className="apqr-chart-summary-swatch" style={{ background: DELIVERY_ON_TIME_COLOR }} aria-hidden />
          <span>
            Delivered On Time
            <strong>{onTimeTotal}</strong>
          </span>
        </div>
        <div className="apqr-chart-summary-tile tone-overdue">
          <span className="apqr-chart-summary-swatch" style={{ background: DELIVERY_OVERDUE_COLOR }} aria-hidden />
          <span>
            Delivered Overdue
            <strong>{overdueTotal}</strong>
          </span>
        </div>
      </div>
    </>
  )
}

function UpcomingActionsList({ items }: { items: ReturnType<typeof buildUpcomingActions> }) {
  if (!items.length) {
    return <p className="messages-empty">No upcoming actions in the selected range.</p>
  }

  return (
    <ul className="apqr-upcoming-list">
      {items.map((item) => (
        <li key={item.id}>
          <Link to={item.link} className={`apqr-upcoming-item tone-${item.tone}`}>
            <span className={`apqr-upcoming-dot tone-${item.tone}`} aria-hidden />
            <span className="apqr-upcoming-copy">
              <strong>{item.title}</strong>
              <span>{item.productName}</span>
            </span>
            <span className={`apqr-upcoming-badge tone-${item.tone}`}>{item.dueLabel}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function exportTriageCsv(rows: ApqrDatabaseRow[], columns: ColumnKey[]) {
  exportRows(
    rows.map((row) => {
      const record: Record<string, unknown> = {}
      for (const key of columns) {
        if (key === 'priority') record[COLUMN_LABELS[key]] = row.priority
        else if (key === 'apqr_id') record[COLUMN_LABELS[key]] = row.apqr_id
        else if (key === 'client') record[COLUMN_LABELS[key]] = row.client_name
        else if (key === 'product') record[COLUMN_LABELS[key]] = row.product_name
        else if (key === 'review_coverage') {
          record[COLUMN_LABELS[key]] = formatReviewCoverage(row.review_coverage_start, row.review_coverage_end)
        } else if (key === 'commitment') record[COLUMN_LABELS[key]] = row.commitment_schedule
        else if (key === 'days') record[COLUMN_LABELS[key]] = row.days_remaining_or_overdue
        else if (key === 'report_status') record[COLUMN_LABELS[key]] = row.apqr_report_status
        else record[COLUMN_LABELS[key]] = row.missing_critical_count
      }
      return record
    }),
    `apqr-triage-${new Date().toISOString().slice(0, 10)}.csv`,
  )
}
