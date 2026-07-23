import { Modal, Tooltip } from 'antd'
import {
  BadgeCheck,
  CircleHelp,
  ClipboardPen,
  GitBranch,
  Layers,
  Plus,
  ShieldOff,
  Trash2,
  Users,
} from 'lucide-react'

import { EdocSearchableUserSelect } from './EdocSearchableUserSelect'
import {
  ROUTING_MODE_HELP,
  SIGNATORY_LEVEL_LABELS,
  canAddSignatoryLevel,
  createSignatoryLevel,
  nextSignatoryLevelKind,
  type EdocSignatoryLevelDraft,
  type EdocSignatoryLevelKind,
  type EdocSignatoryProfile,
  uniqueIds,
} from '../../features/edoc/signatoryLevels'
import type { EdocRoutingMode } from '../../features/edoc/types'
import { iconSize, iconStroke } from '../../theme/iconSizes'
import { VMP_INPUT_CLASS } from '../../pages/vmp/vmp-form-shared'

const levelIcons: Record<EdocSignatoryLevelKind, typeof ClipboardPen> = {
  prepared_by: ClipboardPen,
  reviewed_by: Users,
  approved_by: BadgeCheck,
}

export function EdocSignatoryRoutingBuilder({
  mode,
  levels,
  noSignatories,
  profiles,
  profilesLoading = false,
  profilesError = null,
  currentUserProfileId,
  levelErrors = {},
  disabled = false,
  onModeChange,
  onLevelsChange,
  onNoSignatoriesChange,
}: {
  mode: EdocRoutingMode
  levels: EdocSignatoryLevelDraft[]
  noSignatories: boolean
  profiles: readonly EdocSignatoryProfile[]
  profilesLoading?: boolean
  profilesError?: string | null
  currentUserProfileId: string | null
  levelErrors?: Partial<Record<EdocSignatoryLevelKind, string>>
  disabled?: boolean
  onModeChange: (mode: EdocRoutingMode) => void
  onLevelsChange: (levels: EdocSignatoryLevelDraft[]) => void
  onNoSignatoriesChange: (value: boolean) => void
}) {
  const controlsDisabled = disabled || noSignatories

  function updateLevel(levelId: string, assigneeIds: string[]) {
    onLevelsChange(
      levels.map((level) =>
        level.id === levelId
          ? {
              ...level,
              assigneeIds: uniqueIds(
                level.kind === 'prepared_by' && currentUserProfileId
                  ? [currentUserProfileId, ...assigneeIds]
                  : assigneeIds,
              ),
            }
          : level,
      ),
    )
  }

  function addLevel() {
    const kind = nextSignatoryLevelKind(levels)
    if (!kind || !canAddSignatoryLevel(levels)) return
    onLevelsChange([
      ...levels,
      createSignatoryLevel(
        kind,
        kind === 'prepared_by' && currentUserProfileId ? [currentUserProfileId] : [],
      ),
    ])
  }

  function removeLevel(levelId: string) {
    const target = levels.find((level) => level.id === levelId)
    if (!target || target.kind === 'prepared_by') return
    onLevelsChange(levels.filter((level) => level.id !== levelId))
  }

  function requestNoSignatories(checked: boolean) {
    if (!checked) {
      onNoSignatoriesChange(false)
      if (levels.length === 0) {
        onLevelsChange([
          createSignatoryLevel(
            'prepared_by',
            currentUserProfileId ? [currentUserProfileId] : [],
          ),
        ])
      }
      return
    }

    const hasExtraAssignees = levels.some((level) =>
      level.assigneeIds.some((id) => id !== currentUserProfileId),
    ) || levels.some((level) => level.kind !== 'prepared_by')

    if (!hasExtraAssignees && levels.every((level) => level.assigneeIds.length <= 1)) {
      onNoSignatoriesChange(true)
      onLevelsChange([])
      return
    }

    Modal.confirm({
      title: 'Clear signatory levels?',
      content:
        'Choosing “No signatories required” clears Prepared, Reviewed, and Approved selections and bypasses the approval route. This cannot be undone without re-adding users.',
      okText: 'Clear and continue',
      okButtonProps: { danger: true },
      cancelText: 'Keep signatories',
      onOk: () => {
        onNoSignatoriesChange(true)
        onLevelsChange([])
      },
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,18rem)]">
        <label className="space-y-2" htmlFor="edoc-routing-mode">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            <GitBranch size={iconSize.xs} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />
            Routing mode
            <Tooltip title={ROUTING_MODE_HELP[mode]}>
              <button
                type="button"
                className="inline-flex rounded-full text-[var(--muted)] transition hover:text-[var(--navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)]"
                aria-label="Routing mode help"
              >
                <CircleHelp size={14} strokeWidth={iconStroke} aria-hidden />
              </button>
            </Tooltip>
          </span>
          <select
            id="edoc-routing-mode"
            className={VMP_INPUT_CLASS}
            value={mode}
            disabled={controlsDisabled}
            onChange={(event) => onModeChange(event.target.value as EdocRoutingMode)}
          >
            <option value="sequential">Sequential</option>
            <option value="parallel">Parallel</option>
            <option value="mixed">Mixed</option>
          </select>
          <p className="m-0 text-xs leading-relaxed text-[var(--muted)]">{ROUTING_MODE_HELP[mode]}</p>
        </label>

        <div
          className={`rounded-xl border p-4 transition ${
            noSignatories
              ? 'border-[color-mix(in_srgb,var(--teal)_40%,var(--border))] bg-[color-mix(in_srgb,var(--teal)_8%,var(--surface))]'
              : 'border-[var(--border)] bg-[var(--surface-muted)]'
          }`}
        >
          <label className="flex cursor-pointer items-start gap-3" htmlFor="edoc-no-signatories">
            <input
              id="edoc-no-signatories"
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[var(--teal)]"
              checked={noSignatories}
              disabled={disabled}
              onChange={(event) => requestNoSignatories(event.target.checked)}
            />
            <span className="min-w-0 space-y-1">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--navy)]">
                <ShieldOff size={iconSize.sm} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />
                No signatories required
              </span>
              <span className="block text-xs leading-relaxed text-[var(--muted)]">
                Bypass the approval route. Signatory levels are hidden and cleared after confirmation.
              </span>
            </span>
          </label>
        </div>
      </div>

      {profilesError ? (
        <p className="m-0 rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))] px-3 py-2 text-sm text-[var(--danger)]">
          {profilesError}
        </p>
      ) : null}

      {noSignatories ? (
        <div
          className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-8 text-left sm:items-center sm:text-center"
          role="status"
        >
          <Layers size={iconSize.lg} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />
          <h3 className="m-0 text-base font-semibold text-[var(--navy)]">Approval route bypassed</h3>
          <p className="m-0 max-w-xl text-sm text-[var(--muted)]">
            This document will be sent without Prepared, Reviewed, or Approved assignments. Uncheck the option above to configure signatories.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {levels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-8 text-center">
              <p className="m-0 text-sm text-[var(--muted)]">No signatory levels yet. Add Prepared by to begin.</p>
            </div>
          ) : null}

          {levels.map((level, index) => {
            const Icon = levelIcons[level.kind]
            const lockedIds = level.kind === 'prepared_by' && currentUserProfileId
              ? [currentUserProfileId]
              : []
            return (
              <section
                key={level.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:p-5"
                aria-labelledby={`edoc-level-${level.id}`}
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p
                      id={`edoc-level-${level.id}`}
                      className="m-0 inline-flex items-center gap-2 text-sm font-semibold text-[var(--navy)]"
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--teal)_14%,var(--surface))] text-xs font-bold text-[var(--teal)]">
                        {index + 1}
                      </span>
                      <Icon size={iconSize.sm} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />
                      {SIGNATORY_LEVEL_LABELS[level.kind]}
                    </p>
                    <p className="m-0 text-xs text-[var(--muted)]">
                      {level.kind === 'prepared_by'
                        ? 'You are included automatically. Add other registered preparers if needed.'
                        : 'Select one or more registered users. Duplicates within this level are blocked.'}
                    </p>
                  </div>
                  {level.kind !== 'prepared_by' ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--danger)] transition hover:bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={controlsDisabled}
                      onClick={() => removeLevel(level.id)}
                    >
                      <Trash2 size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
                      Remove level
                    </button>
                  ) : null}
                </div>

                <EdocSearchableUserSelect
                  id={`edoc-level-assignees-${level.id}`}
                  profiles={profiles}
                  selectedIds={level.assigneeIds}
                  lockedIds={lockedIds}
                  disabled={controlsDisabled}
                  loading={profilesLoading}
                  error={levelErrors[level.kind]}
                  onChange={(nextIds) => updateLevel(level.id, nextIds)}
                />
              </section>
            )
          })}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--navy)] transition hover:border-[var(--teal)] hover:text-[var(--teal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={controlsDisabled || !canAddSignatoryLevel(levels)}
              onClick={addLevel}
            >
              <Plus size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
              Add Signatory Level
            </button>
            {!canAddSignatoryLevel(levels) ? (
              <span className="text-xs text-[var(--muted)]">Maximum of three levels (Prepared, Reviewed, Approved).</span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
