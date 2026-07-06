import { Link } from 'react-router-dom'

import {
  isApqrSchedulingSeason,
  type ApqrSchedulingReminderSummary,
} from '../../features/apqr/apqrSchedulingReminders'
import { Modal } from './Modal'

export function ApqrNotificationsModal({
  isOpen,
  onClose,
  summary,
  loading,
}: {
  isOpen: boolean
  onClose: () => void
  summary: ApqrSchedulingReminderSummary
  loading: boolean
}) {
  const inSeason = isApqrSchedulingSeason()

  return (
    <Modal
      isOpen={isOpen}
      title="APQR notifications"
      onClose={onClose}
      footer={
        <button type="button" className="button secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="apqr-notifications-panel">
        {inSeason ? (
          <p className="apqr-notifications-lead">
            Annual scheduling reminder for <strong>{summary.cycleLabel}</strong>. Prepare, send, review, and approve
            APQR schedules for client products and stability batches. Reminders stay active until every assigned schedule
            is client approved.
          </p>
        ) : (
          <p className="apqr-notifications-lead help-text">
            Annual APQR scheduling reminders appear each <strong>September through October</strong>.
          </p>
        )}

        {loading ? <p className="messages-empty">Loading APQR reminders…</p> : null}

        {!loading && inSeason && summary.items.length === 0 ? (
          <div className="notification">
            <strong>All schedules approved</strong>
            <p>No pending APQR scheduling actions for your assigned clients this season.</p>
          </div>
        ) : null}

        {!loading && summary.items.length > 0 ? (
          <ul className="apqr-notifications-list">
            {summary.items.map((item) => (
              <li key={item.id} className="apqr-notifications-item">
                <div className="apqr-notifications-item-head">
                  <strong>{item.title}</strong>
                  <span className="apqr-notifications-client">
                    {item.clientCode} · {item.clientName}
                  </span>
                </div>
                {item.productName ? (
                  <p className="apqr-notifications-product">
                    {item.productName}
                    {item.productCode ? ` (${item.productCode})` : ''}
                  </p>
                ) : null}
                <p className="apqr-notifications-message">{item.message}</p>
                <Link className="text-button apqr-notifications-link" to={item.link} onClick={onClose}>
                  Open APQR Scheduler
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Modal>
  )
}
