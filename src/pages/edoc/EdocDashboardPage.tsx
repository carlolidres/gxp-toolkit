import { Link } from 'react-router-dom'
import { Button, Card, Statistic } from 'antd'

import { EdocError, EdocLoading, EdocPage } from '../../components/edoc/EdocComponents'
import { useEdocDashboard, useEdocInbox } from '../../features/edoc/useEdocData'

export function EdocDashboardPage() {
  const dashboard = useEdocDashboard()
  const inbox = useEdocInbox()

  if (dashboard.loading) return <EdocPage title="Dashboard"><EdocLoading /></EdocPage>

  const metrics = dashboard.data

  return (
    <EdocPage
      title="Dashboard"
      description="Controlled PDF routing, signature, acknowledgment, and audit activity."
      action={
        <Link to="/edoc/create">
          <Button type="primary">Create Document</Button>
        </Link>
      }
    >
      {dashboard.error ? <EdocError message={dashboard.error} /> : null}
      {metrics ? (
        <section className="stats-grid edoc-stats">
          <Metric label="Awaiting my action" value={metrics.awaitingMyAction} />
          <Metric label="Pending review" value={metrics.pendingReview} />
          <Metric label="Pending approval" value={metrics.pendingApproval} />
          <Metric label="Pending signature" value={metrics.pendingSignature} />
          <Metric label="Pending acknowledgment" value={metrics.pendingAcknowledgment} />
          <Metric label="Drafts" value={metrics.drafts} />
          <Metric label="In routing" value={metrics.inRouting} />
          <Metric label="Due soon" value={metrics.dueSoon} />
          <Metric label="Overdue" value={metrics.overdue} />
          <Metric label="Returned" value={metrics.returned} />
          <Metric label="Rejected" value={metrics.rejected} />
          <Metric label="Completed" value={metrics.completed} />
        </section>
      ) : null}

      <Card
        className="panel"
        title="Recent Assignments"
        extra={
          <Link to="/edoc/inbox">
            <Button>Open inbox</Button>
          </Link>
        }
      >
        {inbox.error ? <EdocError message={inbox.error} /> : null}
        <div className="task-list">
          {(inbox.data ?? []).slice(0, 5).map((task) => (
            <article key={task.id}>
              <div>
                <strong>{task.documentTitle}</strong>
                <p>
                  {task.documentNumber} · {task.action}
                </p>
              </div>
              <Link to={`/edoc/workspace/${task.id}`}>
                <Button size="small">Open</Button>
              </Link>
            </article>
          ))}
          {!inbox.loading && (inbox.data ?? []).length === 0 ? (
            <p className="messages-empty">No active assignments.</p>
          ) : null}
        </div>
      </Card>
    </EdocPage>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="stat-card" size="small">
      <Statistic title={label} value={value} />
    </Card>
  )
}
