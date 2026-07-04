import { describe, expect, it } from 'vitest'

import {
  getNextActiveStepIds,
  getRequiredCompletionCount,
  isRouteComplete,
  isStepCompleteByRule,
  type EdocRouteStepState,
} from './routingRules'

describe('eDoc routing rules', () => {
  it('calculates parallel completion thresholds', () => {
    expect(getRequiredCompletionCount('all', 4)).toBe(4)
    expect(getRequiredCompletionCount('any', 4)).toBe(1)
    expect(getRequiredCompletionCount('majority', 4)).toBe(3)
    expect(getRequiredCompletionCount('minimum_count', 4, 2)).toBe(2)
    expect(getRequiredCompletionCount('minimum_count', 2, 8)).toBe(2)
  })

  it('activates one pending step for sequential routes', () => {
    expect(getNextActiveStepIds('sequential', steps())).toEqual(['step-1'])
  })

  it('activates all pending steps for parallel routes', () => {
    expect(getNextActiveStepIds('parallel', steps())).toEqual(['step-1', 'step-2', 'step-3'])
  })

  it('activates the next pending group for mixed routes', () => {
    const mixed = steps()
    mixed[0].groupId = 'group-a'
    mixed[1].groupId = 'group-a'
    mixed[1].sequence = 1
    expect(getNextActiveStepIds('mixed', mixed)).toEqual(['step-1', 'step-2'])
  })

  it('detects completion by rule and route completion', () => {
    expect(
      isStepCompleteByRule({
        completionRule: 'majority',
        minimumCount: null,
        assignees: [
          { id: 'a', status: 'completed' },
          { id: 'b', status: 'completed' },
          { id: 'c', status: 'active' },
        ],
      }),
    ).toBe(true)
    expect(isRouteComplete([{ status: 'completed' }, { status: 'skipped' }])).toBe(true)
    expect(isRouteComplete([{ status: 'completed' }, { status: 'active' }])).toBe(false)
  })
})

function steps(): EdocRouteStepState[] {
  return [
    baseStep('step-1', 1),
    baseStep('step-2', 2),
    baseStep('step-3', 3),
  ]
}

function baseStep(id: string, sequence: number): EdocRouteStepState {
  return {
    id,
    sequence,
    groupId: `group-${sequence}`,
    status: 'pending',
    completionRule: 'all',
    minimumCount: null,
    assignees: [{ id: `${id}-assignee`, status: 'pending' }],
  }
}

