import { describe, expect, it } from 'vitest'

import { denormalizePdfRect, fieldTypesForAction, normalizePdfRect } from './fieldRules'

describe('eDoc field rules', () => {
  it('maps route actions to allowed field types', () => {
    expect(fieldTypesForAction('sign')).toContain('signature')
    expect(fieldTypesForAction('approve')).toContain('approval_meaning')
    expect(fieldTypesForAction('review')).toContain('review_meaning')
    expect(fieldTypesForAction('acknowledge')).toContain('acknowledgment')
  })

  it('converts PDF field coordinates to normalized values and back', () => {
    const normalized = normalizePdfRect({
      x: 72,
      y: 144,
      width: 144,
      height: 72,
      pageWidth: 612,
      pageHeight: 792,
    })
    expect(normalized.x).toBeCloseTo(0.1176, 3)
    expect(normalized.y).toBeCloseTo(0.1818, 3)

    const denormalized = denormalizePdfRect({ ...normalized, pageWidth: 612, pageHeight: 792 })
    expect(denormalized.x).toBeCloseTo(72)
    expect(denormalized.height).toBeCloseTo(72)
  })
})

