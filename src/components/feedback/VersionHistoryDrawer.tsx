import { useEffect, useId, useRef } from 'react'

import {
  APP_CURRENT_VERSION,
  APP_DEVELOPER,
  APP_VERSION_HISTORY,
} from '../../data/appVersionHistory'

function formatReleaseDate(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function VersionHistoryDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="version-drawer-root">
      <button
        type="button"
        className="version-drawer-scrim"
        aria-label="Close version history"
        onClick={onClose}
      />
      <aside
        className="version-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="version-drawer-header">
          <div className="version-drawer-heading">
            <p className="version-drawer-eyebrow">GxP Toolkit</p>
            <h2 id={titleId}>Version history</h2>
            <p className="version-drawer-current">
              Current release <strong>{APP_CURRENT_VERSION}</strong>
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="version-drawer-close"
            aria-label="Close version history"
            onClick={onClose}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="version-drawer-developer">
          <span className="version-drawer-developer-label">Developed by</span>
          <strong>{APP_DEVELOPER}</strong>
        </div>

        <div className="version-drawer-body">
          <ol className="version-timeline">
            {APP_VERSION_HISTORY.map((entry, index) => (
              <li key={entry.version} className="version-timeline-item">
                <div className="version-timeline-marker" aria-hidden="true">
                  <span className={index === 0 ? 'version-timeline-dot is-current' : 'version-timeline-dot'} />
                  {index < APP_VERSION_HISTORY.length - 1 ? <span className="version-timeline-line" /> : null}
                </div>
                <article className="version-timeline-card">
                  <div className="version-timeline-card-head">
                    <h3>{entry.version}</h3>
                    <time dateTime={entry.releaseDate}>{formatReleaseDate(entry.releaseDate)}</time>
                  </div>
                  <ul className="version-timeline-changes">
                    {entry.changes.map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  )
}
