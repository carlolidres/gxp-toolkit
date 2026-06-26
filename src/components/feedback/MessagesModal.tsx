import { useEffect, useState } from 'react'

import { Modal } from './Modal'
import { FormField, SelectInput, Textarea } from '../forms/FormControls'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from './ToastProvider'
import { feedbackService } from '../../services/feedbackService'
import type { FeedbackCategory, FeedbackMessage } from '../../types/feedback'

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  improvement: 'Suggest an improvement',
  bug: 'Report a bug',
}

const STATUS_LABELS: Record<FeedbackMessage['status'], string> = {
  unread: 'Unread',
  read: 'Open',
  addressed: 'Addressed',
  rejected: 'Rejected',
}

function formatTimestamp(value: string | undefined) {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
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
  const [category, setCategory] = useState<FeedbackCategory>('improvement')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !isAdmin) return
    void onAcknowledgeUnread()
  }, [isAdmin, isOpen, onAcknowledgeUnread])

  async function handleSubmit() {
    if (!user) return
    setSubmitting(true)
    try {
      await feedbackService.submitMessage(user, { category, content })
      setContent('')
      notify('Message sent to the administrator.')
      await onRefresh()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not send message.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatus(messageId: string, status: 'addressed' | 'rejected') {
    if (!user) return
    setUpdatingId(messageId)
    try {
      await feedbackService.updateStatus(user, messageId, { status })
      notify(`Message marked ${status}.`)
      await onRefresh()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update message status.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title={isAdmin ? 'Messages' : 'Message administrator'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="button" disabled={submitting || !content.trim()} onClick={() => void handleSubmit()}>
            {submitting ? 'Sending…' : 'Send message'}
          </button>
        </>
      }
    >
      <div className="messages-compose">
        <FormField label="Purpose">
          <SelectInput value={category} onChange={(event) => setCategory(event.target.value as FeedbackCategory)}>
            <option value="improvement">{CATEGORY_LABELS.improvement}</option>
            <option value="bug">{CATEGORY_LABELS.bug}</option>
          </SelectInput>
        </FormField>
        <FormField label="Message">
          <Textarea
            value={content}
            rows={5}
            placeholder="Describe your suggestion or the bug you encountered."
            onChange={(event) => setContent(event.target.value)}
          />
        </FormField>
      </div>

      {isAdmin ? (
        <div className="messages-inbox">
          <h3>Inbox</h3>
          {loading ? <p className="messages-empty">Loading messages…</p> : null}
          {!loading && messages.length === 0 ? <p className="messages-empty">No messages yet.</p> : null}
          <ul className="messages-list">
            {messages.map((message) => (
              <li key={message.id} className="messages-item">
                <MessageMeta message={message} />
                <p className="messages-content">{message.content}</p>
                {(message.status === 'unread' || message.status === 'read') && (
                  <div className="messages-actions">
                    <button
                      type="button"
                      className="button small"
                      disabled={updatingId === message.id}
                      onClick={() => void handleStatus(message.id, 'addressed')}
                    >
                      Addressed
                    </button>
                    <button
                      type="button"
                      className="button small secondary"
                      disabled={updatingId === message.id}
                      onClick={() => void handleStatus(message.id, 'rejected')}
                    >
                      Rejected
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : messages.length > 0 ? (
        <section className="messages-history">
          <h3>Your previous messages</h3>
          <ul className="messages-list">
            {messages.map((message) => (
              <li key={message.id} className="messages-item">
                <MessageMeta message={message} />
                <p className="messages-content">{message.content}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Modal>
  )
}

function MessageMeta({ message }: { message: FeedbackMessage }) {
  return (
    <div className="messages-meta">
      <div className="messages-meta-row">
        <strong>{message.senderName}</strong>
        <span className={`messages-status messages-status-${message.status}`}>{STATUS_LABELS[message.status]}</span>
      </div>
      <div className="messages-meta-row messages-meta-muted">
        <span>{CATEGORY_LABELS[message.category]}</span>
        <span>{formatTimestamp(message.submittedAt)}</span>
      </div>
      {message.statusUpdatedAt ? (
        <div className="messages-meta-row messages-meta-muted">
          <span>
            Updated by {message.statusUpdatedByName ?? 'Administrator'}
          </span>
          <span>{formatTimestamp(message.statusUpdatedAt)}</span>
        </div>
      ) : null}
    </div>
  )
}
