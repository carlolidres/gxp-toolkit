import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, Input, Select } from 'antd'
import { Download, FilePlus } from 'lucide-react'

import {
  EdocEmpty,
  EdocError,
  EdocLoading,
  EdocPage,
  EdocPriorityBadge,
  EdocStatusBadge,
  formatEdocDate,
  getEdocPriorityLabel,
  getEdocStatusLabel,
} from '../../components/edoc/EdocComponents'
import { EdocProfileCompletionGate } from '../../components/edoc/EdocProfileCompletionGate'
import { DataTable } from '../../components/data-display/DataTable'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { useEdocDocuments } from '../../features/edoc/useEdocData'
import type { EdocDocumentListItem, EdocDocumentStatus } from '../../features/edoc/types'

type DocumentStatusFilter =
  | 'all'
  | 'drafts'
  | 'draft'
  | 'preparing'
  | 'in_routing'
  | 'awaiting_action'
  | 'returned'
  | 'rejected'
  | 'completed'

type DocumentDueFilter = 'all' | 'overdue' | 'soon'

const DUE_SOON_MS = 7 * 86400000

const STATUS_FILTER_OPTIONS: Array<{ value: DocumentStatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'drafts', label: 'Drafts' },
  { value: 'in_routing', label: 'In routing' },
  { value: 'awaiting_action', label: 'Awaiting action' },
  { value: 'returned', label: 'Returned' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
]

function menuIdForScope(scope: 'my' | 'all' | 'returned' | 'completed'): string {
  if (scope === 'my') return 'edoc-my-documents'
  if (scope === 'returned') return 'edoc-returned'
  if (scope === 'completed') return 'edoc-completed'
  return 'edoc-all-documents'
}

function ownershipScope(scope: 'my' | 'all' | 'returned' | 'completed'): 'my' | 'all' {
  return scope === 'my' ? 'my' : 'all'
}

function parseStatusParam(value: string | null, fallback: DocumentStatusFilter): DocumentStatusFilter {
  if (!value) return fallback
  if (
    STATUS_FILTER_OPTIONS.some((option) => option.value === value) ||
    value === 'draft' ||
    value === 'preparing'
  ) {
    return value as DocumentStatusFilter
  }
  return fallback
}

function parseDueParam(value: string | null): DocumentDueFilter {
  if (value === 'overdue' || value === 'soon') return value
  return 'all'
}

function initialStatusFilter(scope: 'my' | 'all' | 'returned' | 'completed'): DocumentStatusFilter {
  if (scope === 'returned') return 'returned'
  if (scope === 'completed') return 'completed'
  return 'all'
}

function matchesStatusFilter(document: EdocDocumentListItem, statusFilter: DocumentStatusFilter): boolean {
  if (statusFilter === 'all') return true
  if (statusFilter === 'drafts') return document.status === 'draft' || document.status === 'preparing'
  if (statusFilter === 'in_routing') {
    return document.status === 'in_routing' || document.status === 'awaiting_action'
  }
  return document.status === (statusFilter as EdocDocumentStatus)
}

function matchesDueFilter(document: EdocDocumentListItem, dueFilter: DocumentDueFilter, now = Date.now()): boolean {
  if (dueFilter === 'all') return true
  if (!document.dueAt) return false
  const time = new Date(document.dueAt).getTime()
  if (Number.isNaN(time)) return false
  if (dueFilter === 'overdue') return time < now
  return time >= now && time <= now + DUE_SOON_MS
}

export function EdocDocumentsPage({
  scope = 'all',
  title = 'All Documents',
}: {
  scope?: 'my' | 'all' | 'returned' | 'completed'
  title?: string
}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { canExport } = useMenuPermission(menuIdForScope(scope))
  const { data, loading, error } = useEdocDocuments(ownershipScope(scope))
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DocumentStatusFilter>(() =>
    parseStatusParam(searchParams.get('status'), initialStatusFilter(scope)),
  )
  const [dueFilter, setDueFilter] = useState<DocumentDueFilter>(() => parseDueParam(searchParams.get('due')))

  useEffect(() => {
    setStatusFilter(parseStatusParam(searchParams.get('status'), initialStatusFilter(scope)))
    setDueFilter(parseDueParam(searchParams.get('due')))
  }, [searchParams, scope])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (data ?? []).filter((document) => {
      if (!matchesStatusFilter(document, statusFilter)) return false
      if (!matchesDueFilter(document, dueFilter)) return false
      if (!query) return true
      return [
        document.documentNumber,
        document.title,
        document.status,
        getEdocStatusLabel(document.status),
        document.ownerName,
        document.department,
        document.priority,
        getEdocPriorityLabel(document.priority),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [data, search, statusFilter, dueFilter])

  return (
    <EdocProfileCompletionGate mode="banner">
    <EdocPage
      title={title}
      description="Authorized eDoc records with version, status, owner, department, and due-date context."
      action={
        <Link to="/edoc/create">
          <Button type="primary" icon={<FilePlus size={15} />}>
            Create Document
          </Button>
        </Link>
      }
    >
      {error ? <EdocError message={error} /> : null}
      <Card className="panel">
        <div className="vrms-toolbar">
          <div>
            <label htmlFor="edoc-documents-search">Search</label>
            <Input
              id="edoc-documents-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Number, title, owner, status..."
            />
          </div>
          <div>
            <label htmlFor="edoc-documents-status">Status</label>
            <Select
              id="edoc-documents-status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              options={STATUS_FILTER_OPTIONS}
              style={{ minWidth: 160 }}
            />
          </div>
          <div>
            <label htmlFor="edoc-documents-due">Due</label>
            <Select
              id="edoc-documents-due"
              value={dueFilter}
              onChange={(value) => setDueFilter(value)}
              options={[
                { value: 'all', label: 'Any due date' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'soon', label: 'Due soon (7d)' },
              ]}
              style={{ minWidth: 160 }}
            />
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
            onRowClick={(row) => navigate(`/edoc/view/${row.id}`)}
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
    </EdocProfileCompletionGate>
  )
}

function exportCsv(rows: EdocDocumentListItem[]) {
  const headers = ['Document No.', 'Title', 'Status', 'Version', 'Priority', 'Owner', 'Department', 'Due']
  const body = rows.map((row) =>
    [
      row.documentNumber,
      row.title,
      getEdocStatusLabel(row.status),
      `v${row.versionNumber}`,
      getEdocPriorityLabel(row.priority),
      row.ownerName,
      row.department,
      row.dueAt ?? '',
    ]
      .map(escapeCsv)
      .join(','),
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
