import { EdocPage } from '../../components/edoc/EdocComponents'
import { useEdocDashboard } from '../../features/edoc/useEdocData'

export function EdocReportsPage() {
  const { data } = useEdocDashboard()
  const completionTotal = data ? data.completed + data.rejected + data.returned + data.inRouting : 0
  const completionRate = completionTotal > 0 && data ? Math.round((data.completed / completionTotal) * 100) : 0

  return (
    <EdocPage title="Reports" description="Authorized operational eDoc metrics and export-ready summaries.">
      <section className="stats-grid edoc-stats">
        <article className="stat-card"><span>Completion rate</span><strong>{completionRate}%</strong></article>
        <article className="stat-card"><span>Returned</span><strong>{data?.returned ?? 0}</strong></article>
        <article className="stat-card"><span>Rejected</span><strong>{data?.rejected ?? 0}</strong></article>
        <article className="stat-card"><span>Overdue</span><strong>{data?.overdue ?? 0}</strong></article>
      </section>
      <section className="panel">
        <h2>Exports</h2>
        <p>CSV export is available from document list pages. Excel export and scheduled report delivery are deferred until the production reporting policy is approved.</p>
      </section>
    </EdocPage>
  )
}

