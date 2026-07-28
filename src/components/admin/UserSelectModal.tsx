import { useEffect, useId, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileSignature,
  Filter,
  Search,
  Users,
  X,
  XCircle,
} from 'lucide-react'

import type { ManagedUser } from '../../types/permissions'
import { iconSize, iconStroke } from '../../theme/iconSizes'

const ROLE_BADGE: Record<string, string> = {
  Admin: 'border-violet-200 bg-violet-50 text-violet-800',
  Manager: 'border-blue-200 bg-blue-50 text-blue-800',
  Editor: 'border-[color-mix(in_srgb,var(--teal)_25%,var(--border))] bg-[var(--teal-soft)] text-[var(--teal)]',
  Viewer: 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]',
}

const FIELD_CLASS =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--app-text)] shadow-sm transition-[border-color,box-shadow] focus-visible:border-[var(--teal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow-ring)]'

export function UserSelectModal({
  open,
  users,
  selectedId,
  onSelect,
  onClose,
  organizations,
}: {
  open: boolean
  users: ManagedUser[]
  selectedId: string | null
  onSelect: (userId: string) => void
  onClose: () => void
  organizations: string[]
}) {
  const titleId = useId()
  const searchId = useId()
  const orgId = useId()
  const workflowId = useId()
  const [search, setSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState('all')
  const [workflowFilter, setWorkflowFilter] = useState<'all' | 'edoc' | 'incomplete'>('all')

  const orgChoices = useMemo(() => {
    const set = new Set(organizations.map((org) => org.trim()).filter(Boolean))
    for (const user of users) {
      const org = user.organization?.trim()
      if (org) set.add(org)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [organizations, users])

  useEffect(() => {
    if (!open) return
    setSearch('')
    setOrgFilter('all')
    setWorkflowFilter('all')
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((user) => {
      if (orgFilter === '__none__') {
        if ((user.organization ?? '').trim()) return false
      } else if (orgFilter !== 'all') {
        if ((user.organization ?? '').trim().toLowerCase() !== orgFilter.toLowerCase()) return false
      }
      if (workflowFilter === 'edoc' && !user.hasEdocAccess) return false
      if (workflowFilter === 'incomplete' && !user.edocProfileIncomplete) return false
      if (!q) return true
      return [user.name, user.email, user.role, user.organization ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [users, search, orgFilter, workflowFilter])

  const filtersActive = Boolean(search.trim()) || orgFilter !== 'all' || workflowFilter !== 'all'

  function clearFilters() {
    setSearch('')
    setOrgFilter('all')
    setWorkflowFilter('all')
  }

  if (!open) return null

  return (
    <div className="user-mgmt-modal-root" role="presentation">
      <button
        type="button"
        className="user-mgmt-modal-backdrop"
        aria-label="Close user picker"
        onClick={onClose}
      />
      <div
        className="user-mgmt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <div className="mb-1 inline-flex items-center gap-2 text-[var(--teal)]">
              <Users size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.06em]">Authorization</span>
            </div>
            <h2 id={titleId} className="m-0 text-base font-semibold text-[var(--app-text)] sm:text-lg">
              Select a user
            </h2>
            <p className="mt-1 mb-0 text-sm leading-relaxed text-[var(--muted)]">
              Search and open an authorization matrix for one account.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow-ring)]"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
          </button>
        </header>

        <div className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-muted)_70%,var(--surface))] px-4 py-3.5 sm:px-5">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
            <div className="relative">
              <label htmlFor={searchId} className="sr-only">
                Search users
              </label>
              <Search
                size={iconSize.sm}
                strokeWidth={iconStroke}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--muted)]"
                aria-hidden
              />
              <input
                id={searchId}
                type="search"
                value={search}
                placeholder="Search by name, email, role, or organization…"
                autoFocus
                autoComplete="off"
                className={`${FIELD_CLASS} py-2.5 pr-10 pl-10`}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search ? (
                <button
                  type="button"
                  className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow-ring)]"
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                >
                  <X size={14} strokeWidth={iconStroke} aria-hidden />
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={orgId}
                  className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]"
                >
                  <Building2 size={12} strokeWidth={iconStroke} aria-hidden />
                  Organization
                </label>
                <select
                  id={orgId}
                  value={orgFilter}
                  className={FIELD_CLASS}
                  onChange={(event) => setOrgFilter(event.target.value)}
                >
                  <option value="all">All organizations</option>
                  <option value="__none__">No organization</option>
                  {orgChoices.map((org) => (
                    <option key={org} value={org}>
                      {org}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={workflowId}
                  className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]"
                >
                  <Filter size={12} strokeWidth={iconStroke} aria-hidden />
                  Workflow
                </label>
                <select
                  id={workflowId}
                  value={workflowFilter}
                  className={FIELD_CLASS}
                  onChange={(event) => setWorkflowFilter(event.target.value as typeof workflowFilter)}
                >
                  <option value="all">All users</option>
                  <option value="edoc">eDocuSign access</option>
                  <option value="incomplete">Incomplete eDoc profile</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-xs text-[var(--muted)]" aria-live="polite">
                {filtered.length === users.length
                  ? `${users.length} users`
                  : `${filtered.length} of ${users.length} users`}
              </p>
              {filtersActive ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-[var(--teal)] transition-colors hover:bg-[var(--teal-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow-ring)]"
                  onClick={clearFilters}
                >
                  <XCircle size={14} strokeWidth={iconStroke} aria-hidden />
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="user-mgmt-modal-list">
          <div className="user-mgmt-modal-list-head" role="row">
            <span role="columnheader">Name</span>
            <span role="columnheader">Email</span>
            <span role="columnheader">Role</span>
            <span role="columnheader">Organization</span>
            <span role="columnheader">E-signature</span>
            <span role="columnheader">Profile</span>
          </div>
          <div className="user-mgmt-modal-list-wrap" role="listbox" aria-label="Select a user">
            {filtered.map((user) => {
              const selected = user.id === selectedId
              return (
                <button
                  key={user.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`user-mgmt-modal-row${selected ? ' is-selected' : ''}`}
                  onClick={() => onSelect(user.id)}
                >
                  <span className="user-mgmt-modal-name">
                    <span className="user-mgmt-modal-avatar" aria-hidden>
                      {user.initials}
                    </span>
                    <strong>{user.name}</strong>
                  </span>
                  <span className="user-mgmt-modal-email">{user.email}</span>
                  <span className={`user-mgmt-modal-role ${ROLE_BADGE[user.role] ?? ''}`}>{user.role}</span>
                  <span className="user-mgmt-modal-org">
                    <Building2 size={14} strokeWidth={iconStroke} aria-hidden />
                    {user.organization?.trim() || '—'}
                  </span>
                  <span className={`user-mgmt-modal-status${user.hasSignature ? ' is-ok' : ' is-missing'}`}>
                    {user.hasSignature ? (
                      <FileSignature size={14} strokeWidth={iconStroke} aria-hidden />
                    ) : (
                      <XCircle size={14} strokeWidth={iconStroke} aria-hidden />
                    )}
                    {user.hasSignature ? 'Configured' : 'Missing'}
                  </span>
                  <span className={`user-mgmt-modal-status${user.profileComplete ? ' is-ok' : ' is-missing'}`}>
                    {user.profileComplete ? (
                      <CheckCircle2 size={14} strokeWidth={iconStroke} aria-hidden />
                    ) : (
                      <AlertTriangle size={14} strokeWidth={iconStroke} aria-hidden />
                    )}
                    {user.profileComplete ? 'Complete' : 'Incomplete'}
                  </span>
                </button>
              )
            })}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                <Users size={iconSize.lg} strokeWidth={iconStroke} className="text-[var(--muted)] opacity-50" aria-hidden />
                <p className="m-0 text-sm font-medium text-[var(--app-text)]">No users match</p>
                <p className="m-0 max-w-sm text-sm text-[var(--muted)]">
                  Try a different search term or clear the organization and workflow filters.
                </p>
                {filtersActive ? (
                  <button
                    type="button"
                    className="button secondary mt-1"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 sm:px-5">
          <span className="text-xs text-[var(--muted)]">
            Select a row to open that user’s authorization matrix.
          </span>
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}
