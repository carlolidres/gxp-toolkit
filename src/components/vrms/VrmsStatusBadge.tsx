import { Tooltip } from 'antd'
import {
  Archive,
  CheckCircle2,
  Circle,
  FileCheck2,
  RotateCcw,
  ScanLine,
  Send,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import { getVrmsStatusKey, getVrmsStatusMeta, getVrmsStatusStyle } from '../../lib/vrmsStatus'
import { iconSize, iconStroke } from '../../theme/iconSizes'

const STATUS_ICONS: Record<string, LucideIcon> = {
  routing: Send,
  completed: CheckCircle2,
  fullysigned: FileCheck2,
  forscanning: ScanLine,
  sent: CheckCircle2,
  inedms: Archive,
  returnedto: RotateCcw,
  cancelled: XCircle,
  blank: Circle,
}

export function VrmsStatusBadge({ status }: { status: string }) {
  const meta = getVrmsStatusMeta(status)
  const style = getVrmsStatusStyle(status)
  const Icon = STATUS_ICONS[getVrmsStatusKey(status)] ?? Circle
  const tooltipTitle = (
    <div className="vrms-status-tooltip">
      <strong>{meta.label}</strong>
      <span>{meta.description}</span>
    </div>
  )

  return (
    <Tooltip title={tooltipTitle}>
      <span
        className="vrms-status-icon"
        style={{ color: style.color, background: style.background }}
        aria-label={`${meta.label}. ${meta.description}`}
        role="img"
        tabIndex={0}
      >
        <Icon size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
        <span className="visually-hidden">{meta.label}</span>
      </span>
    </Tooltip>
  )
}
