import type {
  EdocAssigneeStatus,
  EdocCompletionRule,
  EdocRoutingMode,
  EdocStepStatus,
} from './types'

export interface EdocRouteStepState {
  id: string
  sequence: number
  groupId: string
  status: EdocStepStatus
  completionRule: EdocCompletionRule
  minimumCount: number | null
  assignees: Array<{ id: string; status: EdocAssigneeStatus }>
}

export const terminalDocumentStatuses = [
  'rejected',
  'completed',
  'cancelled',
  'expired',
  'archived',
] as const

export function getRequiredCompletionCount(
  rule: EdocCompletionRule,
  assigneeCount: number,
  minimumCount?: number | null,
): number {
  if (assigneeCount <= 0) return 0
  if (rule === 'any') return 1
  if (rule === 'majority') return Math.floor(assigneeCount / 2) + 1
  if (rule === 'minimum_count') return Math.min(assigneeCount, Math.max(1, minimumCount ?? 1))
  return assigneeCount
}

export function countEligibleAssignees(
  assignees: Array<{ status: EdocAssigneeStatus }>,
): number {
  return assignees.filter(
    (assignee) => assignee.status !== 'invalidated' && assignee.status !== 'delegated',
  ).length
}

export function countCompletedAssignees(
  assignees: Array<{ status: EdocAssigneeStatus }>,
): number {
  return assignees.filter((assignee) => assignee.status === 'completed').length
}

export function isStepCompleteByRule(step: Pick<EdocRouteStepState, 'completionRule' | 'minimumCount' | 'assignees'>): boolean {
  const eligible = countEligibleAssignees(step.assignees)
  const required = getRequiredCompletionCount(step.completionRule, eligible, step.minimumCount)
  return required > 0 && countCompletedAssignees(step.assignees) >= required
}

export function getNextActiveStepIds(
  mode: EdocRoutingMode,
  steps: EdocRouteStepState[],
): string[] {
  const pending = [...steps]
    .filter((step) => step.status === 'pending')
    .sort((a, b) => a.sequence - b.sequence)

  if (mode === 'parallel') return pending.map((step) => step.id)
  if (mode === 'sequential') return pending.slice(0, 1).map((step) => step.id)

  const firstSequence = pending[0]?.sequence
  if (firstSequence === undefined) return []
  return pending.filter((step) => step.sequence === firstSequence).map((step) => step.id)
}

export function isRouteComplete(steps: Array<{ status: EdocStepStatus }>): boolean {
  return steps.length > 0 && steps.every((step) => step.status === 'completed' || step.status === 'skipped')
}

