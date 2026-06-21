import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CSSProperties, SVGProps } from 'react'

import { VrmsPage } from '../../components/vrms/VrmsPage'
import { useAuth } from '../../hooks/useAuth'
import { useVrmsApp } from '../../context/VrmsAppContext'
import { VRMS_DASHBOARD_CARD_TONES } from '../../lib/vrmsStatus'
import { VRMS_RECENT_COLUMNS } from '../../lib/vrmsFormConfig'
import type { RoutingDocument } from '../../types/vrms'
import { VrmsDataTable } from '../../components/vrms/VrmsDataTable'
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

function greetingName(name?: string): string {
  if (!name) return 'there'
  return name.split(' ')[0]
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
  return <svg {...shared}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M9 13h6" /><path d="M9 17h4" /></svg>
}

function statusDatabasePath(status: string): string {
  return `/database?status=${encodeURIComponent(status)}`
}

function BrokenStatusDonut({
  statusCounts,
  onStatusClick,
  onLayoutHeightChange,
}: {
  statusCounts: Record<string, number>
  onStatusClick: (status: string) => void
  onLayoutHeightChange?: (height: number) => void
}) {
  const layoutRef = useRef<HTMLDivElement | null>(null)
  const entries = Object.entries(statusCounts).filter(([, count]) => count > 0)
  const total = entries.reduce((sum, [, count]) => sum + count, 0)
  const radius = 72
  const circumference = 2 * Math.PI * radius
  const gap = entries.length > 1 ? 5 : 0
  let offset = 0

  useEffect(() => {
    const node = layoutRef.current
    if (!node || !onLayoutHeightChange) return
    const handleHeightChange: (height: number) => void = onLayoutHeightChange

    function updateHeight() {
      if (node) handleHeightChange(Math.ceil(node.getBoundingClientRect().height))
    }

    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(node)
    return () => observer.disconnect()
  }, [onLayoutHeightChange, entries.length, total])

  if (!total) {
    return <div className="vrms-donut-empty">No status data</div>
  }

  return (
    <div className="vrms-donut-layout" ref={layoutRef}>
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

export function VrmsDashboardPage() {
  const { appData, loading } = useVrmsApp()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [donutLayoutHeight, setDonutLayoutHeight] = useState(0)

  if (loading && !appData) {
    return (
      <div className="page">
        <div className="vrms-loading">Loading dashboard data…</div>
      </div>
    )
  }

  const dashboard = appData?.dashboard
  if (!dashboard) {
    return (
      <div className="page">
        <div className="vrms-loading">No dashboard data available.</div>
      </div>
    )
  }

  return (
    <VrmsPage
      eyebrow="Validation routing workspace"
      title={`Good morning, ${greetingName(user?.name)}`}
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

      <div
        className="dashboard-grid vrms-dashboard-panels"
        style={donutLayoutHeight ? ({ '--vrms-donut-layout-height': `${donutLayoutHeight}px` } as CSSProperties) : undefined}
      >
        <section className="panel vrms-dashboard-panel vrms-dashboard-distribution">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Distribution</span>
              <h2>Documents by status</h2>
            </div>
          </div>
          <BrokenStatusDonut
            statusCounts={dashboard.statusCounts}
            onStatusClick={(status) => navigate(statusDatabasePath(status))}
            onLayoutHeightChange={setDonutLayoutHeight}
          />
        </section>

        <section className="panel vrms-dashboard-panel vrms-dashboard-kpi">
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
                {dashboard.kpi.map((row) => (
                  <tr key={row.name} className="vrms-clickable-row" onClick={() => navigate(`/database?search=${encodeURIComponent(row.name)}`)}>
                    <td>{row.name}</td>
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
        <section className="vrms-panel">
          <h2>Recently updated documents</h2>
          <VrmsDataTable
            rows={dashboard.recent}
            columns={recentColumns}
            onTrackerClick={(tracker) => navigate(`/routing?tracker=${encodeURIComponent(tracker)}`)}
          />
        </section>
        <section className="vrms-panel">
          <h2>Active routing documents</h2>
          <VrmsDataTable
            rows={dashboard.active}
            columns={recentColumns}
            onTrackerClick={(tracker) => navigate(`/routing?tracker=${encodeURIComponent(tracker)}`)}
          />
        </section>
      </div>
    </VrmsPage>
  )
}
