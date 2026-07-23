import { describe, expect, it } from 'vitest'

import {
  canAddSignatoryLevel,
  compileSignatoryLevelsToRouteSteps,
  createSignatoryLevel,
  nextSignatoryLevelKind,
  uniqueIds,
  validateSignatoryRouting,
} from './signatoryLevels'

describe('eDoc signatory levels', () => {
  it('deduplicates assignee ids within a level', () => {
    expect(uniqueIds(['a', 'a', 'b', '', 'b'])).toEqual(['a', 'b'])
  })

  it('adds levels in Prepared → Reviewed → Approved order up to three', () => {
    const prepared = [createSignatoryLevel('prepared_by', ['u1'])]
    expect(nextSignatoryLevelKind(prepared)).toBe('reviewed_by')
    const withReview = [...prepared, createSignatoryLevel('reviewed_by', ['u2'])]
    expect(nextSignatoryLevelKind(withReview)).toBe('approved_by')
    const full = [...withReview, createSignatoryLevel('approved_by', ['u3'])]
    expect(nextSignatoryLevelKind(full)).toBeNull()
    expect(canAddSignatoryLevel(full)).toBe(false)
  })

  it('requires assignees on every visible level unless no-signatories is selected', () => {
    expect(
      validateSignatoryRouting({
        noSignatories: true,
        levels: [],
      }).ok,
    ).toBe(true)

    const incomplete = validateSignatoryRouting({
      noSignatories: false,
      levels: [createSignatoryLevel('prepared_by', [])],
    })
    expect(incomplete.ok).toBe(false)
    expect(incomplete.levelErrors.prepared_by).toMatch(/at least one assignee/i)
  })

  it('compiles sequential mode to one step per assignee', () => {
    const compiled = compileSignatoryLevelsToRouteSteps({
      mode: 'sequential',
      noSignatories: false,
      levels: [
        createSignatoryLevel('prepared_by', ['p1', 'p2']),
        createSignatoryLevel('reviewed_by', ['r1']),
      ],
    })
    expect(compiled.mode).toBe('sequential')
    expect(compiled.steps).toHaveLength(3)
    expect(compiled.steps.map((step) => step.assigneeIds)).toEqual([['p1'], ['p2'], ['r1']])
    expect(compiled.steps.map((step) => step.action)).toEqual(['sign', 'sign', 'review'])
  })

  it('compiles parallel mode to one sequential step per level', () => {
    const compiled = compileSignatoryLevelsToRouteSteps({
      mode: 'parallel',
      noSignatories: false,
      levels: [
        createSignatoryLevel('prepared_by', ['p1', 'p2']),
        createSignatoryLevel('approved_by', ['a1']),
      ],
    })
    expect(compiled.mode).toBe('sequential')
    expect(compiled.steps).toHaveLength(2)
    expect(compiled.steps[0]?.assigneeIds).toEqual(['p1', 'p2'])
    expect(compiled.steps[1]?.action).toBe('approve')
  })

  it('compiles mixed mode to parallel backend activation', () => {
    const compiled = compileSignatoryLevelsToRouteSteps({
      mode: 'mixed',
      noSignatories: false,
      levels: [
        createSignatoryLevel('prepared_by', ['p1']),
        createSignatoryLevel('reviewed_by', ['r1']),
      ],
    })
    expect(compiled.mode).toBe('parallel')
    expect(compiled.steps).toHaveLength(2)
  })

  it('compiles no-signatories to an empty route', () => {
    expect(
      compileSignatoryLevelsToRouteSteps({
        mode: 'sequential',
        noSignatories: true,
        levels: [createSignatoryLevel('prepared_by', ['p1'])],
      }),
    ).toEqual({ mode: 'sequential', steps: [] })
  })
})
