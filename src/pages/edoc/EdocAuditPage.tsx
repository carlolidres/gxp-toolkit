import { useMemo } from 'react'
import { Card } from 'antd'
import { ClipboardList, ScrollText, UserRound } from 'lucide-react'

import {
  EdocEmpty,
  EdocError,
  EdocLoading,
  EdocPage,
  formatEdocDate,
  formatEdocEventType,
} from '../../components/edoc/EdocComponents'
import { DataTable } from '../../components/data-display/DataTable'
import { useEdocAudit } from '../../features/edoc/useEdocData'
import { iconStroke } from '../../theme/iconSizes'

export function EdocAuditPage() {
  const { data, loading, error } = useEdocAudit()
  const rows = data ?? []
  const countLabel = useMemo(() => {
    if (loading) return '…'
    return `${rows.length} event${rows.length === 1 ? '' : 's'}`
  }, [loading, rows.length])

  return (
    <EdocPage
      icon={ScrollText}
      title="Audit Trail"
      description="Append-only eDoc audit events for authorized review and investigation."
    >
      {error ? <EdocError message={error} /> : null}

      <Card className="panel edoc-list-panel" bordered={false}>
        <header className="edoc-list-panel-header">
          <div>
            <p className="edoc-list-kicker">Compliance</p>
            <h2 className="edoc-list-title">System events</h2>
          </div>
          <span className="edoc-list-count" aria-live="polite">
            {countLabel}
          </span>
        </header>

        {loading ? <EdocLoading label="Loading audit trail…" /> : null}

        {!loading && rows.length === 0 ? (
          <EdocEmpty
            title="No audit events yet"
            description="Lifecycle events appear here as documents are created, routed, signed, and completed."
          />
        ) : null}

        {!loading && rows.length > 0 ? (
          <DataTable
            rows={rows}
            columns={[
              {
                key: 'eventType',
                label: 'Event',
                render: (row) => (
                  <span className="edoc-audit-event">
                    <ClipboardList size={14} strokeWidth={iconStroke} aria-hidden />
                    {formatEdocEventType(row.eventType)}
                  </span>
                ),
              },
              {
                key: 'entityType',
                label: 'Entity',
                render: (row) => (
                  <span className="edoc-entity-chip">{row.entityType}</span>
                ),
              },
              {
                key: 'userName',
                label: 'Actor',
                render: (row) => (
                  <span className="edoc-cell-meta">
                    <UserRound size={14} strokeWidth={iconStroke} aria-hidden />
                    {row.userName}
                  </span>
                ),
              },
              {
                key: 'reason',
                label: 'Reason',
                render: (row) => (
                  <span className="edoc-audit-reason">{row.reason?.trim() || '—'}</span>
                ),
              },
              {
                key: 'createdAt',
                label: 'Timestamp',
                render: (row) => (
                  <time className="edoc-audit-time" dateTime={row.createdAt}>
                    {formatEdocDate(row.createdAt)}
                  </time>
                ),
              },
            ]}
          />
        ) : null}
      </Card>
    </EdocPage>
  )
}
