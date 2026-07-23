import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, Search, UserRound, X } from 'lucide-react'

import { iconSize, iconStroke } from '../../theme/iconSizes'
import type { EdocSignatoryProfile } from '../../features/edoc/signatoryLevels'
import { VMP_INPUT_CLASS } from '../../pages/vmp/vmp-form-shared'

export function EdocSearchableUserSelect({
  id,
  profiles,
  selectedIds,
  lockedIds = [],
  disabled = false,
  loading = false,
  error,
  placeholder = 'Search by name or email…',
  emptyLabel = 'No matching users',
  onChange,
}: {
  id?: string
  profiles: readonly EdocSignatoryProfile[]
  selectedIds: readonly string[]
  lockedIds?: readonly string[]
  disabled?: boolean
  loading?: boolean
  error?: string
  placeholder?: string
  emptyLabel?: string
  onChange: (nextIds: string[]) => void
}) {
  const autoId = useId()
  const inputId = id ?? autoId
  const listId = `${inputId}-listbox`
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const selected = useMemo(
    () =>
      selectedIds
        .map((selectedId) => profiles.find((profile) => profile.id === selectedId))
        .filter((profile): profile is EdocSignatoryProfile => Boolean(profile)),
    [profiles, selectedIds],
  )

  const available = useMemo(() => {
    const selectedSet = new Set(selectedIds)
    const needle = query.trim().toLowerCase()
    return profiles.filter((profile) => {
      if (selectedSet.has(profile.id)) return false
      if (!needle) return true
      return (
        profile.displayName.toLowerCase().includes(needle)
        || profile.email.toLowerCase().includes(needle)
      )
    })
  }, [profiles, query, selectedIds])

  useEffect(() => {
    setHighlight(0)
  }, [query, open, available.length])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function add(profileId: string) {
    if (selectedIds.includes(profileId)) return
    onChange([...selectedIds, profileId])
    setQuery('')
    setOpen(true)
    inputRef.current?.focus()
  }

  function remove(profileId: string) {
    if (lockedIds.includes(profileId) || disabled) return
    onChange(selectedIds.filter((idValue) => idValue !== profileId))
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setHighlight((current) => Math.min(current + 1, Math.max(available.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter') {
      const option = available[highlight]
      if (open && option) {
        event.preventDefault()
        add(option.id)
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
    } else if (event.key === 'Backspace' && !query && selected.length > 0) {
      const last = selected[selected.length - 1]
      if (last && !lockedIds.includes(last.id)) remove(last.id)
    }
  }

  return (
    <div ref={rootRef} className="space-y-2">
      <div
        className={`rounded-xl border bg-[var(--surface)] transition-shadow ${
          error
            ? 'border-[color-mix(in_srgb,var(--danger)_55%,var(--border))]'
            : 'border-[var(--border)] focus-within:border-[var(--teal)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--teal)_18%,transparent)]'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <div className="flex flex-wrap gap-2 p-2.5">
          {selected.map((profile) => {
            const locked = lockedIds.includes(profile.id)
            return (
              <span
                key={profile.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--teal)_28%,var(--border))] bg-[color-mix(in_srgb,var(--teal)_10%,var(--surface))] px-2.5 py-1 text-xs text-[var(--navy)]"
              >
                <UserRound size={iconSize.xs} strokeWidth={iconStroke} className="shrink-0 text-[var(--teal)]" aria-hidden />
                <span className="truncate font-medium">{profile.displayName}</span>
                <span className="truncate text-[var(--muted)]">({profile.email})</span>
                {locked ? (
                  <span className="rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    You
                  </span>
                ) : (
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--teal)] disabled:cursor-not-allowed"
                    aria-label={`Remove ${profile.displayName}`}
                    disabled={disabled}
                    onClick={() => remove(profile.id)}
                  >
                    <X size={12} strokeWidth={iconStroke} aria-hidden />
                  </button>
                )}
              </span>
            )
          })}

          <div className="relative min-w-[12rem] flex-1">
            <Search
              size={iconSize.xs}
              strokeWidth={iconStroke}
              className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[var(--muted)]"
              aria-hidden
            />
            <input
              ref={inputRef}
              id={inputId}
              className={`${VMP_INPUT_CLASS} !min-h-9 !border-0 !bg-transparent !py-1.5 !pr-2 !pl-8 !shadow-none focus:!ring-0`}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-invalid={Boolean(error)}
              autoComplete="off"
              disabled={disabled || loading}
              placeholder={loading ? 'Loading users…' : placeholder}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
            />
          </div>
        </div>

        {open && !disabled ? (
          <ul
            id={listId}
            role="listbox"
            className="max-h-52 overflow-auto border-t border-[var(--border)] bg-[var(--surface)] py-1"
          >
            {available.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[var(--muted)]">{emptyLabel}</li>
            ) : (
              available.map((profile, index) => (
                <li key={profile.id} role="option" aria-selected={index === highlight}>
                  <button
                    type="button"
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left transition ${
                      index === highlight
                        ? 'bg-[color-mix(in_srgb,var(--teal)_12%,var(--surface))]'
                        : 'hover:bg-[var(--surface-muted)]'
                    }`}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => add(profile.id)}
                  >
                    <Check
                      size={iconSize.xs}
                      strokeWidth={iconStroke}
                      className={`mt-0.5 shrink-0 ${index === highlight ? 'text-[var(--teal)] opacity-100' : 'opacity-0'}`}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[var(--navy)]">{profile.displayName}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">{profile.email}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {error ? <p className="m-0 text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  )
}
