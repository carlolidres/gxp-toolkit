import { describe, expect, it } from 'vitest'

import { splitAuthAlertMessage } from './auth-form-shared'

describe('splitAuthAlertMessage', () => {
  it('splits a long credential error into title and detail', () => {
    const message =
      'Email or password is incorrect. Use Forgot password to request a reset, or sign in with Google or Microsoft if you registered that way.'
    expect(splitAuthAlertMessage(message)).toEqual({
      title: 'Email or password is incorrect.',
      detail:
        'Use Forgot password to request a reset, or sign in with Google or Microsoft if you registered that way.',
    })
  })

  it('keeps short messages as a single title', () => {
    expect(splitAuthAlertMessage('Sign in failed.')).toEqual({
      title: 'Sign in failed.',
    })
  })
})
