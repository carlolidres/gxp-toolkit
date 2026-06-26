import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => false,
  getSupabaseClient: () => null,
}))

import { MOCK_DEFAULT_RESET_PASSWORD } from '../config/authPasswordPolicy'
import { authService } from './authService'

describe('requestPasswordReset mock mode', () => {
  it('returns the temporary default password and flags mandatory change', async () => {
    const email = 'reset-user@example.com'
    const result = await authService.requestPasswordReset(email)
    expect(result.temporaryPassword).toBe(MOCK_DEFAULT_RESET_PASSWORD)
    await expect(authService.checkTemporaryPasswordRequired(email)).resolves.toBe(true)
  })
})
