import { useMemo, useState } from 'react'
import { Card, Input } from 'antd'

import { ApqrIcon } from '../../components/apqr/ApqrComponents'
import { formatEquipmentAuditTimestamp, listEquipmentAuditEvents } from '../../features/vmp/equipmentAudit'

export function VmpAuditPage() {
  const events = useMemo(() => listEquipmentAuditEvents(), [])
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return events
    return events.filter((row) =>
      row.description.toLowerCase().includes(needle)
      || row.performed_by_name.toLowerCase().includes(needle)
      || row.entity_label.toLowerCase().includes(needle)
      || row.field_name.toLowerCase().includes(needle)
      || (row.old_value ?? '').toLowerCase().includes(needle)
      || (row.new_value ?? '').toLowerCase().includes(needle)
      || (row.reason ?? '').toLowerCase().includes(needle),
    )
  }, [events, search])

  return (
    <div className="page apqr-page">
      <Card className="panel apqr-audit-panel" aria-labelledby="vmp-audit-list-title">
        <div className="panel-heading apqr-audit-heading">
          <div className="apqr-audit-heading-title">
            <h2 id="vmp-audit-list-title">
              <ApqrIcon name="clock" />
              Activity Log
            </h2>
            <span className="apqr-audit-count" aria-label={`${filtered.length} events`}>
              {filtered.length}
            </span>
          </div>
          <label className="apqr-search-field apqr-audit-search">
            <ApqrIcon name="search" />
            <Input
              type="search"
              value={search}
              placeholder="Search user, description, field, values…"
              aria-label="Search audit events"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <div className="table-scroll apqr-audit-table-scroll">
          <table className="data-table apqr-audit-table compact">
            <caption className="sr-only">Equipment audit activity log</caption>
            <thead>
              <tr>
                <th scope="col">Date and Time</th>
                <th scope="col">User</th>
                <th scope="col">Description</th>
                <th scope="col">Field</th>
                <th scope="col">Old Value</th>
                <th scope="col">New Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className="apqr-audit-timestamp">{formatEquipmentAuditTimestamp(row.performed_at)}</td>
                  <td className="apqr-audit-user">{row.performed_by_name}</td>
                  <td className="apqr-audit-description">{row.description}</td>
                  <td className="apqr-audit-field"><span className="apqr-audit-field-pill">{row.field_name}</span></td>
                  <td className="apqr-audit-value apqr-audit-value--old">{row.old_value || '—'}</td>
                  <td className="apqr-audit-value apqr-audit-value--new">{row.new_value || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <div className="apqr-audit-empty" role="status">
              <p className="apqr-audit-empty-title">{events.length ? 'No matching events' : 'No audit events yet'}</p>
              <p className="apqr-audit-empty-hint">
                {events.length
                  ? 'Try a different search term or clear the search field.'
                  : 'Equipment masterlist entries, changes, and deletions will appear here.'}
              </p>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  )
}
