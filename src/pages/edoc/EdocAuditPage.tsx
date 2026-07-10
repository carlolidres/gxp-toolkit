import { EdocError, EdocLoading, EdocPage, formatEdocDate } from '../../components/edoc/EdocComponents'
import { Card } from 'antd'
import { DataTable } from '../../components/data-display/DataTable'
import { useEdocAudit } from '../../features/edoc/useEdocData'

export function EdocAuditPage() {
  const { data, loading, error } = useEdocAudit()

  return (
    <EdocPage title="Audit Trail" description="Append-only eDoc audit events for authorized review.">
      {error ? <EdocError message={error} /> : null}
      <Card className="panel">
        {loading ? <EdocLoading label="Loading audit trail..." /> : null}
        <DataTable
          rows={data ?? []}
          columns={[
            { key: 'eventType', label: 'Event' },
            { key: 'entityType', label: 'Entity' },
            { key: 'userName', label: 'Actor' },
            { key: 'reason', label: 'Reason', render: (row) => row.reason ?? '' },
            { key: 'createdAt', label: 'Timestamp', render: (row) => formatEdocDate(row.createdAt) },
          ]}
        />
      </Card>
    </EdocPage>
  )
}

