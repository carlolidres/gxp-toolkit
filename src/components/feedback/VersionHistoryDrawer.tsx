import { Drawer, Typography } from 'antd'
import { History } from 'lucide-react'

import {
  APP_CURRENT_VERSION,
  APP_DEVELOPER,
  APP_VERSION_HISTORY,
} from '../../data/appVersionHistory'
import { APP_NAME } from '../../config/appNavigation'
import { iconSize, iconStroke } from '../../theme/iconSizes'

const { Text, Title } = Typography

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
  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      width={420}
      title={
        <div className="version-drawer-heading">
          <Text type="secondary" className="version-drawer-eyebrow">
            {APP_NAME}
          </Text>
          <Title level={4} style={{ margin: 0 }}>
            <History size={iconSize.md} strokeWidth={iconStroke} aria-hidden style={{ marginRight: 8 }} />
            Version history
          </Title>
          <p className="version-drawer-current">
            Current release <strong>{APP_CURRENT_VERSION}</strong>
          </p>
        </div>
      }
      className="version-drawer"
      destroyOnHidden
    >
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
    </Drawer>
  )
}
