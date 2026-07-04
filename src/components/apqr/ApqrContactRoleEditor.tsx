import { ApqrIcon } from './ApqrComponents'
import { emptyContact, type ApqrContactEntry } from '../../features/apqr/apqrContacts'

export function ApqrContactRoleEditor({
  label,
  idPrefix,
  entries,
  onChange,
}: {
  label: string
  idPrefix: string
  entries: ApqrContactEntry[]
  onChange: (entries: ApqrContactEntry[]) => void
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
