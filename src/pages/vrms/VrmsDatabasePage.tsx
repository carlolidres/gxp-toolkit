import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { VrmsPage } from '../../components/vrms/VrmsPage'
import { useMenuPermission } from '../../hooks/usePermissions'
import { useVrmsApp } from '../../context/VrmsAppContext'
import { VRMS_DATABASE_COLUMNS } from '../../lib/vrmsFormConfig'
import { VrmsDataTable } from '../../components/vrms/VrmsDataTable'
import type { RoutingDocument } from '../../types/vrms'
import { getStatusKey } from '../../utils/vrmsLogic'

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
      const haystack = Object.values(doc).join(' ').toLowerCase()
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
        <div className="vrms-loading">Loading database…</div>
      </div>
    )
  }

  return (
    <VrmsPage title="Database" description={`${appData?.documents.length ?? 0} routing records`}>
      <section className="vrms-panel">
        <div className="vrms-toolbar">
          <div>
            <label>Global search</label>
            <input placeholder="Search all fields…" value={search} onChange={(event) => updateFilter('search', event.target.value)} />
          </div>
          <div>
            <label>Status</label>
            <select value={status} onChange={(event) => updateFilter('status', event.target.value)} disabled={overdue}>
              <option value="">All Statuses</option>
              {(appData?.registries.Status ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Client</label>
            <select value={client} onChange={(event) => updateFilter('client', event.target.value)}>
              <option value="">All Clients</option>
              {(appData?.registries.Client ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Department</label>
            <select value={department} onChange={(event) => updateFilter('department', event.target.value)}>
              <option value="">All Departments</option>
              {(appData?.registries.Department ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
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
            <button type="button" className="vrms-btn-secondary" onClick={() => exportCsv(filtered)}>
              Export CSV
            </button>
          ) : null}
        </div>

        <VrmsDataTable
          rows={filtered}
          columns={VRMS_DATABASE_COLUMNS as unknown as Array<{ key: keyof RoutingDocument; label: string }>}
          onTrackerClick={(tracker) => navigate(`/routing?tracker=${encodeURIComponent(tracker)}`)}
        />
      </section>
    </VrmsPage>
  )
}
