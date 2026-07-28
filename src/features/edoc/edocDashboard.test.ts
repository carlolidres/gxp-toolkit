import { describe, expect, it } from 'vitest'

import {
  buildNeedsMyActionQueue,
  filterInboxTasksByAction,
  inboxTaskDueLabel,
  inboxTaskUrgencyRank,
  sortInboxTasksByUrgency,
} from './edocDashboard'
import type { EdocInboxTask } from './types'

function task(partial: Partial<EdocInboxTask>): EdocInboxTask {
  return {
    id: 't1',
    documentId: 'd1',
    routeId: 'r1',
    stepId: 's1',
    versionId: 'v1',
    documentTitle: 'Doc',
    documentNumber: 'EDOC-1',
    action: 'review',
    status: 'active',
    dueAt: null,
    ownerName: 'Owner',
    versionSha256: null,
    ...partial,
  }
}

describe('edocDashboard', () => {
  const now = new Date('2026-07-28T12:00:00Z').getTime()

  it('ranks overdue ahead of due soon and undated', () => {
    expect(inboxTaskUrgencyRank(task({ dueAt: '2026-07-20T00:00:00Z' }), now)).toBe(0)
    expect(inboxTaskUrgencyRank(task({ dueAt: '2026-07-30T00:00:00Z' }), now)).toBe(1)
    expect(inboxTaskUrgencyRank(task({ dueAt: null }), now)).toBe(2)
  })

  it('sorts inbox tasks by urgency then due date', () => {
    const sorted = sortInboxTasksByUrgency(
      [
        task({ id: 'later', dueAt: '2026-08-20T00:00:00Z', documentTitle: 'Later' }),
        task({ id: 'overdue', dueAt: '2026-07-10T00:00:00Z', documentTitle: 'Overdue' }),
        task({ id: 'soon', dueAt: '2026-07-31T00:00:00Z', documentTitle: 'Soon' }),
      ],
      now,
    )
    expect(sorted.map((item) => item.id)).toEqual(['overdue', 'soon', 'later'])
  })

  it('filters by assignable action and builds a limited queue', () => {
    const tasks = [
      task({ id: 'r1', action: 'review', dueAt: '2026-07-10T00:00:00Z' }),
      task({ id: 'a1', action: 'approve', dueAt: '2026-07-11T00:00:00Z' }),
      task({ id: 'r2', action: 'review', dueAt: '2026-07-12T00:00:00Z' }),
      task({ id: 'done', action: 'review', status: 'completed', dueAt: '2026-07-01T00:00:00Z' }),
    ]
    expect(filterInboxTasksByAction(tasks, 'approve').map((item) => item.id)).toEqual(['a1'])
    const queue = buildNeedsMyActionQueue(tasks, 'review', 10, now)
    expect(queue.map((item) => item.id)).toEqual(['r1', 'r2'])
    expect(inboxTaskDueLabel(task({ dueAt: '2026-07-20T00:00:00Z' }), now)).toMatch(/Overdue/)
  })
})
