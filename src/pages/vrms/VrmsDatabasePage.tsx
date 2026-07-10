import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Input, Select, Spin } from 'antd'
import { Download } from 'lucide-react'

import { VrmsPage } from '../../components/vrms/VrmsPage'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { useVrmsApp } from '../../context/VrmsAppContext'
import { VRMS_DATABASE_COLUMNS } from '../../lib/vrmsFormConfig'
import { VrmsDataTable } from '../../components/vrms/VrmsDataTable'
import type { RoutingDocument } from '../../types/vrms'
import { getStatusKey, buildDocumentSearchHaystack } from '../../utils/vrmsLogic'

const DATABASE_TABLE_COLUMNS = VRMS_DATABASE_COLUMNS.slice(0, 8) as unknown as Array<{
  key: keyof RoutingDocument
  label: string
}>

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function exportCsv(rows: RoutingDocument[]) {
  const headers = VRMS_DATABASE_COLUMNS.map((column) => column.label)
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      VRMS_DATABASE_COLUMNS.map((column) => escapeCsv(String(row[column.key] ?? ''))).join(','),
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `vrms-database-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function isOverdue(doc: RoutingDocument): boolean {
  if (!doc.targetCompletionDate) return false
  if (['sent', 'in edms', 'cancelled'].includes(getStatusKey(doc.status))) return false
  const target = new Date(doc.targetCompletionDate)
  if (Number.isNaN(target.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return target < today
}

export function VrmsDatabasePage() {
  const { appData, loading } = useVrmsApp()
  const { canExport } = useMenuPermission('database')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''
  const client = searchParams.get('client') ?? ''
  const department = searchParams.get('department') ?? ''
  const overdue = searchParams.get('overdue') === '1'

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    if (key === 'status' && value) next.delete('overdue')
    if (key === 'overdue' && value) next.delete('status')
    setSearchParams(next)
  }

  const filtered = useMemo(() => {
    const docs = appData?.documents ?? []
    const query = search.trim().toLowerCase()
    return docs.filter((doc) => {
      const haystack = buildDocumentSearchHaystack(doc)
      return (
        (!query || haystack.includes(query)) &&
        (!status || doc.status === status) &&
        (!client || doc.clientName === client) &&
        (!department || doc.department === department) &&
        (!overdue || isOverdue(doc))
      )
    })
  }, [appData?.documents, search, status, client, department, overdue])

  if (loading && !appData) {
    return (
      <div className="page">
        <Spin tip="Loading database…" />
      </div>
    )
  }

  return (
    <VrmsPage title="Database" description={`${appData?.documents.length ?? 0} routing records`}>
      <section className="vrms-panel vrms-database-panel">
        <div className="vrms-toolbar">
          <div>
            <label>Global search</label>
            <Input placeholder="Search all fields…" value={search} onChange={(event) => updateFilter('search', event.target.value)} />
          </div>
          <div>
            <label>Status</label>
            <Select value={status} onChange={(value) => updateFilter('status', value)} disabled={overdue} options={[
              { value: '', label: 'All Statuses' },
              ...(appData?.registries.Status ?? []).map((option) => ({ value: option, label: option })),
            ]} />
          </div>
          <div>
            <label>Client</label>
            <Select value={client} onChange={(value) => updateFilter('client', value)} options={[
              { value: '', label: 'All Clients' },
              ...(appData?.registries.Client ?? []).map((option) => ({ value: option, label: option })),
            ]} />
          </div>
          <div>
            <label>Department</label>
            <Select value={department} onChange={(value) => updateFilter('department', value)} options={[
              { value: '', label: 'All Departments' },
              ...(appData?.registries.Department ?? []).map((option) => ({ value: option, label: option })),
            ]} />
          </div>
          <label className="vrms-checkbox-filter">
            <input
              type="checkbox"
              checked={overdue}
              onChange={(event) => updateFilter('overdue', event.target.checked ? '1' : '')}
            />
            Overdue only
          </label>
          {canExport ? (
            <Button icon={<Download size={15} />} className="vrms-btn-secondary" onClick={() => exportCsv(filtered)}>Export CSV</Button>
          ) : null}
        </div>

        <VrmsDataTable
          rows={filtered}
          columns={DATABASE_TABLE_COLUMNS}
          onTrackerClick={(tracker) => navigate(`/routing?tracker=${encodeURIComponent(tracker)}`)}
        />
      </section>
    </VrmsPage>
  )
}
