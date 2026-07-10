import { EdocPage } from '../../components/edoc/EdocComponents'
import { Card, Statistic } from 'antd'
import { useEdocDashboard } from '../../features/edoc/useEdocData'

export function EdocReportsPage() {
  const { data } = useEdocDashboard()
  const completionTotal = data ? data.completed + data.rejected + data.returned + data.inRouting : 0
  const completionRate = completionTotal > 0 && data ? Math.round((data.completed / completionTotal) * 100) : 0

  return (
    <EdocPage title="Reports" description="Authorized operational eDoc metrics and export-ready summaries.">
      <section className="stats-grid edoc-stats">
        <Card className="stat-card"><Statistic title="Completion rate" value={completionRate} suffix="%" /></Card>
        <Card className="stat-card"><Statistic title="Returned" value={data?.returned ?? 0} /></Card>
        <Card className="stat-card"><Statistic title="Rejected" value={data?.rejected ?? 0} /></Card>
        <Card className="stat-card"><Statistic title="Overdue" value={data?.overdue ?? 0} /></Card>
      </section>
      <Card className="panel">
        <h2>Exports</h2>
        <p>CSV export is available from document list pages. Excel export and scheduled report delivery are deferred until the production reporting policy is approved.</p>
      </Card>
    </EdocPage>
  )
}

