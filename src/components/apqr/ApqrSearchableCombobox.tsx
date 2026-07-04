import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { ApqrIcon } from './ApqrComponents'

type MenuItem = { kind: 'option'; value: string } | { kind: 'create'; value: string }

export function ApqrSearchableCombobox({
  id: idProp,
  value,
  options,
  disabled = false,
  placeholder = 'Type or select…',
  allowCreate = true,
  createLabel = (next) => `Add “${next}”`,
  onChange,
  onCommit,
}: {
  id?: string
  value: string
  options: string[]
  disabled?: boolean
  placeholder?: string
  allowCreate?: boolean
  createLabel?: (value: string) => string
  onChange: (value: string) => void
  onCommit?: (value: string) => void
}) {
  const autoId = useId()
  const inputId = idProp ?? autoId
  const listId = `${inputId}-listbox`
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    setQuery(value)
  }, [value])

  const trimmedQuery = query.trim()

  const filteredOptions = useMemo(() => {
    const q = trimmedQuery.toLowerCase()
    if (!q) return options
    return options.filter((option) => option.toLowerCase().includes(q))
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

  useEffect(() => {
    setHighlight(0)
  }, [query, open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

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
    if (disabled) return

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

  return (
    <div
      ref={rootRef}
      className={['apqr-combobox', open ? 'is-open' : '', disabled ? 'is-disabled' : ''].filter(Boolean).join(' ')}
    >
      <div className="apqr-combobox-input-wrap">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (!disabled) setOpen(true)
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!rootRef.current?.contains(document.activeElement)) {
                commitValue(query)
                setOpen(false)
              }
            }, 0)
          }}
          onKeyDown={onInputKeyDown}
        />
        <button
          type="button"
          className="apqr-combobox-toggle"
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? 'Close suggestions' : 'Show suggestions'}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (disabled) return
            setOpen((current) => !current)
            inputRef.current?.focus()
          }}
        >
          <ApqrIcon name="chevron" />
        </button>
      </div>

      {open && !disabled && menuItems.length > 0 ? (
        <ul id={listId} className="apqr-combobox-menu" role="listbox">
          {menuItems.map((item, index) => (
            <li
              key={item.kind === 'create' ? `create-${item.value}` : item.value}
              role="option"
              aria-selected={index === highlight}
              className={[
                'apqr-combobox-option',
                index === highlight ? 'is-highlighted' : '',
                item.kind === 'create' ? 'is-create' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => selectItem(item)}
            >
              {item.kind === 'create' ? (
                <>
                  <ApqrIcon name="plus" />
                  <span>{createLabel(item.value)}</span>
                </>
              ) : (
                item.value
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
