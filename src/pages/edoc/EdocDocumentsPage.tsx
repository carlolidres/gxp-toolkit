import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { App, Button, Card, Input, Modal, Select, Space } from 'antd'
import {
  CalendarClock,
  Download,
  FilePlus,
  Files,
  Filter,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react'

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
import { useAuth } from '../../hooks/useAuth'
import { useMenuPermission } from '../../hooks/useMenuPermission'
import { edocService } from '../../features/edoc/edocService'
import { useEdocDocuments } from '../../features/edoc/useEdocData'
import type { EdocDocumentListItem, EdocDocumentStatus } from '../../features/edoc/types'
import { iconSize, iconStroke } from '../../theme/iconSizes'

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
  const { message } = App.useApp()
  const [searchParams] = useSearchParams()
  const { hasRole } = useAuth()
  const { canExport, canDelete } = useMenuPermission(menuIdForScope(scope))
  const { data, loading, error, refresh } = useEdocDocuments(ownershipScope(scope))
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DocumentStatusFilter>(() =>
    parseStatusParam(searchParams.get('status'), initialStatusFilter(scope)),
  )
  const [dueFilter, setDueFilter] = useState<DocumentDueFilter>(() => parseDueParam(searchParams.get('due')))
  const [pendingDelete, setPendingDelete] = useState<EdocDocumentListItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const allowAdminDelete = scope === 'all' && hasRole(['Admin']) && canDelete

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

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const result = await edocService.adminDeleteDocument(pendingDelete.id)
      message.success(result.message ?? 'Document permanently deleted.')
      setPendingDelete(null)
      await refresh()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not delete the document.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <EdocProfileCompletionGate mode="banner">
    <EdocPage
      icon={Files}
      title={title}
      description="Authorized eDoc records with version, status, owner, department, and due-date context."
      action={
        <Link to="/edoc/create">
          <Button type="primary" icon={<FilePlus size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}>
            Create Document
          </Button>
        </Link>
      }
    >
      {error ? <EdocError message={error} /> : null}
      <Card className="panel edoc-list-panel" bordered={false}>
        <header className="edoc-list-panel-header">
          <div>
            <p className="edoc-list-kicker">Registry</p>
            <h2 className="edoc-list-title">Document library</h2>
          </div>
          <span className="edoc-list-count" aria-live="polite">
            {loading ? '…' : `${filtered.length} shown`}
          </span>
        </header>

        <div className="edoc-toolbar" role="search">
          <label className="edoc-toolbar-field edoc-toolbar-field--grow" htmlFor="edoc-documents-search">
            <span className="edoc-toolbar-label">
              <Search size={14} strokeWidth={iconStroke} aria-hidden />
              Search
            </span>
            <Input
              id="edoc-documents-search"
              allowClear
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Number, title, owner, status…"
              prefix={<Search size={14} strokeWidth={iconStroke} aria-hidden />}
            />
          </label>
          <label className="edoc-toolbar-field" htmlFor="edoc-documents-status">
            <span className="edoc-toolbar-label">
              <Filter size={14} strokeWidth={iconStroke} aria-hidden />
              Status
            </span>
            <Select
              id="edoc-documents-status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              options={STATUS_FILTER_OPTIONS}
              className="edoc-toolbar-select"
            />
          </label>
          <label className="edoc-toolbar-field" htmlFor="edoc-documents-due">
            <span className="edoc-toolbar-label">
              <CalendarClock size={14} strokeWidth={iconStroke} aria-hidden />
              Due
            </span>
            <Select
              id="edoc-documents-due"
              value={dueFilter}
              onChange={(value) => setDueFilter(value)}
              options={[
                { value: 'all', label: 'Any due date' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'soon', label: 'Due soon (7d)' },
              ]}
              className="edoc-toolbar-select"
            />
          </label>
          {canExport ? (
            <div className="edoc-toolbar-actions">
              <Button
                icon={<Download size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                onClick={() => exportCsv(filtered)}
              >
                Export CSV
              </Button>
            </div>
          ) : null}
        </div>

        {loading ? <EdocLoading /> : null}
        {!loading && filtered.length === 0 ? (
          <EdocEmpty
            title="No documents found"
            description="Adjust filters or create a document to populate this view."
            action={
              <Link to="/edoc/create">
                <Button type="primary" icon={<FilePlus size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}>
                  Create Document
                </Button>
              </Link>
            }
          />
        ) : null}
        {!loading && filtered.length > 0 ? (
          <DataTable
            rows={filtered}
            onRowClick={(row) => navigate(`/edoc/view/${row.id}`)}
            columns={[
              {
                key: 'documentNumber',
                label: 'Document',
                render: (row) => (
                  <div className="edoc-doc-cell">
                    <strong className="edoc-doc-cell-number">{row.documentNumber}</strong>
                    <span className="edoc-doc-cell-title">{row.title}</span>
                  </div>
                ),
              },
              { key: 'status', label: 'Status', render: (row) => <EdocStatusBadge status={row.status} /> },
              {
                key: 'versionNumber',
                label: 'Version',
                render: (row) => <span className="edoc-version-chip">v{row.versionNumber}</span>,
              },
              { key: 'priority', label: 'Priority', render: (row) => <EdocPriorityBadge priority={row.priority} /> },
              {
                key: 'ownerName',
                label: 'Owner',
                render: (row) => (
                  <span className="edoc-cell-meta">
                    <UserRound size={14} strokeWidth={iconStroke} aria-hidden />
                    {row.ownerName}
                  </span>
                ),
              },
              {
                key: 'department',
                label: 'Department',
                render: (row) => row.department?.trim() || '—',
              },
              {
                key: 'dueAt',
                label: 'Due',
                render: (row) => (
                  <span className="edoc-cell-meta">
                    <CalendarClock size={14} strokeWidth={iconStroke} aria-hidden />
                    {formatEdocDate(row.dueAt)}
                  </span>
                ),
              },
              ...(allowAdminDelete
                ? [
                    {
                      key: 'actions',
                      label: 'Actions',
                      render: (row: EdocDocumentListItem) => (
                        <Button
                          danger
                          size="small"
                          icon={<Trash2 size={14} aria-hidden />}
                          aria-label={`Delete ${row.documentNumber}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            setPendingDelete(row)
                          }}
                        >
                          Delete
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        ) : null}
      </Card>

      <Modal
        open={Boolean(pendingDelete)}
        title="Permanently delete document?"
        onCancel={() => (deleting ? undefined : setPendingDelete(null))}
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button danger type="primary" loading={deleting} onClick={() => void confirmDelete()}>
              Delete permanently
            </Button>
          </Space>
        }
      >
        <p>
          This permanently removes <strong>{pendingDelete?.documentNumber}</strong>
          {pendingDelete?.title ? (
            <>
              {' '}
              (<strong>{pendingDelete.title}</strong>)
            </>
          ) : null}{' '}
          including PDF files, routing, signatures, and audit history for this document. This cannot be undone.
        </p>
      </Modal>
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
