import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Archive,
  Calendar,
  ClipboardList,
  Download,
  Eraser,
  Eye,
  FileText,
  Info,
  Link2,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Tag,
  X,
  type LucideIcon,
} from 'lucide-react'

import { AppDateInput } from '../forms/AppDateInput'
import {
  VMP_FIELD_CLASS,
  VMP_FIELD_WIDE_CLASS,
  VMP_INPUT_CLASS,
} from '../../pages/vmp/vmp-form-shared'
import { iconSize, iconStroke } from '../../theme/iconSizes'

const formIcons: Record<string, LucideIcon> = {
  document: FileText,
  save: Save,
  draft: FileText,
  clear: Eraser,
  cancel: X,
  info: Info,
  tag: Tag,
  link: Link2,
  calendar: Calendar,
  plus: Plus,
  minus: Minus,
  search: Search,
  eye: Eye,
  edit: Pencil,
  archive: Archive,
  restore: RotateCcw,
  download: Download,
  sliders: SlidersHorizontal,
  'clipboard-list': ClipboardList,
}

export function VmpIcon({ name }: { name: string }) {
  const Icon = formIcons[name] ?? Search
  return <Icon size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
}

const SECTION_ICONS: Record<string, LucideIcon> = {
  document: FileText,
  link: Link2,
  calendar: Calendar,
  'clipboard-list': ClipboardList,
}

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

export function VmpFormSectionHeader({
  title,
  description,
  icon = 'document',
}: {
  title: string
  description: string
  icon?: string
}) {
  const Icon = SECTION_ICONS[icon] ?? ClipboardList
  return (
    <header className="flex items-start gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4 sm:gap-3.5 sm:px-6">
      <span
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--teal-soft)] text-[var(--teal)]"
        aria-hidden="true"
      >
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold leading-snug text-[var(--navy)]">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
      </div>
    </header>
  )
}

export function VmpInfoCallout({ children }: { children: ReactNode }) {
  return (
    <div
      className="mx-5 mb-5 flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--info-text)_22%,var(--border))] bg-[var(--alert-info-bg)] px-4 py-3 sm:mx-6"
      role="note"
    >
      <span
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--badge-info-bg)] text-[var(--info-text)]"
        aria-hidden="true"
      >
        <Info className="size-4" strokeWidth={2} />
      </span>
      <p className="text-sm font-medium leading-relaxed text-[var(--info-text)]">{children}</p>
    </div>
  )
}

export function VmpModeBanner({ children }: { children: ReactNode }) {
  return (
    <div
      className="mb-1 flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--teal)_34%,var(--border))] bg-gradient-to-r from-[var(--teal-soft)] via-[color-mix(in_srgb,var(--teal-soft)_55%,var(--surface))] to-[var(--surface)] px-4 py-3.5 text-sm font-semibold text-[var(--navy)]"
      role="status"
    >
      <span
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--surface)_82%,var(--teal-soft))] text-[var(--teal)]"
        aria-hidden="true"
      >
        <VmpIcon name="draft" />
      </span>
      <span>{children}</span>
    </div>
  )
}

export function FormInput({
  label,
  value,
  onChange,
  required = false,
  type = 'text',
  placeholder,
  readOnly = false,
  helper,
  wide = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  type?: string
  placeholder?: string
  readOnly?: boolean
  helper?: string
  wide?: boolean
}) {
  if (type === 'date') {
    return (
      <label className={wide ? VMP_FIELD_WIDE_CLASS : VMP_FIELD_CLASS}>
        <FieldLabel label={label} required={required} />
        <AppDateInput
          value={value}
          readOnly={readOnly}
          onChange={(event) => onChange(event.target.value)}
        />
        {helper ? <small className="text-xs leading-relaxed text-[var(--muted)]">{helper}</small> : null}
      </label>
    )
  }

  return (
    <label className={wide ? VMP_FIELD_WIDE_CLASS : VMP_FIELD_CLASS}>
      <FieldLabel label={label} required={required} />
      <input
        type={type}
        className={VMP_INPUT_CLASS}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {helper ? <small className="text-xs leading-relaxed text-[var(--muted)]">{helper}</small> : null}
    </label>
  )
}

