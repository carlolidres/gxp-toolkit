import type { EdocAssignableAction, EdocRouteStepDraft, EdocRoutingMode } from './types'

export type EdocSignatoryLevelKind = 'prepared_by' | 'reviewed_by' | 'approved_by'

export interface EdocSignatoryProfile {
  id: string
  displayName: string
  email: string
}

export interface EdocSignatoryLevelDraft {
  id: string
  kind: EdocSignatoryLevelKind
  assigneeIds: string[]
}

export const SIGNATORY_LEVEL_ORDER: readonly EdocSignatoryLevelKind[] = [
  'prepared_by',
  'reviewed_by',
  'approved_by',
] as const

export const SIGNATORY_LEVEL_LABELS: Record<EdocSignatoryLevelKind, string> = {
  prepared_by: 'Prepared by',
  reviewed_by: 'Reviewed by',
  approved_by: 'Approved by',
}

export const SIGNATORY_LEVEL_ACTIONS: Record<EdocSignatoryLevelKind, EdocAssignableAction> = {
  prepared_by: 'sign',
  reviewed_by: 'review',
  approved_by: 'approve',
}

export const ROUTING_MODE_HELP: Record<EdocRoutingMode, string> = {
  sequential:
    'Sent one signatory at a time in Prepared → Reviewed → Approved order (and listed order within each level). The next person receives it only after the current signatory completes.',
  parallel:
    'Signatories at the same level may act at the same time. The next level starts only after everyone on the current level has completed.',
  mixed:
    'All designated signatories may act at any time, regardless of level or sequence.',
}

export const ROUTING_MODE_INBOX_SUMMARY: Record<EdocRoutingMode, string> = {
  sequential:
    'Sequential: the document is sent to signatories one at a time. It appears in the next signatory’s inbox only after the current signatory completes.',
  parallel:
    'Parallel: signatories on the same level may sign simultaneously. The document advances to the next level only after all current-level signatories complete.',
  mixed:
    'Mixed: all designated signatories may sign at any time. Each assigned user sees the document in their inbox immediately.',
}

export function createSignatoryLevel(
  kind: EdocSignatoryLevelKind,
  assigneeIds: string[] = [],
): EdocSignatoryLevelDraft {
  return {
    id: crypto.randomUUID(),
    kind,
    assigneeIds: uniqueIds(assigneeIds),
  }
}

export function defaultSignatoryLevels(currentUserProfileId: string | null): EdocSignatoryLevelDraft[] {
  return [createSignatoryLevel('prepared_by', currentUserProfileId ? [currentUserProfileId] : [])]
}

export function nextSignatoryLevelKind(
  levels: readonly EdocSignatoryLevelDraft[],
): EdocSignatoryLevelKind | null {
  const present = new Set(levels.map((level) => level.kind))
  return SIGNATORY_LEVEL_ORDER.find((kind) => !present.has(kind)) ?? null
}

export function canAddSignatoryLevel(levels: readonly EdocSignatoryLevelDraft[]): boolean {
  return levels.length < SIGNATORY_LEVEL_ORDER.length && nextSignatoryLevelKind(levels) !== null
}

