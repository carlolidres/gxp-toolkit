import { useEffect, useState } from 'react'
import { EdocPage } from '../../components/edoc/EdocComponents'
import { Card, Tag } from 'antd'
import { Settings2 } from 'lucide-react'

import {
  loadBillingHealthSnapshot,
  type BillingHealthSnapshot,
} from '../../features/edoc/billing/billingHealthService'
import { formatAppDateTime } from '../../utils/dateUtils'

const adminAreas = [
  'Role and permission matrix',
  'Departments and business units',
  'Document types and categories',
  'Routing templates',
  'Reminder and escalation settings',
  'Signature settings',
  'Retention settings',
  'Notification settings',
  'Email templates',
  'Audit and report access',
]

export function EdocAdministrationPage() {
  const [health, setHealth] = useState<BillingHealthSnapshot | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadBillingHealthSnapshot()
      .then((snapshot) => {
        if (!cancelled) setHealth(snapshot)
      })
      .catch((caught) => {
        if (!cancelled) {
          setHealthError(caught instanceof Error ? caught.message : 'Billing health could not be loaded.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const run = health?.lastRun
  const runLabel = run?.started_at ? formatAppDateTime(run.started_at) : 'Never'

  return (
    <EdocPage title="Administration" description="Organization-scoped eDoc controls for administrators.">
      <Card className="panel" style={{ marginBottom: 16 }}>
        <h2 className="m-0 mb-2 text-base font-semibold">Billing health</h2>
        <p className="mb-3 mt-0 text-sm text-[var(--muted)]">
          Counts only. Entitlement still changes from verified Paddle webhooks or the daily reconcile job.
        </p>
        {healthError ? (
          <p className="m-0 text-sm text-[var(--danger-text)]">{healthError}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Tag>Last reconcile: {runLabel}</Tag>
            <Tag color={run?.status === 'ERROR' ? 'red' : run?.status === 'OK' ? 'green' : 'default'}>
              {run?.status ?? (health?.reconcileEnabled ? 'No runs yet' : 'Reconcile flag off')}
            </Tag>
            <Tag>Failed webhooks: {run?.failed_event_count ?? '—'}</Tag>
            <Tag>Past due: {run?.past_due_count ?? '—'}</Tag>
            <Tag>Drift repaired: {run?.repaired_count ?? '—'}</Tag>
          </div>
        )}
      </Card>
      <Card className="panel">
        <div className="adapter-grid">
          {adminAreas.map((area) => (
            <Card key={area} size="small">
              <Settings2 size={18} aria-hidden="true" />
              <div>
                <strong>{area}</strong>
                <p>Protected configuration area. Writes must use RLS/RPC or Edge Functions.</p>
                <Tag color="gold">Authorized admins</Tag>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </EdocPage>
  )
}
