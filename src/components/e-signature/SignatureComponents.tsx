import type { SignatureRequest } from '../../types/documents'
import { formatDate } from '../../utils/dateUtils'
import { statusTone } from '../../utils/statusUtils'
import { StatusBadge } from '../data-display/DataTable'
import { FormField, SelectInput, TextInput } from '../forms/FormControls'

export function SignatureRequestForm({ onSubmit }: { onSubmit: () => void }) {
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit() }}><div className="form-grid"><FormField label="Recipient"><TextInput defaultValue="quality.approver@example.com" type="email" /></FormField><FormField label="Signatory role"><SelectInput><option>Quality Approver</option><option>Document Owner</option><option>Final Approver</option></SelectInput></FormField><FormField label="Due date"><TextInput type="date" defaultValue="2026-06-20" /></FormField><FormField label="Authentication"><SelectInput><option>Email verification</option><option>Access code</option><option>Identity provider</option></SelectInput></FormField></div><label className="checkbox-row"><input type="checkbox" defaultChecked />I consent to use electronic records and signatures for this simulation.</label><button className="button primary" type="submit">Send signature request</button></form>
}

export function SignatureFieldPlaceholder({ type = 'signature' }: { type?: 'signature' | 'initial' | 'date' }) {
  return <div className={`signature-field ${type}`}><span>{type === 'signature' ? 'Sign here' : type === 'initial' ? 'Initial' : 'Date signed'}</span></div>
}

export function SignatureStatusTracker({ requests }: { requests: SignatureRequest[] }) {
  return <div className="signature-list">{requests.map((request, index) => <article key={request.id}><div className="avatar small">{index + 1}</div><div><strong>{request.recipient}</strong><p>{request.role} · Requested {formatDate(request.requestedAt)}</p></div><StatusBadge status={request.status} tone={statusTone(request.status)} /></article>)}</div>
}

export function SignatureCertificate({ requests }: { requests: SignatureRequest[] }) {
  return <div className="certificate"><div className="certificate-seal">✓</div><h3>Electronic signature certificate</h3><p>Document integrity reference: <code>NS-2026-A8F21C</code></p><dl><div><dt>Package</dt><dd>Electronic Records Policy v3.0</dd></div><div><dt>Recipients</dt><dd>{requests.length}</dd></div><div><dt>Completed</dt><dd>{requests.filter((item) => item.status === 'Signed').length}</dd></div><div><dt>Audit events</dt><dd>8</dd></div></dl></div>
}

