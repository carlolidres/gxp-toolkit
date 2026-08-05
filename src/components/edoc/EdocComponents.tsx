import type { ReactNode } from 'react'
import { Alert, Empty, Spin, Tooltip, Typography } from 'antd'
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
  PenLine,
  RotateCcw,
  Send,
  ShieldCheck,
  TimerOff,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import { formatAppDate } from '../../utils/dateUtils'
import type {
  EdocAssignableAction,
  EdocDocumentStatus,
  EdocPriority,
} from '../../features/edoc/types'
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
    description: 'Document is retained for reference and is no longer in active workflow.',
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

const actionMeta: Record<
  EdocAssignableAction,
  { label: string; description: string; tone: EdocTone; Icon: LucideIcon }
> = {
  review: {
    label: 'Review',
    description: 'Review and electronically sign this document.',
    tone: 'processing',
    Icon: FilePen,
  },
  approve: {
    label: 'Approve',
    description: 'Approve this document to continue routing.',
    tone: 'success',
    Icon: ShieldCheck,
  },
  sign: {
    label: 'Sign',
    description: 'Apply your electronic signature.',
    tone: 'warning',
    Icon: PenLine,
  },
  acknowledge: {
    label: 'Acknowledge',
    description: 'Acknowledge receipt and understanding.',
    tone: 'default',
    Icon: CheckCircle2,
  },
}

export function getEdocStatusLabel(status: EdocDocumentStatus): string {
  return statusMeta[status].label
}

export function getEdocPriorityLabel(priority: EdocPriority): string {
  return priorityMeta[priority].label
}

export function getEdocActionLabel(action: EdocAssignableAction): string {
  return actionMeta[action].label
}

function EdocMetaPill({
  label,
  description,
  tone,
  Icon,
  showLabel = true,
}: {
  label: string
  description: string
  tone: EdocTone
  Icon: LucideIcon
  showLabel?: boolean
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
        className={`edoc-meta-pill tone-${tone}${showLabel ? '' : ' edoc-meta-pill--icon'}`}
        aria-label={`${label}. ${description}`}
        role="img"
        tabIndex={0}
      >
        <Icon size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
        {showLabel ? (
          <span className="edoc-meta-pill-label">{label}</span>
        ) : (
          <span className="visually-hidden">{label}</span>
        )}
      </span>
    </Tooltip>
  )
}

export function EdocPage({
  eyebrow = 'eDoc',
  title,
  description,
  action,
  icon: Icon,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  icon?: LucideIcon
  children: ReactNode
}) {
  return (
    <div className="page edoc-page">
      <section className="page-header edoc-page-header">
        <div className="edoc-page-header-copy">
          <Text className="eyebrow edoc-page-eyebrow" type="secondary">
            {eyebrow}
          </Text>
          <div className="edoc-page-title-row">
            {Icon ? (
              <span className="edoc-page-header-icon" aria-hidden>
                <Icon size={iconSize.md} strokeWidth={iconStroke} />
              </span>
            ) : null}
            <Title level={2} className="edoc-page-title">
              {title}
            </Title>
          </div>
          {description ? (
            <Paragraph type="secondary" className="edoc-page-description">
              {description}
            </Paragraph>
          ) : null}
        </div>
        {action ? <div className="edoc-page-header-actions">{action}</div> : null}
      </section>
      {children}
    </div>
  )
}

export function EdocStatusBadge({
  status,
  showLabel = true,
}: {
  status: EdocDocumentStatus
  showLabel?: boolean
}) {
  const meta = statusMeta[status]
  return (
    <EdocMetaPill
      label={meta.label}
      description={meta.description}
      tone={meta.tone}
      Icon={meta.Icon}
      showLabel={showLabel}
    />
  )
}

export function EdocPriorityBadge({
  priority,
  showLabel = true,
}: {
  priority: EdocPriority
  showLabel?: boolean
}) {
  const meta = priorityMeta[priority]
  return (
    <EdocMetaPill
      label={meta.label}
      description={meta.description}
      tone={meta.tone}
      Icon={meta.Icon}
      showLabel={showLabel}
    />
  )
}

export function EdocActionBadge({ action }: { action: EdocAssignableAction }) {
  const meta = actionMeta[action]
  return (
    <EdocMetaPill
      label={meta.label}
      description={meta.description}
      tone={meta.tone}
      Icon={meta.Icon}
      showLabel
    />
  )
}

export function EdocLoading({ label = 'Loading eDoc data...' }: { label?: string }) {
  return (
    <div className="edoc-loading" role="status" aria-live="polite">
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
      className="edoc-error-alert"
    />
  )
}

export function EdocEmpty({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <Empty
      className="edoc-empty"
      image={
        <span className="edoc-empty-icon" aria-hidden>
          <Inbox size={iconSize.dashboard} strokeWidth={iconStroke} />
        </span>
      }
      description={
        <div className="edoc-empty-copy">
          <h2>{title}</h2>
          <p>{description}</p>
          {action ? <div className="edoc-empty-action">{action}</div> : null}
        </div>
      }
    />
  )
}

export function formatEdocDate(value: string | null): string {
  return formatAppDate(value, 'Not set')
}

export function formatEdocEventType(eventType: string): string {
  if (eventType === 'signer_note') return 'Optional Note'
  return eventType
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
