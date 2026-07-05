import { useState } from 'react'
import { Link } from 'react-router-dom'

import type { VmpMasterlistRecord } from '../../lib/vmpMasterlist'
import {
  getCalculatedDueStatus,
  getDaysRemaining,
  getDueMonth,
  getDueYear,
} from '../../lib/vmpMasterlistSchedule'
import { formatAppDate } from '../../utils/dateUtils'
import { VmpIcon } from './VmpFormFields'

type DrawerTab = 'Overview' | 'Documents' | 'Schedule' | 'Status' | 'Audit'

const drawerTabs: DrawerTab[] = ['Overview', 'Documents', 'Schedule', 'Status', 'Audit']

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  )
}

function DrawerBody({
  record,
  tab,
}: {
  record: VmpMasterlistRecord
  tab: DrawerTab
}) {
  const dueStatus = getCalculatedDueStatus(record.nextDueDate)
  const daysRemaining = getDaysRemaining(record.nextDueDate)

  if (tab === 'Overview') {
    return (
      <div className="vmp-detail-grid">
        <DetailRow label="Record ID" value={record.recordId} />
        <DetailRow label="Validation Area" value={record.validationArea} />
        <DetailRow label="Site / Plant" value={record.sitePlant} />
        <DetailRow label="Department / Facility" value={record.department} />
        <DetailRow
          label={record.validationArea === 'Facilities' ? 'Group / Subcategory' : record.validationArea === 'Equipment' ? 'Group / Subcategory' : 'Group / Subcategory'}
          value={record.group}
        />
        <DetailRow label="Item / System / Area Name" value={record.itemName} />
        <DetailRow label={record.validationArea === 'Equipment' ? 'IL-tag No.' : 'Asset / Tag No.'} value={record.assetTagNo} />
        {record.roomLine ? (
          <DetailRow
            label={
              record.validationArea === 'Equipment' &&
              record.department.toLowerCase().includes('equipment thermal mapping')
                ? 'Section'
                : 'Room / Line'
            }
            value={record.roomLine}
          />
        ) : null}
      </div>
    )
  }

  if (tab === 'Documents') {
    return (
      <div className="vmp-detail-grid">
        <DetailRow label="Protocol Tracer" value={record.protocolTracer} />
        <DetailRow label="Report Tracer" value={record.reportTracer} />
        <DetailRow label="Report Approval Date" value={formatAppDate(record.reportApprovalDate, '')} />
      </div>
    )
  }

  if (tab === 'Schedule') {
    return (
      <div className="vmp-detail-grid">
        <DetailRow label="Review / Revalidation Frequency" value={record.reviewFrequency} />
        <DetailRow label="Next Due Date" value={formatAppDate(record.nextDueDate, '')} />
        <DetailRow label="Derived Due Month" value={getDueMonth(record.nextDueDate)} />
        <DetailRow label="Derived Due Year" value={getDueYear(record.nextDueDate)} />
        <DetailRow label="Days Remaining" value={daysRemaining === null ? '' : String(daysRemaining)} />
        <DetailRow label="Due Status" value={dueStatus ?? ''} />
      </div>
    )
  }

  if (tab === 'Status') {
    return (
      <div className="vmp-detail-grid">
        <DetailRow label="Validation Status" value={record.validationStatus} />
        <DetailRow label="Lifecycle Status" value={record.lifecycleStatus} />
        <DetailRow label="Criticality" value={record.criticality} />
        <DetailRow label="Responsible Owner" value={record.responsibleOwner} />
        <DetailRow label="Remarks" value={record.remarks} />
        <DetailRow label="Draft" value={record.isDraft ? 'Yes' : 'No'} />
        <DetailRow label="Archived" value={record.isArchived ? 'Yes' : 'No'} />
      </div>
    )
  }

  return (
    <div className="vmp-list-stack">
      <div className="vmp-detail-grid">
        <DetailRow label="Created By" value={record.createdBy} />
        <DetailRow label="Created At" value={record.createdAt} />
        <DetailRow label="Updated By" value={record.updatedBy} />
        <DetailRow label="Updated At" value={record.updatedAt} />
        <DetailRow label="Version" value={String(record.version)} />
      </div>
      {record.history.length ? (
        record.history.map((event) => (
          <article key={event.id}>
            <strong>{event.action}</strong>
            <span>
              {event.previousValue} → {event.currentValue}
            </span>
            <small>
              {event.date} · {event.actor} · {event.reason}
            </small>
          </article>
        ))
      ) : (
        <p className="vrms-muted">No change history entries are available for this record.</p>
      )}
    </div>
  )
}

export function VmpRecordDrawer({
  record,
  onClose,
  onArchive,
  onRestore,
  canEdit,
  canArchive,
}: {
  record: VmpMasterlistRecord
  onClose: () => void
  onArchive: () => void
  onRestore: () => void
  canEdit: boolean
  canArchive: boolean
}) {
  const [tab, setTab] = useState<DrawerTab>('Overview')

  return (
    <aside className="vmp-record-drawer" aria-label="Record details">
      <header>
        <div>
          <h2>{record.itemName || record.recordId}</h2>
          <p>
            {record.validationArea} · {record.recordId}
          </p>
        </div>
        <div className="vmp-drawer-actions">
          {canEdit ? (
            <Link className="vrms-btn-secondary" to={`/vmp/masterlist?edit=${encodeURIComponent(record.recordId)}`}>
              <VmpIcon name="edit" /> Edit
            </Link>
          ) : null}
          {canArchive && !record.isArchived ? (
            <button type="button" className="vrms-btn-secondary" onClick={onArchive}>
              <VmpIcon name="archive" /> Archive
            </button>
          ) : null}
          {canArchive && record.isArchived ? (
            <button type="button" className="vrms-btn-secondary" onClick={onRestore}>
              <VmpIcon name="restore" /> Restore
            </button>
          ) : null}
          <button type="button" className="vrms-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </header>
      <div className="vmp-tabs" role="tablist">
        {drawerTabs.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            className={tab === item ? 'active' : ''}
            aria-selected={tab === item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <DrawerBody record={record} tab={tab} />
    </aside>
  )
}
