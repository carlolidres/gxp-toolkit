import type { ReactNode } from 'react'
import { Alert, Empty, Space, Spin, Tag, Typography } from 'antd'
import { FileWarning, Inbox, Loader2 } from 'lucide-react'

import { formatAppDate } from '../../utils/dateUtils'
import type { EdocDocumentStatus, EdocPriority } from '../../features/edoc/types'
import { iconSize, iconStroke } from '../../theme/iconSizes'

const { Title, Paragraph, Text } = Typography

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

const statusColor: Record<EdocDocumentStatus, string> = {
  draft: 'default',
  preparing: 'processing',
  ready_for_routing: 'processing',
  in_routing: 'warning',
  awaiting_action: 'warning',
  returned: 'error',
  rejected: 'error',
  completed: 'success',
  cancelled: 'default',
  expired: 'error',
  archived: 'default',
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
          <Text className="eyebrow" type="secondary">
            {eyebrow}
          </Text>
          <Title level={2} style={{ margin: 0 }}>
            {title}
          </Title>
          {description ? (
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {description}
            </Paragraph>
          ) : null}
        </div>
        {action ? <Space wrap>{action}</Space> : null}
      </section>
      {children}
    </div>
  )
}

export function EdocStatusBadge({ status }: { status: EdocDocumentStatus }) {
  return (
    <Tag className={`status-badge ${statusColor[status]}`} color={statusColor[status]}>
      {statusLabels[status]}
    </Tag>
  )
}

export function EdocPriorityBadge({ priority }: { priority: EdocPriority }) {
  const color =
    priority === 'urgent' || priority === 'high'
      ? 'error'
      : priority === 'normal'
        ? 'processing'
        : 'default'
  return (
    <Tag className={`status-badge ${color}`} color={color}>
      {priorityLabels[priority]}
    </Tag>
  )
}

export function EdocLoading({ label = 'Loading eDoc data...' }: { label?: string }) {
  return (
    <div className="vrms-loading" role="status" aria-live="polite">
      <Spin
        tip={label}
        indicator={<Loader2 className="anticon-spin" size={iconSize.lg} strokeWidth={iconStroke} aria-hidden />}
      />
    </div>
  )
}

export function EdocError({ message }: { message: string }) {
  return (
    <Alert
      type="error"
      showIcon
      icon={<FileWarning size={iconSize.md} strokeWidth={iconStroke} aria-hidden />}
      message={message}
      role="alert"
    />
  )
}

export function EdocEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Empty
      className="panel edoc-empty"
      image={<Inbox size={iconSize.dashboard} strokeWidth={iconStroke} aria-hidden />}
      description={
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      }
    />
  )
}

export function formatEdocDate(value: string | null): string {
  return formatAppDate(value, 'Not set')
}
