import type { EdocAssignableAction, EdocInboxTask } from './types'

const DUE_SOON_MS = 7 * 86400000

export type EdocActionFilter = 'all' | EdocAssignableAction

export const EDOC_ACTION_FILTER_LABELS: Record<EdocActionFilter, string> = {
  all: 'All actions',
  review: 'Review',
  approve: 'Approve',
  sign: 'Sign',
  acknowledge: 'Acknowledge',
}

export function inboxTaskUrgencyRank(task: Pick<EdocInboxTask, 'dueAt'>, now = Date.now()): number {
  if (!task.dueAt) return 2
  const due = new Date(task.dueAt).getTime()
  if (Number.isNaN(due)) return 2
  if (due < now) return 0
  if (due <= now + DUE_SOON_MS) return 1
  return 2
}

export function inboxTaskDueTone(
  task: Pick<EdocInboxTask, 'dueAt'>,
  now = Date.now(),
): 'danger' | 'warning' | 'neutral' {
  const rank = inboxTaskUrgencyRank(task, now)
  if (rank === 0) return 'danger'
  if (rank === 1) return 'warning'
  return 'neutral'
}

export function inboxTaskDueLabel(
  task: Pick<EdocInboxTask, 'dueAt'>,
  now = Date.now(),
): string {
  if (!task.dueAt) return 'No due date'
  const due = new Date(task.dueAt).getTime()
  if (Number.isNaN(due)) return 'No due date'
  const dayMs = 86400000
  const deltaDays = Math.ceil((due - now) / dayMs)
  if (deltaDays < 0) return `Overdue ${Math.abs(deltaDays)}d`
  if (deltaDays === 0) return 'Due today'
  if (deltaDays === 1) return 'Due tomorrow'
  if (deltaDays <= 7) return `Due in ${deltaDays}d`
  return `Due in ${deltaDays}d`
}

/** Lower urgency rank first, then earlier due date, then title. */
export function sortInboxTasksByUrgency(
  tasks: EdocInboxTask[],
  now = Date.now(),
): EdocInboxTask[] {
  return [...tasks].sort((a, b) => {
    const rankDiff = inboxTaskUrgencyRank(a, now) - inboxTaskUrgencyRank(b, now)
    if (rankDiff !== 0) return rankDiff
    const dueA = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY
    const dueB = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY
    if (dueA !== dueB) return dueA - dueB
    return a.documentTitle.localeCompare(b.documentTitle)
  })
}

export function filterInboxTasksByAction(
  tasks: EdocInboxTask[],
  action: EdocActionFilter,
): EdocInboxTask[] {
  if (action === 'all') return tasks
  return tasks.filter((task) => task.action === action)
}

export function buildNeedsMyActionQueue(
  tasks: EdocInboxTask[],
  action: EdocActionFilter = 'all',
  limit = 10,
  now = Date.now(),
): EdocInboxTask[] {
  const active = tasks.filter((task) => task.status === 'active')
  return sortInboxTasksByUrgency(filterInboxTasksByAction(active, action), now).slice(0, limit)
}
