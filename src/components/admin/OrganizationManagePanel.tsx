import { useEffect, useState } from 'react'
import { Building2, Plus, Trash2 } from 'lucide-react'

import { useToast } from '../feedback/ToastProvider'
import { organizationOptionsService } from '../../services/organizationOptionsService'
import { normalizeOrganizationValue, validateOrganizationValue } from '../../lib/profileOrganization'
import { iconSize, iconStroke } from '../../theme/iconSizes'

export function OrganizationManagePanel({
  onOptionsChange,
}: {
  onOptionsChange?: (options: string[]) => void
}) {
  const { notify } = useToast()
  const [options, setOptions] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void organizationOptionsService
      .list()
      .then((rows) => {
        if (!active) return
        setOptions(rows)
        onOptionsChange?.(rows)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Could not load organizations.')
      })
    return () => {
      active = false
    }
  }, [onOptionsChange])

  async function handleAdd() {
    const normalized = normalizeOrganizationValue(draft)
    const validationError = validateOrganizationValue(normalized)
    if (!normalized) {
      setError('Enter an organization name.')
      return
    }
    if (validationError) {
      setError(validationError)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const next = await organizationOptionsService.remember(normalized)
      setOptions(next)
      onOptionsChange?.(next)
      setDraft('')
      notify('Organization saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add organization.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(value: string) {
    setBusy(true)
    setError(null)
    try {
      const next = await organizationOptionsService.remove(value)
      setOptions(next)
      onOptionsChange?.(next)
      notify('Organization removed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove organization.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Building2 className="size-4 text-[var(--teal)]" aria-hidden />
        <h2 className="text-sm font-semibold text-[var(--app-text)]">Organizations</h2>
      </div>
      <p className="mb-3 text-xs text-[var(--muted)]">
        Manage the shared organization catalog used in Account Settings and user profiles. Only administrators can
        manage this list.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          className="min-w-[14rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          value={draft}
          placeholder="Add organization…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleAdd()
            }
          }}
        />
        <button type="button" className="button primary" disabled={busy || !draft.trim()} onClick={() => void handleAdd()}>
          <Plus size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
          Add
        </button>
      </div>
      {error ? <p className="mb-2 text-xs text-[var(--danger-text)]">{error}</p> : null}
      <ul className="m-0 flex max-h-48 list-none flex-col gap-1.5 overflow-y-auto p-0">
        {options.map((org) => (
          <li
            key={org}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          >
            <span className="truncate">{org}</span>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              aria-label={`Remove ${org}`}
              onClick={() => void handleRemove(org)}
            >
              <Trash2 size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
            </button>
          </li>
        ))}
        {options.length === 0 ? <li className="text-xs text-[var(--muted)]">No organizations saved yet.</li> : null}
      </ul>
    </section>
  )
}
