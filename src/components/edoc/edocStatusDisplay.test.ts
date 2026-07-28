import { describe, expect, it } from 'vitest'

import { getEdocPriorityLabel, getEdocStatusLabel } from './EdocComponents'

describe('eDoc status display labels', () => {
  it('keeps full status and priority names for search, export, and filters', () => {
    expect(getEdocStatusLabel('awaiting_action')).toBe('Awaiting Action')
    expect(getEdocStatusLabel('completed')).toBe('Completed')
    expect(getEdocPriorityLabel('normal')).toBe('Normal')
    expect(getEdocPriorityLabel('urgent')).toBe('Urgent')
  })
})
