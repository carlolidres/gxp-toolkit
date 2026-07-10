import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  MoreVertical,
  RefreshCw,
  ScanLine,
  Send,
  Share2,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import { VrmsPage } from '../../components/vrms/VrmsPage'
import { useAuth } from '../../hooks/useAuth'
import { useVrmsApp } from '../../context/VrmsAppContext'
import { VRMS_DASHBOARD_CARD_TONES } from '../../lib/vrmsStatus'
import { VRMS_RECENT_COLUMNS } from '../../lib/vrmsFormConfig'
import type { RoutingDocument } from '../../types/vrms'
import { VrmsDataTable } from '../../components/vrms/VrmsDataTable'
import { formatDashboardGreeting } from '../../lib/greeting'
import { getVrmsStatusStyle } from '../../lib/vrmsStatus'
import { iconSize, iconStroke } from '../../theme/iconSizes'

const dashboardCards = [
  { key: 'total', label: 'Total', tone: 0, icon: 'document', to: '/database' },
  { key: 'routing', label: 'Routing', tone: 1, icon: 'send', to: '/database?status=Routing' },
  { key: 'forScanning', label: 'For scanning', tone: 2, icon: 'scan', to: '/database?status=For%20Scanning' },
  { key: 'sent', label: 'Sent', tone: 3, icon: 'check', to: '/database?status=Sent' },
  { key: 'inEdms', label: 'In EDMS', tone: 4, icon: 'archive', to: '/database?status=In%20EDMS' },
  { key: 'cancelled', label: 'Cancelled', tone: 5, icon: 'x', to: '/database?status=Cancelled' },
  { key: 'overdue', label: 'Overdue', tone: 6, icon: 'alert', to: '/database?overdue=1' },
  { key: 'avgAging', label: 'Avg. aging', tone: 7, icon: 'clock', suffix: 'd', to: '/database' },
] as const

const recentColumns = VRMS_RECENT_COLUMNS.map((key) => ({
  key,
  label:
    key === 'routingTracker'
      ? 'Routing Tracker #'
      : key === 'docTracer'
        ? 'Doc Tracer #'
        : key === 'equipmentProduct'
          ? 'Equipment/Product'
          : key === 'sentRoutingTo'
            ? 'Sent/Routing To'
            : key === 'dateSent'
              ? 'Date Sent'
              : 'Status',
})) as Array<{ key: keyof RoutingDocument; label: string }>

const dashboardPreviewColumns = recentColumns.slice(0, 3)

const kpiAvatarTones = ['blue', 'green', 'purple', 'orange', 'blue', 'teal', 'purple', 'red'] as const

