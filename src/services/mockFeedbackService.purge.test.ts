import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockFeedbackService } from './mockFeedbackService'
import type { AuthUser } from '../types/auth'

const admin: AuthUser = {
  id: 'auth-admin',
  profileId: 'u-1',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'Admin',
  initials: 'AU',
}

describe('mockFeedbackService acknowledge purge', () => {
  beforeEach(() => {
    mockFeedbackService.resetStore()
    vi.useRealTimers()
  })

  it('deletes acknowledged (read) messages after 24 hours', async () => {
    const now = new Date('2026-07-09T12:00:00.000Z')
    vi.setSystemTime(now)

    await mockFeedbackService.acknowledgeUnread(admin)
    let messages = await mockFeedbackService.listMessages(admin, true)
    expect(messages.some((m) => m.status === 'read')).toBe(true)

    vi.setSystemTime(new Date(now.getTime() + 24 * 60 * 60 * 1000 + 1))
    messages = await mockFeedbackService.listMessages(admin, true)
    expect(messages.some((m) => m.status === 'read')).toBe(false)
  })
})
