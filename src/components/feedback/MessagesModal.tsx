import { useEffect, useMemo, useState } from 'react'
import { Button, Drawer, Tooltip } from 'antd'
import {
  Bug,
  Check,
  Clock3,
  Copy,
  Inbox,
  Lightbulb,
  Loader2,
  MessageSquarePlus,
  Tag,
  UserRound,
  X,
} from 'lucide-react'

import { FormField, SelectInput, Textarea } from '../forms/FormControls'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from './ToastProvider'
import { feedbackService } from '../../services/feedbackService'
import type { FeedbackCategory, FeedbackMessage } from '../../types/feedback'
import { CATEGORY_LABELS, STATUS_LABELS, formatMessageClipboardText, formatTimestamp } from './messageFormat'
import './messages-modal.css'

function useMessagesDrawerWidth() {
  const [width, setWidth] = useState('min(520px, 100vw)')

  useEffect(() => {
    function updateWidth() {
      const viewport = window.innerWidth
      if (viewport <= 720) {
        setWidth('100vw')
        return
      }
      if (viewport <= 1100) {
        setWidth('min(70vw, 640px)')
        return
      }
      setWidth('min(40vw, 560px)')
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  return width
}

function CategoryIcon({ category }: { category: FeedbackCategory }) {
  const className = 'size-3.5 shrink-0 text-[var(--muted)]'
  return category === 'bug' ? <Bug className={className} aria-hidden /> : <Lightbulb className={className} aria-hidden />
}

export function MessagesModal({
  isOpen,
  onClose,
  messages,
  loading,
  isAdmin,
  onRefresh,
  onAcknowledgeUnread,
}: {
  isOpen: boolean
  onClose: () => void
  messages: FeedbackMessage[]
  loading: boolean
  isAdmin: boolean
  onRefresh: () => Promise<void>
  onAcknowledgeUnread: () => Promise<void>
}) {
  const { user } = useAuth()
  const { notify } = useToast()
  const drawerWidth = useMessagesDrawerWidth()
  const [category, setCategory] = useState<FeedbackCategory>('improvement')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const canSend = Boolean(content.trim()) && !submitting

  useEffect(() => {
    if (!isOpen || !isAdmin) return
    void onAcknowledgeUnread()
  }, [isAdmin, isOpen, onAcknowledgeUnread])

  function clearCompose() {
    setCategory('improvement')
    setContent('')
  }

  async function handleSubmit() {
    if (!user || !canSend) return
    setSubmitting(true)
    try {
      await feedbackService.submitMessage(user, { category, content })
      clearCompose()
      notify('Message sent to the administrator.', 'success')
      await onRefresh()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not send message.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatus(messageId: string, status: 'addressed' | 'rejected') {
    if (!user) return
    setUpdatingId(messageId)
    try {
      await feedbackService.updateStatus(user, messageId, { status })
      notify(`Message marked ${status}.`, 'success')
      await onRefresh()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update message status.', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleCopy(message: FeedbackMessage) {
    try {
      await navigator.clipboard.writeText(formatMessageClipboardText(message))
      notify('Message copied to clipboard.', 'success')
    } catch {
      notify('Could not copy message to clipboard.', 'error')
    }
  }

  const title = useMemo(() => (isAdmin ? 'Messages' : 'Message administrator'), [isAdmin])

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      title={title}
      width={drawerWidth}
      className="messages-drawer"
      destroyOnHidden
      maskClosable={false}
      keyboard
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        header: { flexShrink: 0 },
      }}
      footer={null}
    >
      <div className="messages-modal-panel flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5 sm:p-6">
        <section
          aria-labelledby="messages-compose-title"
          className="messages-compose rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:p-5"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[var(--teal-soft)] text-[var(--teal)]">
              <MessageSquarePlus className="size-4" aria-hidden />
            </span>
            <div>
              <h3 id="messages-compose-title" className="text-[0.9375rem] font-semibold text-[var(--app-text)]">
                {isAdmin ? 'New message' : 'Send feedback'}
              </h3>
              <p className="text-[0.8125rem] text-[var(--muted)]">
                Share improvements or report issues to the administrator.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <FormField label="Purpose">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                  <CategoryIcon category={category} />
                </span>
                <SelectInput
                  className="!pl-9"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
                >
                  <option value="improvement">{CATEGORY_LABELS.improvement}</option>
                  <option value="bug">{CATEGORY_LABELS.bug}</option>
                </SelectInput>
              </div>
            </FormField>
            <FormField label="Message">
              <Textarea
                value={content}
                rows={6}
                placeholder="Describe your suggestion or the bug you encountered."
                onChange={(event) => setContent(event.target.value)}
              />
            </FormField>
            <div className="messages-compose-actions">
              <Button onClick={clearCompose} disabled={submitting || (!content && category === 'improvement')}>
                Clear
              </Button>
              <Button type="primary" disabled={!canSend} loading={submitting} onClick={() => void handleSubmit()}>
                {submitting ? 'Sending…' : 'Send message'}
              </Button>
            </div>
          </div>
        </section>

        {isAdmin ? (
          <section aria-labelledby="messages-inbox-title" className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[var(--surface-subtle)] text-[var(--blue)]">
                  <Inbox className="size-4" aria-hidden />
                </span>
                <h3 id="messages-inbox-title" className="text-[0.9375rem] font-semibold text-[var(--app-text)]">
                  Inbox
                </h3>
              </div>
              {!loading && messages.length > 0 ? (
                <span className="rounded-full bg-[var(--badge-neutral-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--muted)]">
                  {messages.length} {messages.length === 1 ? 'message' : 'messages'}
                </span>
              ) : null}
            </div>

            {loading ? (
              <p className="flex items-center gap-2 text-sm text-[var(--muted)]" role="status">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading messages…
              </p>
            ) : null}
            {!loading && messages.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                No messages yet.
              </p>
            ) : null}

            <ul className="m-0 grid list-none gap-3 p-0">
              {messages.map((message) => (
                <li
                  key={message.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] transition-[box-shadow,border-color] hover:border-[color-mix(in_srgb,var(--teal)_25%,var(--border))] hover:shadow-md"
                >
                  <MessageMeta message={message} onCopy={() => void handleCopy(message)} />
                  <p className="mt-3 mb-0 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-[var(--app-text)]">
                    {message.content}
                  </p>
                  {(message.status === 'unread' || message.status === 'read') && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="button small inline-flex items-center gap-1.5"
                        disabled={updatingId === message.id}
                        onClick={() => void handleStatus(message.id, 'addressed')}
                      >
                        {updatingId === message.id ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Check className="size-3.5" aria-hidden />
                        )}
                        Addressed
                      </button>
                      <button
                        type="button"
                        className="button small secondary inline-flex items-center gap-1.5"
                        disabled={updatingId === message.id}
                        onClick={() => void handleStatus(message.id, 'rejected')}
                      >
                        <X className="size-3.5" aria-hidden />
                        Rejected
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : messages.length > 0 ? (
          <section aria-labelledby="messages-history-title" className="min-w-0">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[var(--surface-subtle)] text-[var(--blue)]">
                <Inbox className="size-4" aria-hidden />
              </span>
              <h3 id="messages-history-title" className="text-[0.9375rem] font-semibold text-[var(--app-text)]">
                Your previous messages
              </h3>
            </div>
            <ul className="m-0 grid list-none gap-3 p-0">
              {messages.map((message) => (
                <li
                  key={message.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]"
                >
                  <MessageMeta message={message} onCopy={() => void handleCopy(message)} />
                  <p className="mt-3 mb-0 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-[var(--app-text)]">
                    {message.content}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Drawer>
  )
}

function MessageMeta({
  message,
  onCopy,
}: {
  message: FeedbackMessage
  onCopy: () => void
}) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <UserRound className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
          <strong className="truncate text-[0.9375rem] font-semibold text-[var(--app-text)]">
            {message.senderName}
          </strong>
        </div>
        <div className="flex items-center gap-2">
          <span className={`messages-status-badge messages-status-badge--${message.status}`}>
            {STATUS_LABELS[message.status]}
          </span>
          <Tooltip title="Copy message">
            <Button
              type="text"
              size="small"
              className="messages-copy-btn"
              aria-label="Copy message"
              icon={<Copy className="size-3.5" aria-hidden />}
              onClick={(event) => {
                event.stopPropagation()
                event.preventDefault()
                onCopy()
              }}
            />
          </Tooltip>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[0.8125rem] text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <Tag className="size-3.5 shrink-0" aria-hidden />
          {CATEGORY_LABELS[message.category]}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5 shrink-0" aria-hidden />
          <time dateTime={message.submittedAt}>{formatTimestamp(message.submittedAt)}</time>
        </span>
      </div>
      {message.statusUpdatedAt ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[0.8125rem] text-[var(--muted)]">
          <span>Updated by {message.statusUpdatedByName ?? 'Administrator'}</span>
          <time dateTime={message.statusUpdatedAt}>{formatTimestamp(message.statusUpdatedAt)}</time>
        </div>
      ) : null}
    </div>
  )
}
