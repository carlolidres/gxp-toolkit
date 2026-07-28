import type { ReactNode } from 'react'
import { Alert, Empty, Space, Spin, Tooltip, Typography } from 'antd'
import {
  Archive,
  Ban,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Clock3,
  FilePen,
  FileWarning,
  Inbox,
  Loader2,
  RotateCcw,
  Send,
  TimerOff,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import { formatAppDate } from '../../utils/dateUtils'
import type { EdocDocumentStatus, EdocPriority } from '../../features/edoc/types'
import { iconSize, iconStroke } from '../../theme/iconSizes'

const { Title, Paragraph, Text } = Typography

type EdocTone = 'default' | 'processing' | 'warning' | 'error' | 'success'

type StatusMeta = {
  label: string
  description: string
  tone: EdocTone
  Icon: LucideIcon
}

type PriorityMeta = {
  label: string
  description: string
  tone: EdocTone
  Icon: LucideIcon
}

const statusMeta: Record<EdocDocumentStatus, StatusMeta> = {
  draft: {
    label: 'Draft',
    description: 'Document is being prepared and has not started routing.',
    tone: 'default',
    Icon: FilePen,
  },
  preparing: {
    label: 'Preparing',
    description: 'Document metadata and fields are still being set up.',
    tone: 'processing',
    Icon: Loader2,
  },
  ready_for_routing: {
    label: 'Ready for Routing',
    description: 'Document is ready to send to the configured signatory route.',
    tone: 'processing',
    Icon: Send,
  },
  in_routing: {
    label: 'In Routing',
    description: 'Document is actively moving through the signatory route.',
    tone: 'warning',
    Icon: Send,
  },
  awaiting_action: {
    label: 'Awaiting Action',
    description: 'An assignee must review, approve, sign, or acknowledge.',
    tone: 'warning',
    Icon: Clock3,
  },
  returned: {
    label: 'Returned',
    description: 'Document was returned for correction or rework.',
    tone: 'error',
    Icon: RotateCcw,
  },
  rejected: {
    label: 'Rejected',
    description: 'Document was rejected during routing.',
    tone: 'error',
    Icon: XCircle,
  },
  completed: {
    label: 'Completed',
    description: 'All required route actions are finished.',
    tone: 'success',
    Icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Document routing was cancelled and is no longer active.',
    tone: 'default',
    Icon: Ban,
  },
  expired: {
    label: 'Expired',
    description: 'Document deadline passed before routing completed.',
    tone: 'error',
    Icon: TimerOff,
  },
  archived: {
    label: 'Archived',
    description: 'Document is retained for reference and no longer in active workflow.',
    tone: 'default',
    Icon: Archive,
  },
}

const priorityMeta: Record<EdocPriority, PriorityMeta> = {
  low: {
    label: 'Low',
    description: 'Low urgency; handle after higher-priority documents.',
    tone: 'default',
    Icon: CircleDashed,
  },
  normal: {
    label: 'Normal',
    description: 'Standard priority for routine routing.',
    tone: 'processing',
    Icon: Clock3,
  },
  high: {
    label: 'High',
    description: 'Elevated urgency; prioritize ahead of normal work.',
    tone: 'warning',
    Icon: TriangleAlert,
  },
  urgent: {
    label: 'Urgent',
    description: 'Immediate attention required.',
    tone: 'error',
    Icon: CircleAlert,
  },
}

export function getEdocStatusLabel(status: EdocDocumentStatus): string {
  return statusMeta[status].label
}

export function getEdocPriorityLabel(priority: EdocPriority): string {
  return priorityMeta[priority].label
}

function EdocStatusIcon({
  label,
  description,
  tone,
  Icon,
}: {
  label: string
  description: string
  tone: EdocTone
  Icon: LucideIcon
}) {
  return (
    <Tooltip
      title={
        <div className="edoc-status-tooltip">
          <strong>{label}</strong>
          <span>{description}</span>
        </div>
      }
    >
      <span
        className={`edoc-status-icon tone-${tone}`}
        aria-label={`${label}. ${description}`}
        role="img"
        tabIndex={0}
      >
        <Icon size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
        <span className="visually-hidden">{label}</span>
      </span>
    </Tooltip>
  )
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
  const meta = statusMeta[status]
  return (
    <EdocStatusIcon
      label={meta.label}
      description={meta.description}
      tone={meta.tone}
      Icon={meta.Icon}
    />
  )
}

export function EdocPriorityBadge({ priority }: { priority: EdocPriority }) {
  const meta = priorityMeta[priority]
  return (
    <EdocStatusIcon
      label={meta.label}
      description={meta.description}
      tone={meta.tone}
      Icon={meta.Icon}
    />
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
