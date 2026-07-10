import { Link } from 'react-router-dom'
import { Alert, Button, Empty, List, Spin } from 'antd'
import { BellRing } from 'lucide-react'

import {
  isApqrSchedulingSeason,
  type ApqrSchedulingReminderSummary,
} from '../../features/apqr/apqrSchedulingReminders'
import { iconSize, iconStroke } from '../../theme/iconSizes'
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
        <Button onClick={onClose}>Close</Button>
      }
    >
      <div className="apqr-notifications-panel">
        {inSeason ? (
          <Alert
            className="apqr-notifications-lead"
            type="info"
            showIcon
            icon={<BellRing size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
            message={
              <>
                Annual scheduling reminder for <strong>{summary.cycleLabel}</strong>. Prepare, send, review, and approve
                APQR schedules for client products and stability batches. Reminders stay active until every assigned
                schedule is client approved.
              </>
            }
          />
        ) : (
          <p className="apqr-notifications-lead help-text">
            Annual APQR scheduling reminders appear each <strong>September through October</strong>.
          </p>
        )}

        {loading ? <Spin tip="Loading APQR reminders…" /> : null}

        {!loading && inSeason && summary.items.length === 0 ? (
          <Empty description="No pending APQR scheduling actions for your assigned clients this season." />
        ) : null}

        {!loading && summary.items.length > 0 ? (
          <List
            className="apqr-notifications-list"
            dataSource={summary.items}
            renderItem={(item) => (
              <List.Item className="apqr-notifications-item">
                <List.Item.Meta
                  title={item.title}
                  description={
                    <>
                      <span className="apqr-notifications-client">
                        {item.clientCode} · {item.clientName}
                      </span>
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
                    </>
                  }
                />
              </List.Item>
            )}
          />
        ) : null}
      </div>
    </Modal>
  )
}
