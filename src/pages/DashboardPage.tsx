import { DonutChart, SimpleBarChart, TrendChart } from '../components/charts/Charts'
import { ActivityTimeline, KpiCard, NotificationPanel, QuickActions, SummaryCard } from '../components/dashboard/DashboardComponents'
import { useToast } from '../components/feedback/ToastProvider'
import { dashboardMetrics, recentActivity } from '../data/mockDashboard'
import { useAuth } from '../hooks/useAuth'
import { formatDashboardGreeting } from '../lib/greeting'

export function DashboardPage() {
  const { notify } = useToast()
  const { user } = useAuth()
  const trend = [72, 78, 76, 84, 87, 91, 94].map((value, index) => ({ label: `W${index + 1}`, value }))
  const greeting = formatDashboardGreeting(user?.name ?? user?.email?.split('@')[0] ?? 'there')

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Reusable operations workspace</span>
          <h1>{greeting}</h1>
          <p>Monitor quality signals, document work, and approvals from one adaptable shell.</p>
        </div>
        <button className="button primary" onClick={() => notify('Mock report generated')}>
          Generate report
        </button>
      </div>
      <div className="kpi-grid">
        {dashboardMetrics.map((metric) => (
          <KpiCard key={metric.label} {...metric} />
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel span-2">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Performance</span>
              <h2>Quality health trend</h2>
            </div>
            <span className="status-badge success">On track</span>
          </div>
          <TrendChart data={trend} />
        </section>
        <SummaryCard title="Workflow mix">
          <DonutChart
            data={[
              { name: 'Review', value: 11 },
              { name: 'Approval', value: 8 },
              { name: 'Signature', value: 5 },
            ]}
          />
        </SummaryCard>
        <SummaryCard title="Monthly releases">
          <SimpleBarChart
            data={[
              { label: 'Jan', value: 12 },
              { label: 'Feb', value: 18 },
              { label: 'Mar', value: 15 },
              { label: 'Apr', value: 22 },
              { label: 'May', value: 26 },
            ]}
          />
        </SummaryCard>
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent activity</h2>
          </div>
          <ActivityTimeline items={recentActivity} />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Notifications</h2>
          </div>
          <NotificationPanel />
        </section>
        <section className="panel span-2">
          <div className="panel-heading">
            <h2>Quick actions</h2>
          </div>
          <QuickActions onAction={(action) => notify(`${action} opened in mock mode`)} />
        </section>
      </div>
    </div>
  )
}
