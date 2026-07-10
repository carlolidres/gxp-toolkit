import type { ReactNode } from 'react'
import { Alert, Input, Space, Spin, Tag, Typography } from 'antd'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  Columns3,
  Database,
  Download,
  Eraser,
  ExternalLink,
  Eye,
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
  Trash2,
  Users,
  X,
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
  return (
    <Tag className={`status-pill ${priorityTone[priority] ?? 'default'}`} color={priorityTone[priority] ?? 'default'}>
      {label ?? priority}
    </Tag>
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

const deliveryTone: Record<DeliveryClassification, string> = {
  'Delivered On Time': 'success',
  'Delivered Overdue': 'warning',
  'Currently Overdue and Undelivered': 'error',
  NA: 'default',
}

export function ApqrDeliveryBadge({
  classification,
  fallbackStatus,
}: {
  classification: DeliveryClassification | null
  fallbackStatus?: CommitmentScheduleStatus | null
}) {
  if (classification) {
    return (
      <Tag className={`status-pill ${deliveryTone[classification]}`} color={deliveryTone[classification]}>
        {classification}
      </Tag>
    )
  }
  if (fallbackStatus === 'For Client Approval') {
    return (
      <Tag className="status-pill processing" color="processing">
        {fallbackStatus}
      </Tag>
    )
  }
  return <>—</>
}

const reportStatusTone: Record<ApqrReportStatus, string> = {
  'Draft Sent': 'processing',
  'For Client Approval': 'warning',
  'Client Approved': 'success',
}

export function ApqrReportStatusBadge({ status }: { status: ApqrReportStatus | string | null }) {
  if (!status) return <>—</>
  const tone = reportStatusTone[status as ApqrReportStatus] ?? 'default'
  return (
    <Tag className={`status-pill ${tone}`} color={tone}>
      {status}
    </Tag>
  )
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
