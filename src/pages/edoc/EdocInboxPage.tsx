import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card } from 'antd'
import { CalendarClock, ChevronRight, FileText, Inbox, UserRound } from 'lucide-react'

import {
  EdocActionBadge,
  EdocEmpty,
  EdocError,
  EdocLoading,
  EdocPage,
  formatEdocDate,
} from '../../components/edoc/EdocComponents'
import { EdocProfileCompletionGate } from '../../components/edoc/EdocProfileCompletionGate'
import { DataTable } from '../../components/data-display/DataTable'
import {
  inboxTaskDueLabel,
  inboxTaskDueTone,
} from '../../features/edoc/edocDashboard'
import { useEdocInbox } from '../../features/edoc/useEdocData'
import { usePermissions } from '../../hooks/usePermissions'
import { iconSize, iconStroke } from '../../theme/iconSizes'
import type { EdocInboxTask } from '../../features/edoc/types'

export function EdocInboxPage() {
  const navigate = useNavigate()
  const { canViewMenu } = usePermissions()
  const { data, loading, error } = useEdocInbox()
  const tasks = data ?? []
  const activeCount = useMemo(
    () => tasks.filter((task) => task.status === 'active').length,
    [tasks],
  )

  return (
    <EdocProfileCompletionGate mode="banner">
      <EdocPage
        icon={Inbox}
        title="My Inbox"
        description="Review, approval, signature, and acknowledgment tasks assigned to you."
        action={
          canViewMenu('edoc-create') ? (
            <Link to="/edoc/create">
              <Button type="primary" icon={<FileText size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}>
                Create Document
              </Button>
            </Link>
          ) : null
        }
      >
        {error ? <EdocError message={error} /> : null}

        <Card className="panel edoc-list-panel" bordered={false}>
          <header className="edoc-list-panel-header">
            <div>
              <p className="edoc-list-kicker">Assignments</p>
              <h2 className="edoc-list-title">Needs your action</h2>
            </div>
            <span className="edoc-list-count" aria-live="polite">
              {loading ? '…' : `${activeCount} active`}
            </span>
          </header>

          {loading ? <EdocLoading label="Loading inbox…" /> : null}

          {!loading && tasks.length === 0 ? (
            <EdocEmpty
              title="No active assignments"
              description="New eDoc tasks appear here when a route step becomes active for you."
              action={
                canViewMenu('edoc-create') ? (
                  <Link to="/edoc/create">
                    <Button type="primary">Create Document</Button>
                  </Link>
                ) : null
              }
            />
          ) : null}

          {!loading && tasks.length > 0 ? (
            <DataTable
              rows={tasks}
              onRowClick={(row) => navigate(`/edoc/workspace/${row.id}`)}
              columns={[
                {
                  key: 'documentNumber',
                  label: 'Document',
                  render: (row) => <InboxDocumentCell task={row} />,
                },
                {
                  key: 'action',
                  label: 'Action',
                  render: (row) => <EdocActionBadge action={row.action} />,
                },
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
                  key: 'dueAt',
                  label: 'Due',
                  render: (row) => <InboxDueCell task={row} />,
                },
                {
                  key: 'open',
                  label: '',
                  render: () => (
                    <span className="edoc-row-open" aria-hidden>
                      Open
                      <ChevronRight size={14} strokeWidth={iconStroke} />
                    </span>
                  ),
                },
              ]}
            />
          ) : null}
        </Card>
      </EdocPage>
    </EdocProfileCompletionGate>
  )
}

function InboxDocumentCell({ task }: { task: EdocInboxTask }) {
  return (
    <div className="edoc-doc-cell">
      <strong className="edoc-doc-cell-number">{task.documentNumber}</strong>
      <span className="edoc-doc-cell-title">{task.documentTitle}</span>
    </div>
  )
}

function InboxDueCell({ task }: { task: EdocInboxTask }) {
  const tone = inboxTaskDueTone(task)
  return (
    <span className={`edoc-due-chip tone-${tone}`}>
      <CalendarClock size={14} strokeWidth={iconStroke} aria-hidden />
      <span>{inboxTaskDueLabel(task)}</span>
      <span className="visually-hidden">{formatEdocDate(task.dueAt)}</span>
    </span>
  )
}
