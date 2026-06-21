import type { ReactNode } from 'react'

export function KpiCard({ label, value, change, tone = 'blue' }: { label: string; value: string; change: string; tone?: string }) {
  return <article className={`kpi-card ${tone}`}><div className="kpi-icon">◆</div><div><p>{label}</p><strong>{value}</strong><small>{change}</small></div></article>
}

export function SummaryCard({ title, value, detail, children }: { title: string; value?: string; detail?: string; children?: ReactNode }) {
  return <article className="panel summary-card"><div className="panel-heading"><h3>{title}</h3></div>{value && <strong className="summary-value">{value}</strong>}{detail && <p className="muted">{detail}</p>}{children}</article>
}

export function ActivityTimeline({ items }: { items: Array<{ title: string; meta: string }> }) {
  return <div className="timeline">{items.map((item, index) => <div className="timeline-item" key={item.title}><span>{index + 1}</span><div><strong>{item.title}</strong><p>{item.meta}</p></div></div>)}</div>
}

export function NotificationPanel() {
  return <div className="notification-list"><div className="notification warning"><strong>3 reviews due this week</strong><p>Prioritize SOP-104 and FRM-088.</p></div><div className="notification info"><strong>Capability report ready</strong><p>May CPV summary was generated.</p></div></div>
}

export function QuickActions({ onAction }: { onAction: (action: string) => void }) {
  return <div className="quick-actions">{['New document', 'Add process data', 'Start approval', 'Request signature'].map((action) => <button key={action} onClick={() => onAction(action)}><span>＋</span>{action}</button>)}</div>
}

