import { describe, expect, it } from 'vitest'

import {
  clampFieldToPage,
  fieldsOverlap,
  normalizeRotation,
  parseAssigneeIdFromDraftId,
  redoHistory,
  resolveSoftOverlap,
  undoHistory,
} from './fieldPlacementGeometry'
import type { EdocFieldDraft } from './types'

function field(partial: Partial<EdocFieldDraft> & Pick<EdocFieldDraft, 'id'>): EdocFieldDraft {
  return {
    assigneeDraftId: 'level:user',
    fieldType: 'signature',
    pageNumber: 1,
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.08,
    rotation: 0,
    required: true,
    ...partial,
  }
}

describe('eDoc field placement geometry', () => {
  it('clamps fields inside the page', () => {
    expect(clampFieldToPage({ x: 0.95, y: 0.95, width: 0.2, height: 0.1 })).toEqual({
      x: 0.8,
      y: 0.9,
      width: 0.2,
      height: 0.1,
    })
  })

  it('detects and soft-resolves overlap on the same page', () => {
    const a = field({ id: 'a', x: 0.1, y: 0.1 })
    const b = field({ id: 'b', x: 0.12, y: 0.12 })
    expect(fieldsOverlap(a, b)).toBe(true)
    const nudged = resolveSoftOverlap(b, [a])
    expect(fieldsOverlap(a, nudged)).toBe(false)
  })

  it('normalizes rotation and parses assignee ids', () => {
    expect(normalizeRotation(-90)).toBe(270)
    expect(parseAssigneeIdFromDraftId('level-1:profile-9')).toBe('profile-9')
  })

  it('supports undo and redo stacks', () => {
    const undone = undoHistory([1, 2], 3, [])
    expect(undone).toEqual({ past: [1], present: 2, future: [3] })
    const redone = redoHistory(undone!.past, undone!.present, undone!.future)
    expect(redone).toEqual({ past: [1, 2], present: 3, future: [] })
  })
})
