import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SVGProps } from 'react'

import { VrmsPage } from '../../components/vrms/VrmsPage'
import { useAuth } from '../../hooks/useAuth'
import { useVrmsApp } from '../../context/VrmsAppContext'
import { VRMS_DASHBOARD_CARD_TONES } from '../../lib/vrmsStatus'
import { VRMS_RECENT_COLUMNS } from '../../lib/vrmsFormConfig'
import type { RoutingDocument } from '../../types/vrms'
import { VrmsDataTable } from '../../components/vrms/VrmsDataTable'
import { formatDashboardGreeting } from '../../lib/greeting'
import { getVrmsStatusStyle } from '../../lib/vrmsStatus'

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

function CardIcon({ name, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  const shared = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  }

  if (name === 'send') {
    return <svg {...shared}><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></svg>
  }
  if (name === 'scan') {
    return <svg {...shared}><path d="M7 3H5a2 2 0 0 0-2 2v2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M8 12h8" /></svg>
  }
  if (name === 'check') {
    return <svg {...shared}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.6 2.6L16 9" /></svg>
  }
  if (name === 'archive') {
    return <svg {...shared}><path d="M4 7h16" /><path d="M5 7l1 13h12l1-13" /><path d="M8 3h8l1 4H7l1-4Z" /><path d="M10 12h4" /></svg>
  }
  if (name === 'x') {
    return <svg {...shared}><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6" /><path d="m15 9-6 6" /></svg>
  }
  if (name === 'alert') {
    return <svg {...shared}><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v5" /><path d="M12 17h.01" /></svg>
  }
  if (name === 'clock') {
    return <svg {...shared}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  }
  if (name === 'share') {
    return <svg {...shared}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.6 6.8-4.2" /><path d="m8.6 13.4 6.8 4.2" /></svg>
  }
  if (name === 'refresh') {
    return <svg {...shared}><path d="M20 11a8 8 0 0 0-14.9-4" /><path d="M5 3v4h4" /><path d="M4 13a8 8 0 0 0 14.9 4" /><path d="M19 21v-4h-4" /></svg>
  }
  if (name === 'more') {
    return <svg {...shared}><circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" /></svg>
  }
  if (name === 'chevron') {
    return <svg {...shared}><path d="m9 18 6-6-6-6" /></svg>
  }
  return <svg {...shared}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M9 13h6" /><path d="M9 17h4" /></svg>
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
}: {
  title: string
  icon: 'clock' | 'share'
  rows: RoutingDocument[]
  total: number
  actionLabel: string
  actionPath: string
  onTrackerClick: (tracker: string) => void
}) {
  const navigate = useNavigate()
  const visibleCount = Math.min(10, total)

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
          <button type="button" aria-label={`Refresh ${title}`}>
            <CardIcon name="refresh" />
          </button>
          <button type="button" aria-label={`${title} options`}>
            <CardIcon name="more" />
          </button>
        </div>
      </div>
      <div className="vrms-dashboard-doc-table">
        <VrmsDataTable
          rows={rows}
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
  const { appData, loading } = useVrmsApp()
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
        />
        <DashboardDocumentCard
          title="Active routing documents"
          icon="share"
          rows={dashboard.active}
          total={dashboard.activeTotal}
          actionLabel="View all routing"
          actionPath="/database?status=Routing"
          onTrackerClick={(tracker) => navigate(`/routing?tracker=${encodeURIComponent(tracker)}`)}
        />
      </div>
    </VrmsPage>
  )
}