export function FormTextarea({
  label,
  value,
  onChange,
  required = false,
  rows = 3,
  wide = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  rows?: number
  wide?: boolean
}) {
  return (
    <label className={wide ? VMP_FIELD_WIDE_CLASS : VMP_FIELD_CLASS}>
      <FieldLabel label={label} required={required} />
      <textarea
        className={`${VMP_INPUT_CLASS} min-h-24 resize-y`}
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

export function FormSelect({
  label,
  value,
  options,
  onChange,
  required = false,
  placeholder = 'Select',
  searchable = false,
  loading = false,
  error,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
  searchable?: boolean
  loading?: boolean
  error?: string
}) {
  if (searchable) {
    return (
      <FormSearchableSelect
        label={label}
        value={value}
        options={options}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        loading={loading}
        error={error}
      />
    )
  }

  return (
    <label className={VMP_FIELD_CLASS}>
      <FieldLabel label={label} required={required} />
      <select
        className={`${VMP_INPUT_CLASS} appearance-none bg-[length:16px] bg-[position:right_12px_center] bg-no-repeat pr-9`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7c8f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        value={value}
        disabled={loading}
        aria-busy={loading}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{loading ? 'Loading…' : placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error ? <small className="text-xs text-[var(--danger-text)]">{error}</small> : null}
    </label>
  )
}

export function FormSearchableSelect({
  label,
  value,
  options,
  onChange,
  required = false,
  placeholder = 'Select',
  loading = false,
  error,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
  loading?: boolean
  error?: string
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) => option.toLowerCase().includes(needle))
  }, [options, query])

  const syncMenuPosition = useCallback(() => {
    const input = inputRef.current
    if (!input) return
    const rect = input.getBoundingClientRect()
    setMenuStyle({
      top: rect.bottom - 4,
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
  }, [open, syncMenuPosition, filtered.length])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  function selectOption(option: string) {
    onChange(option)
    setQuery('')
    setOpen(false)
  }

  const optionsList =
    open && filtered.length > 0 ? (
      <ul
        ref={listRef}
        id={listId}
        className="vmp-searchable-options"
        style={menuStyle}
        role="listbox"
      >
        {filtered.map((option, index) => (
          <li key={option} role="option" aria-selected={value === option}>
            <button
              type="button"
              className={index === highlight ? 'is-active' : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
            >
              {option}
            </button>
          </li>
        ))}
      </ul>
    ) : null

  return (
    <div className={`${VMP_FIELD_CLASS} vmp-searchable-select relative`} ref={rootRef}>
      <FieldLabel label={label} required={required} />
      <input
        ref={inputRef}
        className={VMP_INPUT_CLASS}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={Boolean(error)}
        aria-busy={loading}
        disabled={loading}
        placeholder={loading ? 'Loading…' : value || placeholder}
        value={open ? query : value}
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setHighlight((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)))
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setHighlight((current) => Math.max(current - 1, 0))
          }
          if (event.key === 'Enter' && open && filtered[highlight]) {
            event.preventDefault()
            selectOption(filtered[highlight])
          }
          if (event.key === 'Escape') {
            setOpen(false)
            setQuery('')
          }
        }}
      />
      {typeof document !== 'undefined' && optionsList ? createPortal(optionsList, document.body) : null}
      {error ? <small className="text-xs text-[var(--danger-text)]">{error}</small> : null}
    </div>
  )
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="vmp-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

const statusTone: Record<string, string> = {
  Qualified: 'success',
  Planned: 'info',
  Ongoing: 'info',
  'Due Soon': 'warning',
  'Requalification Due': 'warning',
  Overdue: 'danger',
  Deferred: 'warning',
  Retired: 'neutral',
  Decommissioned: 'danger',
}

export function StatusPill({ status }: { status: string }) {
  const tone = statusTone[status] ?? 'neutral'
  return <span className={`vmp-status-pill tone-${tone}`}>{status}</span>
}
