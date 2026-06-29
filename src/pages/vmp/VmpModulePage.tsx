import { VrmsPage } from '../../components/vrms/VrmsPage'

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
      <section className="vrms-panel">
        <h2>{module}</h2>
        <p className="vrms-muted">This workspace is ready for VMP {module.toLowerCase()} content.</p>
      </section>
    </VrmsPage>
  )
}
