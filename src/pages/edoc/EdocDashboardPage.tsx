import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FilePlus,
  FileText,
  FolderOpen,
  Inbox,
  RotateCcw,
} from 'lucide-react'

import { EdocError, EdocLoading, EdocPage, formatEdocDate } from '../../components/edoc/EdocComponents'
import { EdocProfileCompletionGate } from '../../components/edoc/EdocProfileCompletionGate'
import {
  buildNeedsMyActionQueue,
  EDOC_ACTION_FILTER_LABELS,
  filterInboxTasksByAction,
  inboxTaskDueLabel,
  inboxTaskDueTone,
  type EdocActionFilter,
} from '../../features/edoc/edocDashboard'
import { useEdocDashboard, useEdocInbox } from '../../features/edoc/useEdocData'
import { usePermissions } from '../../hooks/usePermissions'
import { iconSize, iconStroke } from '../../theme/iconSizes'
import type { EdocAssignableAction, EdocDashboardMetrics, EdocInboxTask } from '../../features/edoc/types'

const ACTION_CHIPS: EdocAssignableAction[] = ['review', 'approve', 'sign', 'acknowledge']

export function EdocDashboardPage() {
  const dashboard = useEdocDashboard()
  const inbox = useEdocInbox()
  const { canViewMenu } = usePermissions()
  const [actionFilter, setActionFilter] = useState<EdocActionFilter>('all')

  const metrics = dashboard.data
  const inboxTasks = inbox.data ?? []
  const queue = useMemo(
    () => buildNeedsMyActionQueue(inboxTasks, actionFilter, 10),
    [inboxTasks, actionFilter],
  )
  const filteredActiveCount = useMemo(
    () =>
      filterInboxTasksByAction(
        inboxTasks.filter((task) => task.status === 'active'),
        actionFilter,
      ).length,
    [inboxTasks, actionFilter],
  )

  if (dashboard.loading) {
    return (
      <EdocPage title="Dashboard" description="Your tasks, due dates, and drafts.">
        <EdocLoading />
      </EdocPage>
    )
  }

  return (
    <EdocProfileCompletionGate mode="banner">
    <EdocPage
      title="Dashboard"
      description="Your tasks, due dates, and drafts."
      action={
        <div className="edoc-dashboard-toolbar">
          {canViewMenu('edoc-create') ? (
            <Link to="/edoc/create" className="button primary">
              <FilePlus size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
              Create Document
            </Link>
          ) : null}
          {canViewMenu('edoc-inbox') ? (
            <Link to="/edoc/inbox" className="button secondary">
              <Inbox size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
              My Inbox
            </Link>
          ) : null}
          {canViewMenu('edoc-my-documents') ? (
            <Link to="/edoc/my-documents" className="button secondary">
              <FileText size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
              My Documents
            </Link>
          ) : null}
        </div>
      }
    >
      {dashboard.error ? <EdocError message={dashboard.error} /> : null}

      {metrics ? (
        <>
          <section className="edoc-kpi-board" aria-label="Action metrics">
            <div className="edoc-kpi-grid">
              <KpiCard
                label="My action"
                value={metrics.awaitingMyAction}
                tone="info"
                icon={<Inbox size={18} strokeWidth={iconStroke} aria-hidden />}
                active={actionFilter === 'all'}
                onClick={() => setActionFilter('all')}
              />
              <KpiLinkCard
                label="Overdue"
                value={metrics.overdue}
                tone="danger"
                icon={<AlertTriangle size={18} strokeWidth={iconStroke} aria-hidden />}
                to="/edoc/my-documents?due=overdue"
              />
              <KpiLinkCard
                label="Due soon"
                value={metrics.dueSoon}
                tone="warning"
                icon={<Clock3 size={18} strokeWidth={iconStroke} aria-hidden />}
                to="/edoc/my-documents?due=soon"
              />
              <KpiLinkCard
                label="Returned"
                value={metrics.returned}
                tone="warning"
                icon={<RotateCcw size={18} strokeWidth={iconStroke} aria-hidden />}
                to="/edoc/my-documents?status=returned"
              />
              <KpiLinkCard
                label="Drafts"
                value={metrics.drafts}
                tone="info"
                icon={<FileText size={18} strokeWidth={iconStroke} aria-hidden />}
                to="/edoc/my-documents?status=drafts"
              />
            </div>

            <div className="edoc-action-chips" role="group" aria-label="Filter by action type">
              {ACTION_CHIPS.map((action) => {
                const count = actionCount(metrics, action)
                const active = actionFilter === action
                return (
                  <button
                    key={action}
                    type="button"
                    className={`edoc-action-chip${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => setActionFilter((current) => (current === action ? 'all' : action))}
                  >
                    <span>{EDOC_ACTION_FILTER_LABELS[action]}</span>
                    <strong>{count}</strong>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="panel edoc-action-queue-panel" aria-labelledby="edoc-needs-action-title">
            <div className="panel-heading edoc-action-queue-heading">
              <div className="edoc-action-queue-title-block">
                <h2 id="edoc-needs-action-title">Needs my action</h2>
                {actionFilter !== 'all' ? (
                  <button
                    type="button"
                    className="edoc-filter-chip"
                    onClick={() => setActionFilter('all')}
                    aria-label={`Clear filter ${EDOC_ACTION_FILTER_LABELS[actionFilter]}`}
                  >
                    {EDOC_ACTION_FILTER_LABELS[actionFilter]}
                    <span aria-hidden>×</span>
                  </button>
                ) : null}
              </div>
              {canViewMenu('edoc-inbox') ? (
                <Link to="/edoc/inbox" className="button secondary">
                  <Inbox size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
                  Open inbox
                </Link>
              ) : null}
            </div>

            {inbox.error ? <EdocError message={inbox.error} /> : null}
            {inbox.loading ? <EdocLoading /> : null}

            {!inbox.loading ? (
              <NeedsMyActionList
                items={queue}
                totalActive={filteredActiveCount}
                canCreate={canViewMenu('edoc-create')}
                canViewDocs={canViewMenu('edoc-my-documents')}
              />
            ) : null}
          </section>

          <PipelineStrip metrics={metrics} canViewDocs={canViewMenu('edoc-my-documents')} />
        </>
      ) : null}
    </EdocPage>
    </EdocProfileCompletionGate>
  )
}

function actionCount(metrics: EdocDashboardMetrics, action: EdocAssignableAction): number {
  if (action === 'review') return metrics.pendingReview
  if (action === 'approve') return metrics.pendingApproval
  if (action === 'sign') return metrics.pendingSignature
  return metrics.pendingAcknowledgment
}

function KpiCard({
  label,
  value,
  tone,
  icon,
  active,
  onClick,
}: {
  label: string
  value: number
  tone: 'info' | 'warning' | 'danger'
  icon: ReactNode
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`edoc-kpi-card tone-${tone}${active ? ' is-active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className={`edoc-kpi-icon tone-${tone}`} aria-hidden>
        {icon}
      </span>
      <span className="edoc-kpi-label">{label}</span>
      <strong className="edoc-kpi-value">{value}</strong>
    </button>
  )
}

function KpiLinkCard({
  label,
  value,
  tone,
  icon,
  to,
}: {
  label: string
  value: number
  tone: 'info' | 'warning' | 'danger'
  icon: ReactNode
  to: string
}) {
  return (
    <Link className={`edoc-kpi-card tone-${tone}`} to={to}>
      <span className={`edoc-kpi-icon tone-${tone}`} aria-hidden>
        {icon}
      </span>
      <span className="edoc-kpi-label">{label}</span>
      <strong className="edoc-kpi-value">{value}</strong>
    </Link>
  )
}

function NeedsMyActionList({
  items,
  totalActive,
  canCreate,
  canViewDocs,
}: {
  items: EdocInboxTask[]
  totalActive: number
  canCreate: boolean
  canViewDocs: boolean
}) {
  if (!items.length) {
    return (
      <div className="edoc-action-queue-empty">
        <p className="messages-empty">No active assignments in this filter.</p>
        <div className="edoc-action-queue-empty-actions">
          {canCreate ? (
            <Link to="/edoc/create" className="button primary">
              Create Document
            </Link>
          ) : null}
          {canViewDocs ? (
            <Link to="/edoc/my-documents" className="button secondary">
              My Documents
            </Link>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <>
      <ul className="edoc-action-queue-list">
        {items.map((task) => {
          const tone = inboxTaskDueTone(task)
          return (
            <li key={task.id}>
              <Link to={`/edoc/workspace/${task.id}`} className={`edoc-action-queue-item tone-${tone}`}>
                <span className="edoc-action-queue-copy">
                  <strong>{task.documentTitle}</strong>
                  <span>
                    {task.documentNumber} · {EDOC_ACTION_FILTER_LABELS[task.action]}
                    {task.dueAt ? ` · ${formatEdocDate(task.dueAt)}` : ''}
                  </span>
                </span>
                <span className={`edoc-action-queue-badge tone-${tone}`}>{inboxTaskDueLabel(task)}</span>
                <span className="edoc-action-queue-open">
                  <FolderOpen size={14} strokeWidth={iconStroke} aria-hidden />
                  Open
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {totalActive > items.length ? (
        <p className="edoc-action-queue-more help-text">
          Showing {items.length} of {totalActive}. <Link to="/edoc/inbox">View all in inbox</Link>
        </p>
      ) : null}
    </>
  )
}

function PipelineStrip({
  metrics,
  canViewDocs,
}: {
  metrics: EdocDashboardMetrics
  canViewDocs: boolean
}) {
  const items = [
    { label: 'In routing', value: metrics.inRouting, to: '/edoc/my-documents?status=in_routing', icon: Clock3 },
    { label: 'Rejected', value: metrics.rejected, to: '/edoc/my-documents?status=rejected', icon: AlertTriangle },
    { label: 'Completed', value: metrics.completed, to: '/edoc/my-documents?status=completed', icon: CheckCircle2 },
  ]

  return (
    <section className="edoc-pipeline-strip" aria-label="Pipeline summary">
      {items.map((item) => {
        const Icon = item.icon
        const content = (
          <>
            <Icon size={14} strokeWidth={iconStroke} aria-hidden />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </>
        )
        if (!canViewDocs) {
          return (
            <span key={item.label} className="edoc-pipeline-chip">
              {content}
            </span>
          )
        }
        return (
          <Link key={item.label} className="edoc-pipeline-chip" to={item.to}>
            {content}
          </Link>
        )
      })}
    </section>
  )
}
