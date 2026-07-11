import type { ReactNode } from 'react'
import { Alert, Input, Space, Spin, Tag, Tooltip, Typography } from 'antd'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Clock3,
  Columns3,
  Database,
  Download,
  Droplets,
  Eraser,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  History,
  Info,
  LayoutGrid,
  List,
  Loader2,
  Minus,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Tag as TagIcon,
  TimerOff,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'

import { useApqrActorSync } from '../../features/apqr/apqrAudit'
import type {
  ApqrPackage,
  ApqrPriority,
  ApqrReportStatus,
  CommitmentScheduleStatus,
  DeliveryClassification,
} from '../../features/apqr/types'
import { iconSize, iconStroke } from '../../theme/iconSizes'

const { Title, Paragraph, Text } = Typography

const priorityTone: Record<ApqrPriority, string> = {
  'Overdue Commitment': 'error',
  'Critical Commitment': 'warning',
  'High-Priority Commitment': 'warning',
  'Moderate Priority': 'processing',
  'Low Priority': 'default',
  Completed: 'success',
  'Overdue Stability Action': 'error',
  'Critical Stability Action': 'warning',
}

const priorityMeta: Record<ApqrPriority, { description: string; Icon: LucideIcon }> = {
  'Overdue Commitment': {
    description: 'Commitment date has passed and delivery is still outstanding.',
    Icon: TimerOff,
  },
  'Critical Commitment': {
    description: 'Commitment is due very soon and needs immediate attention.',
    Icon: CircleAlert,
  },
  'High-Priority Commitment': {
    description: 'Commitment is approaching and should be prioritized.',
    Icon: AlertTriangle,
  },
  'Moderate Priority': {
    description: 'Commitment is on track with moderate urgency.',
    Icon: Clock3,
  },
  'Low Priority': {
    description: 'Commitment has comfortable lead time remaining.',
    Icon: CircleDashed,
  },
  Completed: {
    description: 'APQR workflow for this record is complete.',
    Icon: CheckCircle2,
  },
  'Overdue Stability Action': {
    description: 'Stability pull-out or tabulation action is overdue.',
    Icon: TimerOff,
  },
  'Critical Stability Action': {
    description: 'Stability action is due soon and needs follow-up.',
    Icon: CircleAlert,
  },
}

const deliveryMeta: Record<DeliveryClassification, { description: string; Icon: LucideIcon; tone: string }> = {
  'Delivered On Time': {
    description: 'Final delivery occurred on or before the commitment date.',
    Icon: CheckCircle2,
    tone: 'success',
  },
  'Delivered Overdue': {
    description: 'Final delivery occurred after the commitment date.',
    Icon: Clock3,
    tone: 'warning',
  },
  'Currently Overdue and Undelivered': {
    description: 'Commitment date has passed and the APQR is still undelivered.',
    Icon: TimerOff,
    tone: 'error',
  },
  NA: {
    description: 'Delivery classification is not applicable for this record.',
    Icon: CircleDashed,
    tone: 'default',
  },
}

const reportStatusMeta: Record<ApqrReportStatus, { description: string; Icon: LucideIcon; tone: string }> = {
  'Draft Sent': {
    description: 'Draft APQR report has been sent to the client.',
    Icon: Send,
    tone: 'processing',
  },
  'For Client Approval': {
    description: 'Report is awaiting client approval.',
    Icon: FileCheck2,
    tone: 'warning',
  },
  'Client Approved': {
    description: 'Client has approved the APQR report.',
    Icon: CheckCircle2,
    tone: 'success',
  },
}

