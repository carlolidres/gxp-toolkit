import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => false,
  getSupabaseClient: () => null,
}))

import { MOCK_PASSWORD_RESET_REQUEST_KEY } from '../config/authPasswordPolicy'
import { authService, getMockPasswordResetRequestedAt } from './authService'

describe('requestPasswordReset mock mode', () => {
  beforeEach(() => {
    localStorage.removeItem(MOCK_PASSWORD_RESET_REQUEST_KEY)
  })

  it('records a pending admin request without returning a temporary password', async () => {
    const email = 'admin@example.com'
    const result = await authService.requestPasswordReset(email)
    expect(result.success).toBe(true)
    expect(result.message.toLowerCase()).toContain('administrator')
    expect(getMockPasswordResetRequestedAt(email)).toBeTruthy()
    await expect(authService.checkTemporaryPasswordRequired(email)).resolves.toBe(false)
  })
})
