import { afterEach, describe, expect, it } from 'vitest'

import {
  mergeAccountManagerSuggestions,
  readAccountManagerSuggestions,
  rememberAccountManager,
} from './accountManagerSuggestions'

const STORAGE_KEY = 'apqr-account-manager-suggestions'

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY)
})

describe('accountManagerSuggestions', () => {
  it('remembers and merges unique account managers with recent-first ordering', () => {
    rememberAccountManager('MCValdecanas')
    rememberAccountManager('FSdelCastillo')

    expect(readAccountManagerSuggestions()).toEqual(['FSdelCastillo', 'MCValdecanas'])
    expect(mergeAccountManagerSuggestions(['MCValdecanas', 'HBPabale'])).toEqual([
      'FSdelCastillo',
      'MCValdecanas',
      'HBPabale',
    ])
  })
})
