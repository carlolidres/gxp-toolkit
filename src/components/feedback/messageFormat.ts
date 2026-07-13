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

export function formatTimestamp(value: string | undefined) {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function formatMessageClipboardText(message: FeedbackMessage): string {
  const lines = [
    `Sender: ${message.senderName}`,
    `Status: ${STATUS_LABELS[message.status]}`,
    `Purpose: ${CATEGORY_LABELS[message.category]}`,
    `Date/time: ${formatTimestamp(message.submittedAt)}`,
    '',
    'Message:',
    message.content,
  ]

  if (message.statusUpdatedAt) {
    lines.push(
      '',
      `Updated by: ${message.statusUpdatedByName ?? 'Administrator'}`,
      `Updated at: ${formatTimestamp(message.statusUpdatedAt)}`,
    )
  }

  return lines.join('\n')
}

export { CATEGORY_LABELS, STATUS_LABELS }
