import { useMemo, useState } from 'react'
import { Card, Input, Select } from 'antd'

import { CpvEmpty, CpvError, CpvLoading, CpvPage } from '../../components/cpv/CpvComponents'
import { listCpvAudit, listCpvProducts } from '../../features/cpv/cpvService'
import { useCpvLoad } from '../../features/cpv/useCpvData'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { formatAppDateTime } from '../../utils/dateUtils'
import { exportRows } from '../../utils/exportUtils'

export function CpvAuditPage() {
  const products = useCpvLoad(() => listCpvProducts())
  const audit = useCpvLoad(() => listCpvAudit())
  const { canExport } = useMenuPermission('cpv-audit')
  const [user, setUser] = useState('')
  const [productId, setProductId] = useState<string>('all')
  const [moduleName, setModuleName] = useState('')
  const [actionType, setActionType] = useState('')
  const [recordId, setRecordId] = useState('')

  const filtered = useMemo(() => {
    return (audit.data ?? []).filter((row) => {
      if (user && !row.actor_name.toLowerCase().includes(user.toLowerCase())) return false
      if (productId !== 'all' && row.product_id !== productId) return false
      if (moduleName && (row.module ?? '') !== moduleName) return false
      if (actionType && row.action_type !== actionType) return false
      if (recordId && !row.record_id.toLowerCase().includes(recordId.toLowerCase()) && !(row.record_label ?? '').toLowerCase().includes(recordId.toLowerCase())) {
        return false
      }
      return true
    })
  }, [audit.data, user, productId, moduleName, actionType, recordId])

  if (audit.loading) {
    return (
      <CpvPage title="Audit Trail" description="Append-only CPV activity history.">
        <CpvLoading />
      </CpvPage>
    )
  }

  return (
    <CpvPage
      title="Audit Trail"
      description="Who, what, when, old value, new value, and reason. Exporting is recorded in a later persistence phase; this viewer is read-only."
      action={
        canExport ? (
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              exportRows(
                filtered.map((row) => ({
                  When: row.occurred_at,
                  User: row.actor_name,
                  Role: row.actor_role ?? '',
                  Action: row.action_type,
                  Product: row.product_id ?? '',
                  Module: row.module ?? '',
                  Record: row.record_label ?? row.record_id,
                  Field: row.field_name ?? '',
                  'Old value': row.old_value ?? '',
                  'New value': row.new_value ?? '',
                  Reason: row.reason ?? '',
                })),
                `cpv-audit-${new Date().toISOString().slice(0, 10)}.csv`,
              )
            }
          >
            Export
          </button>
        ) : null
      }
    >
      {audit.error ? <CpvError message={audit.error} /> : null}
      <Card className="panel">
        <div className="cpv-toolbar-filters" style={{ marginBottom: 12 }}>
          <Input placeholder="User" value={user} onChange={(event) => setUser(event.target.value)} aria-label="Filter by user" />
          <Select
            value={productId}
            onChange={setProductId}
            options={[{ value: 'all', label: 'All products' }, ...(products.data ?? []).map((product) => ({ value: product.id, label: product.product_code }))]}
            style={{ minWidth: 160 }}
            aria-label="Filter by product"
          />
          <Input placeholder="Module" value={moduleName} onChange={(event) => setModuleName(event.target.value)} aria-label="Filter by module" />
          <Input placeholder="Action type" value={actionType} onChange={(event) => setActionType(event.target.value)} aria-label="Filter by action" />
          <Input placeholder="Record ID or label" value={recordId} onChange={(event) => setRecordId(event.target.value)} aria-label="Filter by record" />
        </div>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Module</th>
                <th>Record</th>
                <th>Field</th>
                <th>Old value</th>
                <th>New value</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>{formatAppDateTime(row.occurred_at)}</td>
                  <td>{row.actor_name}</td>
                  <td>{row.actor_role ?? '—'}</td>
                  <td>{row.action_type}</td>
                  <td>{row.module ?? '—'}</td>
                  <td>{row.record_label ?? row.record_id}</td>
                  <td>{row.field_name ?? '—'}</td>
                  <td>{row.old_value ?? '—'}</td>
                  <td>{row.new_value ?? '—'}</td>
                  <td>{row.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? <CpvEmpty title="No audit events" hint="Create or change a CPV record to populate this trail." /> : null}
        </div>
      </Card>
    </CpvPage>
  )
}
