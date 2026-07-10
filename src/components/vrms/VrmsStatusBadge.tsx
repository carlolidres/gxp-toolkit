import { Tag } from 'antd'

import { getVrmsStatusStyle } from '../../lib/vrmsStatus'

export function VrmsStatusBadge({ status }: { status: string }) {
  const style = getVrmsStatusStyle(status)
  return (
    <Tag
      className="vrms-status-pill"
      style={{
        color: style.text,
        background: style.background,
        borderColor: style.border,
      }}
    >
      {status || 'Blank'}
    </Tag>
  )
}
