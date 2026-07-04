import type { ReactNode, SVGProps } from 'react'

import { useApqrActorSync } from '../../features/apqr/apqrAudit'
import type {
  ApqrPackage,
  ApqrPriority,
  ApqrReportStatus,
  CommitmentScheduleStatus,
  DeliveryClassification,
} from '../../features/apqr/types'

const priorityTone: Record<ApqrPriority, string> = {
  'Overdue Commitment': 'danger',
  'Critical Commitment': 'warning',
  'High-Priority Commitment': 'warning',
  'Moderate Priority': 'info',
  'Low Priority': 'neutral',
  Completed: 'success',
  'Overdue Stability Action': 'danger',
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
          <span className="eyebrow">{eyebrow}</span>
          <div className="apqr-page-header-title">
            {icon ? (
              <span className="apqr-page-header-icon" aria-hidden="true">
                <ApqrIcon name={icon} />
              </span>
            ) : null}
            <h1 id="apqr-page-title">{title}</h1>
          </div>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="page-actions">{action}</div> : null}
      </section>
      {children}
    </div>
  )
}

export function ApqrLoading() {
  return <p className="messages-empty">Loading APQR data…</p>
}

export function ApqrError({ message }: { message: string }) {
  return <p className="form-error" role="alert">{message}</p>
}

export function ApqrPriorityBadge({ priority }: { priority: ApqrPriority }) {
  return <span className={`status-pill ${priorityTone[priority] ?? 'neutral'}`}>{priority}</span>
}

const commitmentTone: Record<CommitmentScheduleStatus, string> = {
  Planned: 'info',
  'For Client Approval': 'warning',
  'Client Approved': 'success',
}

export function ApqrCommitmentStatusBadge({ status }: { status: CommitmentScheduleStatus }) {
  return <span className={`status-pill ${commitmentTone[status] ?? 'neutral'}`}>{status}</span>
}

const deliveryTone: Record<DeliveryClassification, string> = {
  'Delivered On Time': 'success',
  'Delivered Overdue': 'warning',
  'Currently Overdue and Undelivered': 'danger',
}

export function ApqrDeliveryBadge({
  classification,
  fallbackStatus,
}: {
  classification: DeliveryClassification | null
  fallbackStatus?: CommitmentScheduleStatus | null
}) {
  if (classification) {
    return <span className={`status-pill ${deliveryTone[classification]}`}>{classification}</span>
  }
  if (fallbackStatus === 'For Client Approval') {
    return <span className="status-pill info">{fallbackStatus}</span>
  }
  return <>—</>
}

const reportStatusTone: Record<ApqrReportStatus, string> = {
  'Draft Sent': 'info',
  'For Client Approval': 'warning',
  'Client Approved': 'success',
}

export function ApqrReportStatusBadge({ status }: { status: ApqrReportStatus | null }) {
  if (!status) return <>—</>
  return <span className={`status-pill ${reportStatusTone[status]}`}>{status}</span>
}

const packageTone: Record<ApqrPackage, string> = {
  Billable: 'success',
  'Not Billable': 'neutral',
}

export function ApqrPackageBadge({ apqrPackage }: { apqrPackage: ApqrPackage }) {
  return <span className={`status-pill ${packageTone[apqrPackage]}`}>{apqrPackage}</span>
}

export function ApqrIcon({ name, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  const shared = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  }

  if (name === 'search') {
    return (
      <svg {...shared}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    )
  }
  if (name === 'filter') {
    return (
      <svg {...shared}>
        <path d="M4 5h16" />
        <path d="M7 12h10" />
        <path d="M10 19h4" />
      </svg>
    )
  }
  if (name === 'export') {
    return (
      <svg {...shared}>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
    )
  }
  if (name === 'save') {
    return (
      <svg {...shared}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
        <path d="M17 21v-8H7v8" />
        <path d="M7 3v5h8" />
      </svg>
    )
  }
  if (name === 'clear') {
    return (
      <svg {...shared}>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M9 10v7" />
        <path d="M15 10v7" />
        <path d="M10 6l1 14h2l1-14" />
      </svg>
    )
  }
  if (name === 'edit') {
    return (
      <svg {...shared}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    )
  }
  if (name === 'more') {
    return (
      <svg {...shared}>
        <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (name === 'plus') {
    return (
      <svg {...shared}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    )
  }
  if (name === 'minus') {
    return (
      <svg {...shared}>
        <path d="M5 12h14" />
      </svg>
    )
  }
  if (name === 'check') {
    return (
      <svg {...shared}>
        <path d="m5 12 4.5 4.5L19 7" />
      </svg>
    )
  }
  if (name === 'close') {
    return (
      <svg {...shared}>
        <path d="m8 8 8 8" />
        <path d="m16 8-8 8" />
      </svg>
    )
  }
  if (name === 'trash') {
    return (
      <svg {...shared}>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    )
  }
  if (name === 'info') {
    return (
      <svg {...shared}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10v6" />
        <path d="M12 7h.01" />
      </svg>
    )
  }
  if (name === 'chevron') {
    return (
      <svg {...shared}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    )
  }
  if (name === 'eye') {
    return (
      <svg {...shared}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  if (name === 'list') {
    return (
      <svg {...shared}>
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </svg>
    )
  }
  if (name === 'grid') {
    return (
      <svg {...shared}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  }
  if (name === 'columns') {
    return (
      <svg {...shared}>
        <path d="M4 4h5v16H4Z" />
        <path d="M10 4h5v16h-5Z" />
        <path d="M16 4h5v16h-5Z" />
      </svg>
    )
  }
  if (name === 'external') {
    return (
      <svg {...shared}>
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </svg>
    )
  }
  if (name === 'users') {
    return (
      <svg {...shared}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  }
  if (name === 'building') {
    return (
      <svg {...shared}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M9 7h.01M9 11h.01M9 15h.01M15 7h.01M15 11h.01M15 15h.01" />
      </svg>
    )
  }
  if (name === 'calendar') {
    return (
      <svg {...shared}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    )
  }
  if (name === 'database') {
    return (
      <svg {...shared}>
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <path d="M4 6v4c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
        <path d="M4 10v4c0 1.66 3.58 3 8 3s8-1.34 8-3v-4" />
        <path d="M4 14v4c0 1.66 3.58 3 8 3s8-1.34 8-3v-4" />
      </svg>
    )
  }
  if (name === 'document') {
    return (
      <svg {...shared}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M10 13h4" />
        <path d="M10 17h4" />
      </svg>
    )
  }
  if (name === 'clock') {
    return (
      <svg {...shared}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }
  if (name === 'history') {
    return (
      <svg {...shared}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 12h4" />
        <path d="M7 12V8" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }
  if (name === 'warning') {
    return (
      <svg {...shared}>
        <path d="M12 3 2.5 20h19L12 3Z" />
        <path d="M12 9v5" />
        <path d="M12 17h.01" />
      </svg>
    )
  }
  return null
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
    <input
      className="apqr-search"
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
