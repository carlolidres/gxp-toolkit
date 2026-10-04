import type { ReactNode } from 'react'
import { Alert, Space, Spin, Tag, Typography } from 'antd'
import { Activity, Loader2 } from 'lucide-react'

import { useCpvActorSync } from '../../features/cpv/useCpvData'
import type { CpvPosture, CpvProductStatus } from '../../features/cpv/types'
import { iconSize, iconStroke } from '../../theme/iconSizes'

const { Title, Paragraph, Text } = Typography

const postureTone: Record<CpvPosture, string> = {
  'Not Assessed': 'default',
  'Insufficient Data': 'processing',
  'Not Valid': 'error',
  'At Risk': 'warning',
  Valid: 'success',
}

const statusTone: Record<CpvProductStatus, string> = {
  Draft: 'processing',
  Active: 'success',
  Retired: 'default',
}

export function CpvPage({
  title,
  description,
  action,
  sheet = false,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  sheet?: boolean
  children: ReactNode
}) {
  useCpvActorSync()
  return (
    <div className={sheet ? 'page cpv-page cpv-page--sheet' : 'page cpv-page'}>
      <section className={sheet ? 'page-header cpv-page-header--sheet' : 'page-header'} aria-labelledby="cpv-page-title">
        <div>
          <Text className="eyebrow" type="secondary">
            Continuous Process Verification
          </Text>
          <div className="cpv-page-title-row">
            {sheet ? null : <Activity size={iconSize.md} strokeWidth={iconStroke} aria-hidden />}
            <Title level={2} id="cpv-page-title" style={{ margin: 0 }}>
              {title}
            </Title>
          </div>
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

export function CpvLoading({ label = 'Loading CPV data…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite">
      <Spin tip={label} indicator={<Loader2 className="anticon-spin" size={iconSize.lg} strokeWidth={iconStroke} aria-hidden />} />
    </div>
  )
}

export function CpvError({ message }: { message: string }) {
  return <Alert type="error" showIcon message={message} role="alert" />
}

export function CpvPostureBadge({ posture }: { posture: CpvPosture }) {
  return (
    <Tag color={postureTone[posture]} className={`status-pill ${postureTone[posture]}`}>
      {posture}
    </Tag>
  )
}

export function CpvStatusBadge({ status }: { status: CpvProductStatus }) {
  return (
    <Tag color={statusTone[status]} className={`status-pill ${statusTone[status]}`}>
      {status}
    </Tag>
  )
}

export function CpvEmpty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="cpv-empty" role="status">
      <p className="cpv-empty-title">{title}</p>
      <p className="cpv-empty-hint">{hint}</p>
    </div>
  )
}