export function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of ids) {
    const trimmed = id.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

export function addAssigneeToLevel(
  level: EdocSignatoryLevelDraft,
  assigneeId: string,
): EdocSignatoryLevelDraft {
  return { ...level, assigneeIds: uniqueIds([...level.assigneeIds, assigneeId]) }
}

export function removeAssigneeFromLevel(
  level: EdocSignatoryLevelDraft,
  assigneeId: string,
  options?: { protectIds?: readonly string[] },
): EdocSignatoryLevelDraft {
  if (options?.protectIds?.includes(assigneeId)) return level
  return { ...level, assigneeIds: level.assigneeIds.filter((id) => id !== assigneeId) }
}

export interface SignatoryRoutingValidation {
  ok: boolean
  message: string | null
  levelErrors: Partial<Record<EdocSignatoryLevelKind, string>>
}

export function validateSignatoryRouting(input: {
  noSignatories: boolean
  levels: readonly EdocSignatoryLevelDraft[]
}): SignatoryRoutingValidation {
  if (input.noSignatories) {
    return { ok: true, message: null, levelErrors: {} }
  }

  if (input.levels.length === 0) {
    return {
      ok: false,
      message: 'Add at least one signatory level, or choose “No signatories required”.',
      levelErrors: {},
    }
  }

  const levelErrors: Partial<Record<EdocSignatoryLevelKind, string>> = {}
  for (const level of input.levels) {
    if (level.assigneeIds.length === 0) {
      levelErrors[level.kind] = `${SIGNATORY_LEVEL_LABELS[level.kind]} needs at least one assignee.`
      continue
    }
    if (uniqueIds(level.assigneeIds).length !== level.assigneeIds.length) {
      levelErrors[level.kind] = `${SIGNATORY_LEVEL_LABELS[level.kind]} has duplicate assignees.`
    }
  }

  if (Object.keys(levelErrors).length > 0) {
    return {
      ok: false,
      message: 'Complete every signatory level before continuing.',
      levelErrors,
    }
  }

  return { ok: true, message: null, levelErrors: {} }
}

/**
 * Compiles UI levels into backend route steps while preserving engine semantics:
 * - sequential → one step per assignee, mode sequential
 * - parallel → one step per level (intra-level concurrent), mode sequential
 * - mixed → one step per level, mode parallel (everyone active at once)
 */
export function compileSignatoryLevelsToRouteSteps(input: {
  mode: EdocRoutingMode
  levels: readonly EdocSignatoryLevelDraft[]
  noSignatories: boolean
}): { mode: EdocRoutingMode; steps: EdocRouteStepDraft[] } {
  if (input.noSignatories || input.levels.length === 0) {
    return { mode: 'sequential', steps: [] }
  }

  const ordered = [...input.levels].sort(
    (a, b) => SIGNATORY_LEVEL_ORDER.indexOf(a.kind) - SIGNATORY_LEVEL_ORDER.indexOf(b.kind),
  )

  if (input.mode === 'sequential') {
    const steps: EdocRouteStepDraft[] = []
    let sequence = 1
    for (const level of ordered) {
      for (const assigneeId of uniqueIds(level.assigneeIds)) {
        steps.push(makeStep({
          sequence,
          groupId: level.kind,
          action: SIGNATORY_LEVEL_ACTIONS[level.kind],
          assigneeIds: [assigneeId],
        }))
        sequence += 1
      }
    }
    return { mode: 'sequential', steps }
  }

  if (input.mode === 'parallel') {
    return {
      mode: 'sequential',
      steps: ordered.map((level, index) =>
        makeStep({
          sequence: index + 1,
          groupId: level.kind,
          action: SIGNATORY_LEVEL_ACTIONS[level.kind],
          assigneeIds: uniqueIds(level.assigneeIds),
        }),
      ),
    }
  }

  // mixed → backend parallel so every level activates together
  return {
    mode: 'parallel',
    steps: ordered.map((level, index) =>
      makeStep({
        sequence: index + 1,
        groupId: level.kind,
        action: SIGNATORY_LEVEL_ACTIONS[level.kind],
        assigneeIds: uniqueIds(level.assigneeIds),
      }),
    ),
  }
}

function makeStep(input: {
  sequence: number
  groupId: string
  action: EdocAssignableAction
  assigneeIds: string[]
}): EdocRouteStepDraft {
  return {
    id: crypto.randomUUID(),
    groupId: input.groupId,
    sequence: input.sequence,
    action: input.action,
    assigneeIds: input.assigneeIds,
    completionRule: 'all',
    minimumCount: null,
    dueAt: '',
    allowDelegation: false,
  }
}

export function resolveCurrentUserProfileId(
  profiles: readonly EdocSignatoryProfile[],
  user: { profileId?: string; email?: string } | null,
): string | null {
  if (!user) return null
  if (user.profileId) {
    const byId = profiles.find((profile) => profile.id === user.profileId)
    if (byId) return byId.id
  }
  if (user.email) {
    const needle = user.email.trim().toLowerCase()
    const byEmail = profiles.find((profile) => profile.email.trim().toLowerCase() === needle)
    if (byEmail) return byEmail.id
  }
  return null
}
