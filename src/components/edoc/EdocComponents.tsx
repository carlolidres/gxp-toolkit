import type { ReactNode } from 'react'

import { formatAppDate } from '../../utils/dateUtils'
import type { EdocDocumentStatus, EdocPriority } from '../../features/edoc/types'

const statusLabels: Record<EdocDocumentStatus, string> = {
  draft: 'Draft',
  preparing: 'Preparing',
  ready_for_routing: 'Ready for Routing',
  in_routing: 'In Routing',
  awaiting_action: 'Awaiting Action',
  returned: 'Returned',
  rejected: 'Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
  archived: 'Archived',
}

const statusTone: Record<EdocDocumentStatus, string> = {
  draft: 'neutral',
  preparing: 'info',
  ready_for_routing: 'info',
  in_routing: 'warning',
  awaiting_action: 'warning',
  returned: 'danger',
  rejected: 'danger',
  completed: 'success',
  cancelled: 'neutral',
  expired: 'danger',
  archived: 'neutral',
}

const priorityLabels: Record<EdocPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

export function EdocPage({
  eyebrow = 'eDoc',
  title,
  description,
  action,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="page edoc-page">
      <section className="page-header">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </section>
      {children}
    </div>
  )
}

export function EdocStatusBadge({ status }: { status: EdocDocumentStatus }) {
  return <span className={`status-badge ${statusTone[status]}`}>{statusLabels[status]}</span>
}

export function EdocPriorityBadge({ priority }: { priority: EdocPriority }) {
  const tone = priority === 'urgent' || priority === 'high' ? 'danger' : priority === 'normal' ? 'info' : 'neutral'
  return <span className={`status-badge ${tone}`}>{priorityLabels[priority]}</span>
}

export function EdocLoading({ label = 'Loading eDoc data...' }: { label?: string }) {
  return <div className="vrms-loading">{label}</div>
}

export function EdocError({ message }: { message: string }) {
  return <p className="form-error" role="alert">{message}</p>
}

export function EdocEmpty({ title, description }: { title: string; description: string }) {
  return (
    <section className="panel edoc-empty">
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  )
}

export function formatEdocDate(value: string | null): string {
  return formatAppDate(value, 'Not set')
}

