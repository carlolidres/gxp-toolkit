import { describe, expect, it } from 'vitest'

import {
  getEdocAccessProfileCompleteness,
  hasAnyEdocMenuAccess,
  isEdocProfileIncomplete,
} from './edocAccessProfileCompleteness'

describe('edocAccessProfileCompleteness', () => {
  it('requires organization and signature', () => {
    expect(getEdocAccessProfileCompleteness({ organization: null, signatureDataUrl: null }).complete).toBe(false)
    expect(
      getEdocAccessProfileCompleteness({
        organization: 'Acme',
        signatureDataUrl: 'data:image/png;base64,abc',
      }).complete,
    ).toBe(true)
  })

  it('marks incomplete only when eDoc access is granted', () => {
    const user = { organization: null, signatureDataUrl: null }
    expect(isEdocProfileIncomplete({}, user)).toBe(false)
    expect(isEdocProfileIncomplete({ 'edoc-dashboard': { view: true } }, user)).toBe(true)
    expect(hasAnyEdocMenuAccess({ 'edoc-create': { view: true } })).toBe(true)
  })
})
