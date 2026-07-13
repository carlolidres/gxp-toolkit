import { describe, expect, it } from 'vitest'

import { formatMessageClipboardText } from './messageFormat'
import type { FeedbackMessage } from '../../types/feedback'

const sample: FeedbackMessage = {
  id: 'msg-1',
  senderId: 'u-1',
  senderName: 'Ada Admin',
  senderEmail: 'ada@example.com',
  category: 'bug',
  content: 'Line one\nLine two',
  status: 'read',
  submittedAt: '2026-07-10T08:30:00.000Z',
  statusUpdatedByName: 'Owner',
  statusUpdatedAt: '2026-07-11T09:00:00.000Z',
}

describe('formatMessageClipboardText', () => {
  it('formats readable multiline clipboard content', () => {
    const text = formatMessageClipboardText(sample)
    expect(text).toContain('Sender: Ada Admin')
    expect(text).toContain('Status: Open')
    expect(text).toContain('Purpose: Report a bug')
    expect(text).toContain('Message:')
    expect(text).toContain('Line one\nLine two')
    expect(text).toContain('Updated by: Owner')
  })
})
