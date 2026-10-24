import type { ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { ApqrIcon } from './ApqrComponents'
import { emptyContact, type ApqrContactEntry } from '../../features/apqr/apqrContacts'

const fieldClass =
  'h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-700 disabled:bg-slate-100 disabled:text-slate-500'

export function ApqrContactRoleEditor({
  label,
  idPrefix,
  entries,
  onChange,
  compact = false,
  icon,
}: {
  label: string
  idPrefix: string
  entries: ApqrContactEntry[]
  onChange: (entries: ApqrContactEntry[]) => void
  compact?: boolean
  icon?: ReactNode
}) {
  function updateEntry(index: number, patch: Partial<ApqrContactEntry>) {
    onChange(entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)))
  }

  function addEntry() {
    onChange([...entries, emptyContact()])
  }

  function removeEntry(index: number) {
    const entry = entries[index]
    const summary = [entry.name, entry.title, entry.email].filter(Boolean).join(' · ') || `${label} contact`
    if (!window.confirm(`Remove ${summary}?`)) return

    if (entries.length <= 1) {
      onChange([emptyContact()])
      return
    }

    onChange(entries.filter((_, entryIndex) => entryIndex !== index))
  }

  if (compact) {
    return (
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-labelledby={`${idPrefix}-heading`}>
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2">
          <h4 id={`${idPrefix}-heading`} className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
            {icon}
            <span className="truncate">{label}</span>
          </h4>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-teal-800 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50"
            aria-label={`Add ${label} contact`}
            onClick={addEntry}
          >
            <Plus size={14} aria-hidden />
            Add
          </button>
        </header>
        <div className="flex flex-col gap-3 p-3">
          {entries.map((entry, index) => (
            <div
              key={`${idPrefix}-${index}`}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)_2.25rem] sm:items-end"
            >
              <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600" htmlFor={`${idPrefix}-name-${index}`}>
                Name
                <input
                  id={`${idPrefix}-name-${index}`}
                  type="text"
                  value={entry.name}
                  autoComplete="name"
                  className={fieldClass}
                  onChange={(event) => updateEntry(index, { name: event.target.value })}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600" htmlFor={`${idPrefix}-title-${index}`}>
                Title
                <input
                  id={`${idPrefix}-title-${index}`}
                  type="text"
                  value={entry.title}
                  autoComplete="organization-title"
                  className={fieldClass}
                  onChange={(event) => updateEntry(index, { title: event.target.value })}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600" htmlFor={`${idPrefix}-email-${index}`}>
                Email
                <input
                  id={`${idPrefix}-email-${index}`}
                  type="email"
                  value={entry.email}
                  autoComplete="email"
                  className={fieldClass}
                  onChange={(event) => updateEntry(index, { email: event.target.value })}
                />
              </label>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center justify-self-end rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50 sm:justify-self-auto"
                aria-label={`Remove ${label} contact ${index + 1}`}
                onClick={() => removeEntry(index)}
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="apqr-contact-role-editor">
      <div className="apqr-contact-role-label">{label}</div>
      <div className="apqr-contact-role-entries">
        {entries.map((entry, index) => (
          <div key={`${idPrefix}-${index}`} className="apqr-contact-entry-card">
            <div className="apqr-contact-entry-fields">
              <label className="apqr-contact-field" htmlFor={`${idPrefix}-name-${index}`}>
                <span className="apqr-contact-field-label">Name:</span>
                <input
                  id={`${idPrefix}-name-${index}`}
                  type="text"
                  value={entry.name}
                  autoComplete="name"
                  onChange={(event) => updateEntry(index, { name: event.target.value })}
                />
              </label>
              <label className="apqr-contact-field" htmlFor={`${idPrefix}-title-${index}`}>
                <span className="apqr-contact-field-label">Title/Position:</span>
                <input
                  id={`${idPrefix}-title-${index}`}
                  type="text"
                  value={entry.title}
                  autoComplete="organization-title"
                  onChange={(event) => updateEntry(index, { title: event.target.value })}
                />
              </label>
              <label className="apqr-contact-field" htmlFor={`${idPrefix}-email-${index}`}>
                <span className="apqr-contact-field-label">Email:</span>
                <input
                  id={`${idPrefix}-email-${index}`}
                  type="email"
                  value={entry.email}
                  autoComplete="email"
                  onChange={(event) => updateEntry(index, { email: event.target.value })}
                />
              </label>
            </div>
            <div className="apqr-contact-entry-actions">
              <button
                type="button"
                className="button secondary apqr-contact-action-btn"
                aria-label={`Add ${label} contact`}
                onClick={addEntry}
              >
                <ApqrIcon name="plus" />
              </button>
              <button
                type="button"
                className="button secondary apqr-contact-action-btn"
                aria-label={`Remove ${label} contact`}
                onClick={() => removeEntry(index)}
              >
                <ApqrIcon name="minus" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
