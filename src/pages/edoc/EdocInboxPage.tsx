import { Link } from 'react-router-dom'

import {
  EdocEmpty,
  EdocError,
  EdocLoading,
  EdocPage,
  formatEdocDate,
} from '../../components/edoc/EdocComponents'
import { DataTable } from '../../components/data-display/DataTable'
import { useEdocInbox } from '../../features/edoc/useEdocData'

export function EdocInboxPage() {
  const { data, loading, error } = useEdocInbox()

  return (
    <EdocPage title="My Inbox" description="Review, approval, signature, acknowledgment, and delegated tasks assigned to you.">
      {error ? <EdocError message={error} /> : null}
      <section className="panel">
        {loading ? <EdocLoading /> : null}
        {!loading && (data ?? []).length === 0 ? (
          <EdocEmpty title="No active assignments" description="New eDoc tasks will appear here when route steps activate." />
        ) : (
          <DataTable
            rows={data ?? []}
            columns={[
              { key: 'documentNumber', label: 'Document No.' },
              { key: 'documentTitle', label: 'Title' },
              { key: 'action', label: 'Action' },
              { key: 'status', label: 'Status' },
              { key: 'ownerName', label: 'Owner' },
              { key: 'dueAt', label: 'Due', render: (row) => formatEdocDate(row.dueAt) },
              {
                key: 'open',
                label: '',
                render: (row) => <Link className="button small" to={`/edoc/workspace/${row.id}`}>Open</Link>,
              },
            ]}
          />
        )}
      </section>
    </EdocPage>
  )
}

