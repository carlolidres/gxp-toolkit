import type { ReactNode } from 'react'

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="state-card"><div className="state-icon">◇</div><h3>{title}</h3><p>{description}</p>{action}</div>
}

export function ErrorState({ message }: { message: string }) {
  return <div className="state-card danger"><div className="state-icon">!</div><h3>Something needs attention</h3><p>{message}</p></div>
}

export function LoadingState({ label = 'Loading data' }: { label?: string }) {
  return <div className="state-card"><span className="spinner" /><p>{label}…</p></div>
}

