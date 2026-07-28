import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Loader2, Plus, Search, Trash2, type LucideIcon } from 'lucide-react'

import { iconSize, iconStroke } from '../../theme/iconSizes'
import { normalizeOrganizationValue } from '../../lib/profileOrganization'

type MenuItem = { kind: 'option'; value: string } | { kind: 'create'; value: string }

export function EditableCombobox({
  id: idProp,
  label,
  value,
  options,
  onChange,
  onCommit,
  onRemoveOption,
  canRemoveOptions = false,
  required = false,
  disabled = false,
  loading = false,
  placeholder = 'Type or select…',
  allowCreate = true,
  createLabel = (next) => `Add “${next}”`,
  hint,
  error,
  leadingIcon: LeadingIcon,
}: {
  id?: string
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  onCommit?: (value: string) => void
  onRemoveOption?: (value: string) => void
  canRemoveOptions?: boolean
  required?: boolean
  disabled?: boolean
  loading?: boolean
  placeholder?: string
  allowCreate?: boolean
  createLabel?: (value: string) => string
  hint?: string
  error?: string | null
  leadingIcon?: LucideIcon
}) {
  const autoId = useId()
  const inputId = idProp ?? autoId
  const listId = `${inputId}-listbox`
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const rootRef = useRef<HTMLDivElement>(null)
  const controlRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [highlight, setHighlight] = useState(0)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  useEffect(() => {
    setQuery(value)
  }, [value])

  const trimmedQuery = normalizeOrganizationValue(query)
  const normalizedValue = normalizeOrganizationValue(value)

  const filteredOptions = useMemo(() => {
    const needle = trimmedQuery.toLowerCase()
    if (!needle) return options
    return options.filter((option) => option.toLowerCase().includes(needle))
  }, [options, trimmedQuery])

  const showCreate =
    allowCreate &&
    trimmedQuery.length > 0 &&
    !options.some((option) => option.toLowerCase() === trimmedQuery.toLowerCase())

  const menuItems = useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = filteredOptions.map((option) => ({ kind: 'option', value: option }))
    if (showCreate) items.push({ kind: 'create', value: trimmedQuery })
    return items
  }, [filteredOptions, showCreate, trimmedQuery])

  const syncMenuPosition = useCallback(() => {
    const control = controlRef.current
    if (!control) return
    const rect = control.getBoundingClientRect()
    setMenuStyle({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 240),
    })
  }, [])

  useEffect(() => {
    setHighlight(0)
  }, [query, open])

  useEffect(() => {
    if (!open) return
    syncMenuPosition()
    window.addEventListener('scroll', syncMenuPosition, true)
    window.addEventListener('resize', syncMenuPosition)
    return () => {
      window.removeEventListener('scroll', syncMenuPosition, true)
      window.removeEventListener('resize', syncMenuPosition)
    }
  }, [open, syncMenuPosition, menuItems.length])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  function commitValue(next: string) {
    const trimmed = normalizeOrganizationValue(next)
    if (trimmed !== value) onChange(trimmed)
    if (trimmed) onCommit?.(trimmed)
    setQuery(trimmed)
  }

  function selectItem(item: MenuItem) {
    onChange(item.value)
    onCommit?.(item.value)
    setQuery(item.value)
    setOpen(false)
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled || loading) return

    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      event.preventDefault()
      setOpen(true)
      return
    }

    if (!open) return

    if (event.key === 'Escape') {
      event.preventDefault()
      setQuery(value)
      setOpen(false)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((current) => Math.min(current + 1, Math.max(menuItems.length - 1, 0)))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (menuItems.length > 0) {
        selectItem(menuItems[highlight])
        return
      }
      commitValue(query)
      setOpen(false)
    }
  }

  const activeOptionId =
    open && menuItems.length > 0 ? `${listId}-option-${highlight}` : undefined

  const describedBy = [error ? errorId : null, !error && hint ? hintId : null]
    .filter(Boolean)
    .join(' ')

  const showMenu = open && !disabled && !loading
  const optionsList = showMenu ? (
    <div
      ref={listRef}
      style={menuStyle}
      className="fixed z-[1100] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_12px_36px_rgba(16,42,67,0.14),0_2px_8px_rgba(16,42,67,0.06)]"
    >
      {menuItems.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="m-0 max-h-56 list-none overflow-auto p-1.5"
        >
          {menuItems.map((item, index) => {
            const isCreate = item.kind === 'create'
            const isActive = index === highlight
            const isSelected =
              item.kind === 'option' &&
              normalizeOrganizationValue(item.value).toLowerCase() === normalizedValue.toLowerCase() &&
              normalizedValue.length > 0
            const optionId = `${listId}-option-${index}`

            return (
              <li
                key={isCreate ? `create-${item.value}` : item.value}
                id={optionId}
                role="option"
                aria-selected={isActive}
                className={`flex items-stretch ${isCreate && filteredOptions.length > 0 ? 'mt-1 border-t border-[var(--border)] pt-1' : ''}`}
                onMouseEnter={() => setHighlight(index)}
              >
                <button
                  type="button"
                  className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-[color-mix(in_srgb,var(--teal)_12%,var(--surface))] text-[var(--navy)]'
                      : 'text-[var(--app-text)] hover:bg-[var(--surface-muted,#f4f7fa)]'
                  } ${isCreate ? 'font-semibold text-[var(--teal)]' : 'font-medium'}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectItem(item)}
                >
                  {isCreate ? (
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--teal)_14%,var(--surface))] text-[var(--teal)]">
                      <Plus size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
                    </span>
                  ) : isSelected ? (
                    <Check
                      size={iconSize.xs}
                      strokeWidth={iconStroke}
                      className="shrink-0 text-[var(--teal)]"
                      aria-hidden
                    />
                  ) : (
                    <span className="inline-block w-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {isCreate ? createLabel(item.value) : item.value}
                  </span>
                </button>
                {item.kind === 'option' && canRemoveOptions && onRemoveOption ? (
                  <button
                    type="button"
                    className="mr-0.5 shrink-0 rounded-lg px-2.5 text-[var(--muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] hover:text-[var(--danger)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--teal)]"
                    aria-label={`Remove saved option ${item.value}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onRemoveOption(item.value)}
                  >
                    <Trash2 size={14} strokeWidth={iconStroke} aria-hidden />
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <div
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="flex items-center gap-2.5 px-3.5 py-3 text-sm text-[var(--muted)]"
        >
          <Search size={iconSize.xs} strokeWidth={iconStroke} className="shrink-0 opacity-70" aria-hidden />
          <span>{trimmedQuery ? 'No matching organizations' : 'No saved organizations yet'}</span>
        </div>
      )}
    </div>
  ) : null

  return (
    <div ref={rootRef} className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={inputId} className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
        {label}
        {required ? (
          <span className="text-[var(--danger)]" aria-hidden>
            {' '}
            *
          </span>
        ) : null}
      </label>
      <div
        ref={controlRef}
        className={`group/combobox flex min-h-11 items-stretch overflow-hidden rounded-xl border bg-[var(--surface)] transition-[border-color,box-shadow] ${
          error
            ? 'border-[color-mix(in_srgb,var(--danger)_55%,var(--border))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--danger)_12%,transparent)]'
            : open
              ? 'border-[var(--teal)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--teal)_18%,transparent)]'
              : 'border-[var(--border)] hover:border-[color-mix(in_srgb,var(--teal)_35%,var(--border))]'
        } ${disabled || loading ? 'opacity-60' : ''}`}
      >
        {LeadingIcon ? (
          <span className="inline-flex shrink-0 items-center pl-3 text-[var(--muted)] transition-colors group-hover/combobox:text-[var(--navy)] group-focus-within/combobox:text-[var(--teal)]">
            <LeadingIcon size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
          </span>
        ) : null}
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          aria-invalid={Boolean(error)}
          aria-busy={loading}
          aria-required={required}
          aria-describedby={describedBy || undefined}
          disabled={disabled || loading}
          autoComplete="organization"
          placeholder={loading ? 'Loading…' : placeholder}
          value={query}
          className={`min-w-0 flex-1 border-0 bg-transparent py-2.5 pr-2 text-sm font-medium text-[var(--navy)] outline-none placeholder:font-normal placeholder:text-[var(--muted)] ${
            LeadingIcon ? 'pl-2' : 'pl-3.5'
          }`}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (!disabled && !loading) setOpen(true)
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (
                !rootRef.current?.contains(document.activeElement) &&
                !listRef.current?.contains(document.activeElement)
              ) {
                commitValue(query)
                setOpen(false)
              }
            }, 0)
          }}
          onKeyDown={onInputKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || loading}
          aria-label={open ? 'Close suggestions' : 'Show suggestions'}
          aria-expanded={open}
          aria-controls={listId}
          className={`inline-flex w-10 shrink-0 items-center justify-center rounded-r-[0.75rem] border-l border-[var(--border)] transition-[background-color,color,border-color] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--teal)] disabled:cursor-not-allowed ${
            open
              ? 'border-l-[color-mix(in_srgb,var(--teal)_28%,var(--border))] bg-[color-mix(in_srgb,var(--teal)_10%,var(--surface))] text-[var(--teal)]'
              : 'bg-[color-mix(in_srgb,var(--surface-muted,#f4f7fa)_40%,var(--surface))] text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--teal)_8%,var(--surface))] hover:text-[var(--teal)]'
          }`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (disabled || loading) return
            setOpen((current) => !current)
            inputRef.current?.focus()
          }}
        >
          {loading ? (
            <Loader2 size={iconSize.sm} strokeWidth={iconStroke} className="animate-spin" aria-hidden />
          ) : (
            <ChevronDown
              size={iconSize.sm}
              strokeWidth={iconStroke}
              aria-hidden
              className={`transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`}
            />
          )}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="m-0 text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="m-0 text-xs leading-relaxed text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
      {typeof document !== 'undefined' && optionsList ? createPortal(optionsList, document.body) : null}
    </div>
  )
}
