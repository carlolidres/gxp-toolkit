import { useMemo, useState } from 'react'

import { ApqrError, ApqrIcon, ApqrLoading, ApqrPage } from '../../components/apqr/ApqrComponents'
import { formatAuditTimestamp, listApqrAuditEvents } from '../../features/apqr/apqrService'
import type { ApqrAuditEvent } from '../../features/apqr/apqrAudit'
import { useApqrLoad } from '../../features/apqr/useApqrData'

const AUDIT_PAGE_PROPS = {
  icon: 'history',
  headerClassName: 'apqr-page-header--audit',
  title: 'Audit Trail',
  description: 'Plain-English history of APQR changes.',
} as const

export function ApqrAuditPage() {
  const audit = useApqrLoad(() => listApqrAuditEvents())
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return audit.data ?? []
    return (audit.data ?? []).filter(
      (row) =>
        row.description.toLowerCase().includes(q) ||
        row.performed_by_name.toLowerCase().includes(q) ||
        (row.entity_label ?? '').toLowerCase().includes(q) ||
        (row.field_name ?? '').toLowerCase().includes(q) ||
        (row.old_value ?? '').toLowerCase().includes(q) ||
        (row.new_value ?? '').toLowerCase().includes(q),
    )
  }, [audit.data, search])

  const totalEvents = audit.data?.length ?? 0
  const hasActiveSearch = search.trim().length > 0

  if (audit.loading) {
    return (
      <ApqrPage {...AUDIT_PAGE_PROPS}>
        <ApqrLoading />
      </ApqrPage>
    )
  }

  return (
    <ApqrPage {...AUDIT_PAGE_PROPS}>
      {audit.error ? <ApqrError message={audit.error} /> : null}

      <section className="panel apqr-audit-panel" aria-labelledby="apqr-audit-list-title">
        <div className="panel-heading apqr-audit-heading">
          <div className="apqr-audit-heading-title">
            <h2 id="apqr-audit-list-title">
              <ApqrIcon name="clock" />
              Activity Log
            </h2>
            <span className="apqr-audit-count" aria-label={`${filtered.length} events`}>
              {filtered.length}
            </span>
          </div>
          <label className="apqr-search-field apqr-audit-search">
            <ApqrIcon name="search" />
            <input
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
            <caption className="sr-only">APQR audit activity log</caption>
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
                  <td className="apqr-audit-timestamp">{formatAuditTimestamp(row.performed_at)}</td>
                  <td className="apqr-audit-user">{row.performed_by_name}</td>
                  <td className="apqr-audit-description">{row.description}</td>
                  <td className="apqr-audit-field">
                    <AuditFieldBadge row={row} />
                  </td>
                  <td className="apqr-audit-value apqr-audit-value--old">
                    <AuditValue value={row.old_value} />
                  </td>
                  <td className="apqr-audit-value apqr-audit-value--new">
                    <AuditValue value={row.new_value} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <AuditEmptyState hasEvents={totalEvents > 0} hasActiveSearch={hasActiveSearch} />
          ) : null}
        </div>
      </section>
    </ApqrPage>
  )
}

function AuditFieldBadge({ row }: { row: ApqrAuditEvent }) {
  if (!row.field_name) return <>—</>
  return <span className="apqr-audit-field-pill">{row.field_name}</span>
}

function AuditValue({ value }: { value: string | null }) {
  if (!value) return <span className="apqr-audit-value-empty">—</span>
  return <span className="apqr-audit-value-text">{value}</span>
}

function AuditEmptyState({
  hasEvents,
  hasActiveSearch,
}: {
  hasEvents: boolean
  hasActiveSearch: boolean
}) {
  if (!hasEvents) {
    return (
      <div className="apqr-audit-empty" role="status">
        <span className="apqr-audit-empty-icon" aria-hidden>
          <ApqrIcon name="history" width={28} height={28} />
        </span>
        <p className="apqr-audit-empty-title">No audit events yet</p>
        <p className="apqr-audit-empty-hint">Changes to clients, scheduler rows, and APQR records will appear here.</p>
      </div>
    )
  }

  if (hasActiveSearch) {
    return (
      <div className="apqr-audit-empty" role="status">
        <span className="apqr-audit-empty-icon" aria-hidden>
          <ApqrIcon name="search" width={28} height={28} />
        </span>
        <p className="apqr-audit-empty-title">No matching events</p>
        <p className="apqr-audit-empty-hint">Try a different search term or clear the search field.</p>
      </div>
    )
  }

  return (
    <div className="apqr-audit-empty" role="status">
      <p className="apqr-audit-empty-title">No events to show</p>
    </div>
  )
}
