import { useRef } from 'react'

import type { DocumentRecord } from '../../types/documents'
import { daysUntil, formatDate } from '../../utils/dateUtils'
import { statusTone } from '../../utils/statusUtils'
import { StatusBadge } from '../data-display/DataTable'
import { FormField, DateInput, SelectInput, TextInput } from '../forms/FormControls'

export function DocumentStatusBadge({ status }: Pick<DocumentRecord, 'status'>) {
  return <StatusBadge status={status} tone={statusTone(status)} />
}

export function DocumentUpload({ onUpload }: { onUpload: (name: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return <div className="upload-zone" onClick={() => inputRef.current?.click()}><input ref={inputRef} hidden type="file" accept=".pdf,.doc,.docx" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0].name)} /><strong>Drop a controlled document here</strong><p>PDF or Word, up to 25 MB</p><button className="button secondary" type="button">Browse files</button></div>
}

export function DocumentMetadataForm() {
  return <div className="form-grid"><FormField label="Document title"><TextInput defaultValue="Supplier Qualification Procedure" /></FormField><FormField label="Category"><SelectInput defaultValue="SOP"><option>SOP</option><option>Policy</option><option>Form</option><option>Work Instruction</option></SelectInput></FormField><FormField label="Owner"><TextInput defaultValue="Maya Chen" /></FormField><FormField label="Review date"><DateInput defaultValue="2027-06-13" /></FormField></div>
}

export function DocumentPreview({ document }: { document: DocumentRecord }) {
  return <div className="document-preview"><div className="document-page"><div className="document-mark">NORTHSTAR</div><h2>{document.title}</h2><p>{document.code} · Version {document.version}</p><hr /><h3>1. Purpose</h3><p>This preview demonstrates how a backend or storage provider can supply document content.</p><h3>2. Scope</h3><p>Controlled quality-system activities and associated records.</p><span className="page-number">1 / 8</span></div></div>
}

export function DateTracker({ label, value }: { label: string; value: string }) {
  const days = daysUntil(value)
  return <div className="date-tracker"><span>{label}</span><strong>{formatDate(value)}</strong><small className={days < 30 ? 'text-danger' : ''}>{days >= 0 ? `${days} days remaining` : `${Math.abs(days)} days overdue`}</small></div>
}

export function VersionHistory() {
  return <div className="timeline">{[['4.0', 'Submitted for approval', 'Jun 10, 2026'], ['3.1', 'Periodic review', 'May 18, 2026'], ['3.0', 'Effective release', 'Jul 1, 2024']].map(([version, action, date]) => <div className="timeline-item" key={version}><span>{version}</span><div><strong>{action}</strong><p>{date}</p></div></div>)}</div>
}