function greetingName(name?: string): string {
  if (!name) return 'there'
  return name.split(' ')[0]
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const cardIcons: Record<string, LucideIcon> = {
  document: FileText,
  send: Send,
  scan: ScanLine,
  check: CheckCircle2,
  archive: Archive,
  x: XCircle,
  alert: AlertTriangle,
  clock: Clock3,
  share: Share2,
  refresh: RefreshCw,
  more: MoreVertical,
  chevron: ChevronRight,
}

function CardIcon({ name }: { name: string }) {
  const Icon = cardIcons[name] ?? FileText
  return <Icon size={iconSize.xl} strokeWidth={iconStroke} aria-hidden />
}

function statusDatabasePath(status: string): string {
  return `/database?status=${encodeURIComponent(status)}`
}

function StatusDonut({
  statusCounts,
  onStatusClick,
}: {
  statusCounts: Record<string, number>
  onStatusClick: (status: string) => void
}) {
  const entries = Object.entries(statusCounts).filter(([, count]) => count > 0)
  const total = entries.reduce((sum, [, count]) => sum + count, 0)
  const radius = 72
  const circumference = 2 * Math.PI * radius
  const gap = entries.length > 1 ? 5 : 0
  let offset = 0

  if (!total) {
    return <div className="vrms-donut-empty">No status data</div>
  }

  return (
    <div className="vrms-donut-layout">
      <div className="vrms-donut-chart">
        <svg className="vrms-donut" viewBox="0 0 180 180" role="img" aria-label="Documents by status">
          <circle className="vrms-donut-track" cx="90" cy="90" r={radius} />
          {entries.map(([status, count]) => {
            const style = getVrmsStatusStyle(status)
            const length = Math.max(0, (count / total) * circumference - gap)
            const dashOffset = -offset
            offset += length + gap
            return (
              <circle
                key={status}
                className="vrms-donut-segment"
                cx="90"
                cy="90"
                r={radius}
                stroke={style.color}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={dashOffset}
                onClick={() => onStatusClick(status)}
              >
                <title>{`${status}: ${count}`}</title>
              </circle>
            )
          })}
        </svg>
        <div className="vrms-donut-center">
          <strong>{total}</strong>
          <span>records</span>
        </div>
      </div>
      <div className="vrms-donut-legend">
        {entries.map(([status, count]) => {
          const style = getVrmsStatusStyle(status)
          return (
            <button type="button" key={status} onClick={() => onStatusClick(status)}>
              <span style={{ background: style.color }} />
              <span>{status}</span>
              <strong>{count}</strong>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DashboardDocumentCard({
  title,
  icon,
  rows,
  total,
  actionLabel,
  actionPath,
  onTrackerClick,
  onRefresh,
}: {
  title: string
  icon: 'clock' | 'share'
  rows: RoutingDocument[]
  total: number
  actionLabel: string
  actionPath: string
  onTrackerClick: (tracker: string) => void
  onRefresh: () => void
}) {
  const navigate = useNavigate()
  const previewRows = rows.slice(0, 10)
  const visibleCount = previewRows.length

  return (
    <section className="vrms-panel vrms-dashboard-doc-card">
      <div className="vrms-dashboard-doc-header">
        <div className="vrms-dashboard-doc-title">
          <span className="vrms-dashboard-doc-icon">
            <CardIcon name={icon} />
          </span>
          <h2>{title}</h2>
        </div>
        <div className="vrms-dashboard-doc-actions" aria-label={`${title} actions`}>
          <button type="button" aria-label={`Refresh ${title}`} onClick={onRefresh}>
            <CardIcon name="refresh" />
          </button>
        </div>
      </div>
      <div className="vrms-dashboard-doc-table">
        <VrmsDataTable
          rows={previewRows}
          columns={dashboardPreviewColumns}
          onTrackerClick={onTrackerClick}
        />
      </div>
      <div className="vrms-dashboard-doc-footer">
        <span className="vrms-dashboard-doc-count">
          <CardIcon name="document" />
          {visibleCount} of {total} documents
        </span>
        <button type="button" onClick={() => navigate(actionPath)}>
          {actionLabel}
          <CardIcon name="chevron" />
        </button>
      </div>
    </section>
  )
}

export function VrmsDashboardPage() {
  const { appData, loading, refresh } = useVrmsApp()
  const { user } = useAuth()
  const navigate = useNavigate()
  const distributionRef = useRef<HTMLElement>(null)
  const [kpiPanelHeight, setKpiPanelHeight] = useState<number | undefined>()
  const dashboard = appData?.dashboard

  useLayoutEffect(() => {
    const distributionPanel = distributionRef.current
    if (!distributionPanel || !dashboard) {
      setKpiPanelHeight(undefined)
      return
    }

    const desktopQuery = window.matchMedia('(min-width: 1100px)')

    const syncKpiHeight = () => {
      if (!desktopQuery.matches) {
        setKpiPanelHeight(undefined)
        return
      }
      setKpiPanelHeight(Math.round(distributionPanel.getBoundingClientRect().height))
    }

    syncKpiHeight()
    const observer = new ResizeObserver(syncKpiHeight)
    observer.observe(distributionPanel)
    desktopQuery.addEventListener('change', syncKpiHeight)

    return () => {
      observer.disconnect()
      desktopQuery.removeEventListener('change', syncKpiHeight)
    }
  }, [dashboard])

  if (loading && !appData) {
    return (
      <div className="page">
        <div className="vrms-loading">Loading dashboard data…</div>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="page">
        <div className="vrms-loading">No dashboard data available.</div>
      </div>
    )
  }

  const greeting = formatDashboardGreeting(greetingName(user?.name))

  return (
    <VrmsPage
      eyebrow="Validation routing workspace"
      title={greeting}
      description="Monitor routing status, signatories, and document throughput from one adaptable shell."
    >
      <div className="vrms-cards">
        {dashboardCards.map((card) => {
          const raw = dashboard[card.key as keyof typeof dashboard]
          const value = typeof raw === 'number' ? raw : 0
          const tone = VRMS_DASHBOARD_CARD_TONES[card.tone]
          return (
            <button className="vrms-card" key={card.key} type="button" onClick={() => navigate(card.to)}>
              <div>
                <span>{card.label}</span>
                <strong>
                  {value}
                  {'suffix' in card ? card.suffix : ''}
                </strong>
              </div>
              <div className={`vrms-card-icon ${tone}`}>
                <CardIcon name={card.icon} />
              </div>
            </button>
          )
        })}
      </div>

      <div className="dashboard-grid vrms-dashboard-panels">
        <section ref={distributionRef} className="panel vrms-dashboard-panel vrms-dashboard-distribution">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Distribution</span>
              <h2>Documents by status</h2>
            </div>
          </div>
          <StatusDonut
            statusCounts={dashboard.statusCounts}
            onStatusClick={(status) => navigate(statusDatabasePath(status))}
          />
        </section>

        <section
          className="panel vrms-dashboard-panel vrms-dashboard-kpi"
          style={kpiPanelHeight ? { height: kpiPanelHeight } : undefined}
        >
          <div className="panel-heading">
            <h2>Individual KPI</h2>
          </div>
          <div className="vrms-table-wrap">
            <table className="vrms-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Signed</th>
                  <th>Avg duration</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.kpi.map((row, index) => (
                  <tr key={row.name} className="vrms-clickable-row" onClick={() => navigate(`/database?search=${encodeURIComponent(row.name)}`)}>
                    <td>
                      <span className="vrms-kpi-name">
                        <span className={`vrms-kpi-avatar tone-${kpiAvatarTones[index % kpiAvatarTones.length]}`}>
                          {initials(row.name)}
                        </span>
                        {row.name}
                      </span>
                    </td>
                    <td>{row.signed}</td>
                    <td>{row.avgDuration}</td>
                    <td>{row.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="vrms-grid2">
        <DashboardDocumentCard
          title="Recently updated documents"
          icon="clock"
          rows={dashboard.recent}
          total={dashboard.recentTotal}
          actionLabel="View all updated"
          actionPath="/database"
          onTrackerClick={(tracker) => navigate(`/routing?tracker=${encodeURIComponent(tracker)}`)}
          onRefresh={() => void refresh()}
        />
        <DashboardDocumentCard
          title="Active routing documents"
          icon="share"
          rows={dashboard.active}
          total={dashboard.activeTotal}
          actionLabel="View all routing"
          actionPath="/database?status=Routing"
          onTrackerClick={(tracker) => navigate(`/routing?tracker=${encodeURIComponent(tracker)}`)}
          onRefresh={() => void refresh()}
        />
      </div>
    </VrmsPage>
  )
}
