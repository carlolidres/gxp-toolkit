import type { ReactNode } from 'react'
import { Alert, Empty, Spin } from 'antd'
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'

import { iconSize, iconStroke } from '../../theme/iconSizes'

export function EmptyState({
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
      className="state-card"
      image={<Inbox size={iconSize.dashboard} strokeWidth={iconStroke} aria-hidden />}
      description={
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      }
    >
      {action}
    </Empty>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Alert
      className="state-card danger"
      type="error"
      showIcon
      icon={<AlertTriangle size={iconSize.md} strokeWidth={iconStroke} aria-hidden />}
      message="Something needs attention"
      description={message}
    />
  )
}

export function LoadingState({ label = 'Loading data' }: { label?: string }) {
  return (
    <div className="state-card" role="status" aria-live="polite">
      <Spin
        indicator={<Loader2 className="anticon-spin" size={iconSize.lg} strokeWidth={iconStroke} aria-hidden />}
      />
      <p>{label}…</p>
    </div>
  )
}
