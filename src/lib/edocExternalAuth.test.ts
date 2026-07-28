import { describe, expect, it } from 'vitest'

import {
  needsExternalAuth,
  organizationKey,
} from './edocExternalAuth'

describe('edocExternalAuth', () => {
  it('normalizes organization keys', () => {
    expect(organizationKey('  Acme Corp ')).toBe('acme corp')
    expect(organizationKey(null)).toBe('')
  })

  it('detects external recipients by profile organization', () => {
    expect(needsExternalAuth('Acme', ['Acme', 'acme'])).toBe(false)
    expect(needsExternalAuth('Acme', ['Acme', 'Beta'])).toBe(true)
    expect(needsExternalAuth('Acme', ['Acme', null])).toBe(true)
    expect(needsExternalAuth('', ['Beta'])).toBe(false)
  })
})