function ApqrStatusIcon({
  label,
  description,
  tone,
  Icon,
}: {
  label: string
  description: string
  tone: string
  Icon: LucideIcon
}) {
  return (
    <Tooltip
      title={
        <div className="apqr-status-tooltip">
          <strong>{label}</strong>
          <span>{description}</span>
        </div>
      }
    >
      <span
        className={`apqr-status-icon tone-${tone}`}
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

export function ApqrPage({
  eyebrow = 'APQR',
  title,
  description,
  icon,
  action,
  headerClassName,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  icon?: string
  action?: ReactNode
  headerClassName?: string
  children: ReactNode
}) {
  useApqrActorSync()
  const headerClass = ['page-header', 'apqr-page-header', headerClassName].filter(Boolean).join(' ')
  return (
    <div className="page apqr-page">
      <section className={headerClass} aria-labelledby="apqr-page-title">
        <div className="apqr-page-header-title-block">
          <Text className="eyebrow" type="secondary">
            {eyebrow}
          </Text>
          <div className="apqr-page-header-title">
            {icon ? (
              <span className="apqr-page-header-icon" aria-hidden="true">
                <ApqrIcon name={icon} />
              </span>
            ) : null}
            <Title level={2} id="apqr-page-title" style={{ margin: 0 }}>
              {title}
            </Title>
          </div>
          {description ? (
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {description}
            </Paragraph>
          ) : null}
        </div>
        {action ? (
          <div className="page-actions">
            <Space wrap>{action}</Space>
          </div>
        ) : null}
      </section>
      {children}
    </div>
  )
}

export function ApqrLoading() {
  return (
    <div role="status" aria-live="polite">
      <Spin
        tip="Loading APQR data…"
        indicator={<Loader2 className="anticon-spin" size={iconSize.lg} strokeWidth={iconStroke} aria-hidden />}
      />
    </div>
  )
}

export function ApqrError({ message }: { message: string }) {
  return <Alert type="error" showIcon message={message} role="alert" />
}

export function ApqrPriorityBadge({ priority, label }: { priority: ApqrPriority; label?: string }) {
  const meta = priorityMeta[priority]
  const displayLabel = label ?? priority
  if (!meta) {
    return (
      <Tag className={`status-pill ${priorityTone[priority] ?? 'default'}`} color={priorityTone[priority] ?? 'default'}>
        {displayLabel}
      </Tag>
    )
  }
  return (
    <ApqrStatusIcon
      label={displayLabel}
      description={meta.description}
      tone={priorityTone[priority] ?? 'default'}
      Icon={meta.Icon}
    />
  )
}

const commitmentTone: Record<CommitmentScheduleStatus, string> = {
  Planned: 'processing',
  'For Client Approval': 'warning',
  'Client Approved': 'success',
}

export function ApqrCommitmentStatusBadge({ status }: { status: CommitmentScheduleStatus }) {
  return (
    <Tag className={`status-pill ${commitmentTone[status] ?? 'default'}`} color={commitmentTone[status] ?? 'default'}>
      {status}
    </Tag>
  )
}

export function ApqrDeliveryBadge({
  classification,
  fallbackStatus,
}: {
  classification: DeliveryClassification | null
  fallbackStatus?: CommitmentScheduleStatus | null
}) {
  if (classification) {
    const meta = deliveryMeta[classification]
    return (
      <ApqrStatusIcon
        label={classification}
        description={meta.description}
        tone={meta.tone}
        Icon={meta.Icon}
      />
    )
  }
  if (fallbackStatus === 'For Client Approval') {
    return (
      <ApqrStatusIcon
        label={fallbackStatus}
        description="Commitment schedule is awaiting client approval."
        tone="processing"
        Icon={FileCheck2}
      />
    )
  }
  return (
    <ApqrStatusIcon
      label="Not yet delivered"
      description="No final delivery date recorded yet."
      tone="default"
      Icon={CircleDashed}
    />
  )
}

export function ApqrReportStatusBadge({ status }: { status: ApqrReportStatus | string | null }) {
  if (!status) return <>—</>
  const meta = reportStatusMeta[status as ApqrReportStatus]
  if (!meta) {
    return (
      <Tag className="status-pill default" color="default">
        {status}
      </Tag>
    )
  }
  return <ApqrStatusIcon label={status} description={meta.description} tone={meta.tone} Icon={meta.Icon} />
}

const packageTone: Record<ApqrPackage, string> = {
  Billable: 'success',
  'Not Billable': 'default',
}

export function ApqrPackageBadge({ apqrPackage }: { apqrPackage: ApqrPackage }) {
  return (
    <Tag className={`status-pill ${packageTone[apqrPackage]}`} color={packageTone[apqrPackage]}>
      {apqrPackage}
    </Tag>
  )
}

const apqrIconMap = {
  search: Search,
  filter: Filter,
  export: Download,
  save: Save,
  clear: Eraser,
  reset: RotateCcw,
  edit: Pencil,
  more: MoreVertical,
  plus: Plus,
  minus: Minus,
  check: Check,
  close: X,
  trash: Trash2,
  info: Info,
  chevron: RefreshCw,
  eye: Eye,
  list: List,
  grid: LayoutGrid,
  columns: Columns3,
  external: ExternalLink,
  users: Users,
  building: Building2,
  calendar: CalendarDays,
  database: Database,
  document: FileText,
  clock: History,
  history: History,
  warning: AlertTriangle,
  cycle: RefreshCw,
  load: Download,
  package: Package,
  send: Send,
  droplet: Droplets,
  tag: TagIcon,
} as const

export function ApqrIcon({
  name,
  size = iconSize.sm,
  width,
  height,
  className,
  ...rest
}: {
  name: string
  size?: number
  width?: number | string
  height?: number | string
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}) {
  const Icon = apqrIconMap[name as keyof typeof apqrIconMap]
  if (!Icon) return null
  const resolvedSize =
    typeof width === 'number' ? width : typeof height === 'number' ? height : size
  return (
    <Icon
      className={className}
      size={resolvedSize}
      strokeWidth={iconStroke}
      aria-hidden={rest['aria-hidden'] ?? true}
    />
  )
}

export function ApqrSearchBar({
  value,
  onChange,
  placeholder = 'Search…',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <Input
      className="apqr-search"
      type="search"
      allowClear
      prefix={<Search size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
    />
  )
}
