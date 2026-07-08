import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

import { VmpIcon } from './VmpFormFields'
import { VMP_FIELD_CLASS } from '../../pages/vmp/vmp-form-shared'

type MenuItem = { kind: 'option'; value: string } | { kind: 'create'; value: string }

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
      {label}
      {required ? (
        <span className="text-[var(--danger-text)]" aria-hidden="true">
          {' '}
          *
        </span>
      ) : null}
    </span>
  )
}

export function FormEditableCombobox({
  label,
  value,
  options,
  onChange,
  onCommit,
  onRemoveOption,
  removableOptions,
  required = false,
  disabled = false,
  loading = false,
  placeholder = 'Type or select…',
  allowCreate = true,
  createLabel = (next) => `Add “${next}”`,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  onCommit?: (value: string) => void
  onRemoveOption?: (value: string) => void
  removableOptions?: ReadonlySet<string>
  required?: boolean
  disabled?: boolean
  loading?: boolean
  placeholder?: string
  allowCreate?: boolean
  createLabel?: (value: string) => string
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [highlight, setHighlight] = useState(0)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  useEffect(() => {
    setQuery(value)
  }, [value])

  const trimmedQuery = query.trim()

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
    const input = inputRef.current
    if (!input) return
    const rect = input.getBoundingClientRect()
    setMenuStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
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
    const trimmed = next.trim().replace(/\s+/g, ' ')
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

  const optionsList =
    open && !disabled && !loading && menuItems.length > 0 ? (
      <ul
        ref={listRef}
        id={listId}
        className="vmp-editable-combobox-menu"
        style={menuStyle}
        role="listbox"
      >
        {menuItems.map((item, index) => (
          <li
            key={item.kind === 'create' ? `create-${item.value}` : item.value}
            role="option"
            aria-selected={index === highlight}
            className={[
              'vmp-editable-combobox-option',
              index === highlight ? 'is-active' : '',
              item.kind === 'create' ? 'is-create' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onMouseEnter={() => setHighlight(index)}
          >
            <button
              type="button"
              className="vmp-editable-combobox-option-main"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectItem(item)}
            >
              {item.kind === 'create' ? (
                <>
                  <VmpIcon name="plus" />
                  <span>{createLabel(item.value)}</span>
                </>
              ) : (
                item.value
              )}
            </button>
            {item.kind === 'option' && onRemoveOption && removableOptions?.has(item.value) ? (
              <button
                type="button"
                className="vmp-editable-combobox-remove"
                aria-label={`Remove saved option ${item.value}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onRemoveOption(item.value)}
              >
                <VmpIcon name="minus" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    ) : null

  return (
    <div className={`${VMP_FIELD_CLASS} vmp-editable-combobox relative${open ? ' is-open' : ''}`} ref={rootRef}>
      <FieldLabel label={label} required={required} />
      <div className="vmp-editable-combobox-input-wrap">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-busy={loading}
          disabled={disabled || loading}
          autoComplete="off"
          placeholder={loading ? 'Loading…' : placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (!disabled && !loading) setOpen(true)
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!rootRef.current?.contains(document.activeElement) && !listRef.current?.contains(document.activeElement)) {
                commitValue(query)
                setOpen(false)
              }
            }, 0)
          }}
          onKeyDown={onInputKeyDown}
        />
        <button
          type="button"
          className="vmp-editable-combobox-toggle"
          tabIndex={-1}
          disabled={disabled || loading}
          aria-label={open ? 'Close suggestions' : 'Show suggestions'}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (disabled || loading) return
            setOpen((current) => !current)
            inputRef.current?.focus()
          }}
        >
          <VmpIcon name="search" />
        </button>
      </div>
      {typeof document !== 'undefined' && optionsList ? createPortal(optionsList, document.body) : null}
    </div>
  )
}
