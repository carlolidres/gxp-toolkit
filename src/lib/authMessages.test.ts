import { describe, expect, it } from 'vitest'

import { getAuthErrorMessage, normalizeAuthMessage } from './authMessages'

describe('authMessages', () => {
  it('explains Supabase 401 deployment configuration failures', () => {
    expect(normalizeAuthMessage('Unauthorized')).toContain('Supabase rejected the public anon key')
    expect(getAuthErrorMessage({ status: 401, message: 'Unauthorized' }, 'fallback')).toContain(
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY',
    )
  })
})
