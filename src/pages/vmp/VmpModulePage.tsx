import { Card } from 'antd'
import { ClipboardList } from 'lucide-react'

import { VrmsPage } from '../../components/vrms/VrmsPage'
import { iconSize, iconStroke } from '../../theme/iconSizes'

const descriptions = {
  'Risk Assessment': 'Track VMP risk assessment activities and approval readiness.',
  Timeline: 'Review validation planning milestones and execution timing.',
  'Audit Trail': 'Review VMP activity history and traceability records.',
} as const

type VmpModuleName = keyof typeof descriptions

export function VmpModulePage({ module }: { module: VmpModuleName }) {
  return (
    <VrmsPage
      eyebrow="Validation Master Plan"
      title={`VMP / ${module}`}
      description={descriptions[module]}
    >
      <Card
        className="vrms-panel"
        title={
          <span className="inline-flex items-center gap-2">
            <ClipboardList size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
            {module}
          </span>
        }
      >
        <p className="vrms-muted">This workspace is ready for VMP {module.toLowerCase()} content.</p>
      </Card>
    </VrmsPage>
  )
}
