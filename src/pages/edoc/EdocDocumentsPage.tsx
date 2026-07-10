import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Input } from 'antd'
import { Download, FilePlus } from 'lucide-react'

import {
  EdocEmpty,
  EdocError,
  EdocLoading,
  EdocPage,
  EdocPriorityBadge,
  EdocStatusBadge,
  formatEdocDate,
} from '../../components/edoc/EdocComponents'
import { DataTable } from '../../components/data-display/DataTable'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { useEdocDocuments } from '../../features/edoc/useEdocData'
import type { EdocDocumentListItem } from '../../features/edoc/types'

export function EdocDocumentsPage({
  scope = 'all',
  title = 'All Documents',
}: {
  scope?: 'my' | 'all' | 'returned' | 'completed'
  title?: string
}) {
  const { canExport } = useMenuPermission(scope === 'my' ? 'edoc-my-documents' : 'edoc-all-documents')
  const { data, loading, error } = useEdocDocuments(scope)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return data ?? []
    return (data ?? []).filter((document) =>
      [
        document.documentNumber,
        document.title,
        document.status,
        document.ownerName,
        document.department,
        document.priority,
      ].join(' ').toLowerCase().includes(query),
    )
  }, [data, search])

  return (
    <EdocPage
      title={title}
      description="Authorized eDoc records with version, status, owner, department, and due-date context."
      action={<Link to="/edoc/create"><Button type="primary" icon={<FilePlus size={15} />}>Create Document</Button></Link>}
    >
      {error ? <EdocError message={error} /> : null}
      <Card className="panel">
        <div className="vrms-toolbar">
          <div>
            <label>Search</label>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Number, title, owner, status..." />
          </div>
          {canExport ? (
            <Button icon={<Download size={15} />} onClick={() => exportCsv(filtered)}>
              Export CSV
            </Button>
          ) : null}
        </div>
        {loading ? <EdocLoading /> : null}
        {!loading && filtered.length === 0 ? (
          <EdocEmpty title="No documents found" description="Create or route a document to populate this view." />
        ) : (
          <DataTable
            rows={filtered}
            columns={[
              { key: 'documentNumber', label: 'Document No.' },
              { key: 'title', label: 'Title' },
              { key: 'status', label: 'Status', render: (row) => <EdocStatusBadge status={row.status} /> },
              { key: 'versionNumber', label: 'Version', render: (row) => `v${row.versionNumber}` },
              { key: 'priority', label: 'Priority', render: (row) => <EdocPriorityBadge priority={row.priority} /> },
              { key: 'ownerName', label: 'Owner' },
              { key: 'department', label: 'Department' },
              { key: 'dueAt', label: 'Due', render: (row) => formatEdocDate(row.dueAt) },
            ]}
          />
        )}
      </Card>
    </EdocPage>
  )
}

function exportCsv(rows: EdocDocumentListItem[]) {
  const headers = ['Document No.', 'Title', 'Status', 'Version', 'Priority', 'Owner', 'Department', 'Due']
  const body = rows.map((row) =>
    [
      row.documentNumber,
      row.title,
      row.status,
      `v${row.versionNumber}`,
      row.priority,
      row.ownerName,
      row.department,
      row.dueAt ?? '',
    ].map(escapeCsv).join(','),
  )
  const blob = new Blob([[headers.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `edoc-documents-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function escapeCsv(value: string): string {
  return value.includes(',') || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value
}

