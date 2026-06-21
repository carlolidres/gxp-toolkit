import type { WorkflowStep } from '../../types/documents'
import { formatDate } from '../../utils/dateUtils'
import { statusTone } from '../../utils/statusUtils'
import { StatusBadge } from '../data-display/DataTable'

export function ApprovalStepper({ steps }: { steps: WorkflowStep[] }) {
  return <div className="stepper">{steps.map((step, index) => <div className={`step ${step.status.toLowerCase().replaceAll(' ', '-')}`} key={step.id}><div className="step-marker">{step.status === 'Approved' ? '✓' : index + 1}</div><div><strong>{step.role}</strong><p>{step.assignee}</p><small>{formatDate(step.dueDate)}</small></div></div>)}</div>
}

export function ApprovalDecisionPanel({ onDecision }: { onDecision: (decision: string) => void }) {
  return <div className="decision-panel"><button className="button primary" onClick={() => onDecision('Approve')}>Approve</button><button className="button secondary" onClick={() => onDecision('Request Revision')}>Request revision</button><button className="button warning" onClick={() => onDecision('Return for Correction')}>Return for correction</button><button className="button danger ghost" onClick={() => onDecision('Reject')}>Reject</button></div>
}

export function ApprovalMatrix() {
  const rows = [
    ['SOP', 'Document Owner', 'Technical Reviewer', 'QA + Site Head'],
    ['Policy', 'Policy Owner', 'Legal + QA', 'Executive Approver'],
    ['Form', 'Process Owner', 'QA Reviewer', 'QA Approver'],
  ]
  return <div className="table-wrap compact"><table><thead><tr><th>Type</th><th>Initiator</th><th>Review</th><th>Approval</th></tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>
}

export function TaskQueue({ steps }: { steps: WorkflowStep[] }) {
  return <div className="task-list">{steps.map((step) => <article key={step.id}><div><strong>{step.role}: SOP-104</strong><p>{step.assignee} · Due {formatDate(step.dueDate)}</p></div><StatusBadge status={step.status} tone={statusTone(step.status)} /></article>)}</div>
}

