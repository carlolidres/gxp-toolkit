import type { AuthUser } from '../types/auth'
import type {
  FeedbackMessage,
  SubmitFeedbackInput,
  UpdateFeedbackStatusInput,
} from '../types/feedback'

const STORAGE_KEY = 'gxp-toolkit-feedback-messages'

function delay(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readStore(): FeedbackMessage[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? (JSON.parse(raw) as FeedbackMessage[]) : seedMessages()
}

function writeStore(messages: FeedbackMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
}

function seedMessages(): FeedbackMessage[] {
  const seeded: FeedbackMessage[] = [
    {
      id: 'fb-seed-1',
      senderId: 'u-3',
      senderName: 'Editor User',
      senderEmail: 'editor@example.com',
      category: 'bug',
      content: 'Dashboard chart legend overlaps on narrow screens.',
      status: 'unread',
      submittedAt: new Date(Date.now() - 3_600_000).toISOString(),
    },
  ]
  writeStore(seeded)
  return seeded
}

function purgeExpired(messages: FeedbackMessage[]): FeedbackMessage[] {
  const now = Date.now()
  const readCutoff = now - 24 * 60 * 60 * 1000
  const closedCutoff = now - 3 * 24 * 60 * 60 * 1000
  return messages.filter((message) => {
    if (!message.statusUpdatedAt) return true
    const updatedAt = new Date(message.statusUpdatedAt).getTime()
    if (message.status === 'read') return updatedAt >= readCutoff
    if (message.status === 'addressed' || message.status === 'rejected') {
      return updatedAt >= closedCutoff
    }
    return true
  })
}

function requireProfileId(user: AuthUser): string {
  const profileId = user.profileId ?? user.id
  if (!profileId) throw new Error('Profile is required to send feedback.')
  return profileId
}

export const mockFeedbackService = {
  async listMessages(user: AuthUser, isAdmin: boolean): Promise<FeedbackMessage[]> {
    await delay()
    const purged = purgeExpired(readStore())
    if (purged.length !== readStore().length) writeStore(purged)
    if (isAdmin) return purged.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    const profileId = requireProfileId(user)
    return purged
      .filter((message) => message.senderId === profileId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  },

  async submitMessage(user: AuthUser, input: SubmitFeedbackInput): Promise<FeedbackMessage> {
    await delay()
    const content = input.content.trim()
    if (!content) throw new Error('Message content is required.')

    const message: FeedbackMessage = {
      id: `fb-${Date.now()}`,
      senderId: requireProfileId(user),
      senderName: user.name,
      senderEmail: user.email,
      category: input.category,
      content,
      status: 'unread',
      submittedAt: new Date().toISOString(),
    }

    const next = [message, ...readStore()]
    writeStore(next)
    return message
  },

  async acknowledgeUnread(user: AuthUser): Promise<void> {
    await delay()
    const profileId = requireProfileId(user)
    const now = new Date().toISOString()
    const next = readStore().map((message) =>
      message.status === 'unread'
        ? {
            ...message,
            status: 'read' as const,
            statusUpdatedById: profileId,
            statusUpdatedByName: user.name,
            statusUpdatedAt: now,
          }
        : message,
    )
    writeStore(next)
  },

  async updateStatus(
    user: AuthUser,
    messageId: string,
    input: UpdateFeedbackStatusInput,
  ): Promise<FeedbackMessage> {
    await delay()
    const profileId = requireProfileId(user)
    const now = new Date().toISOString()
    let updated: FeedbackMessage | null = null

    const next = readStore().map((message) => {
      if (message.id !== messageId) return message
      updated = {
        ...message,
        status: input.status,
        statusUpdatedById: profileId,
        statusUpdatedByName: user.name,
        statusUpdatedAt: now,
      }
      return updated
    })

    if (!updated) throw new Error('Message not found.')
    writeStore(next)
    return updated
  },

  resetStore() {
    localStorage.removeItem(STORAGE_KEY)
  },
}
