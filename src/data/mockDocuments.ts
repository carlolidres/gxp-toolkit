import type { DocumentRecord, SignatureRequest, WorkflowStep } from '../types/documents'

export const mockDocuments: DocumentRecord[] = [
  { id: 'd1', code: 'SOP-104', title: 'Batch Record Review', category: 'Standard Operating Procedure', owner: 'Maya Chen', version: '4.0', status: 'For Approval', effectiveDate: '2026-07-01', reviewDate: '2027-07-01', controlledCopy: true },
  { id: 'd2', code: 'QMS-220', title: 'Deviation Management', category: 'Quality Manual', owner: 'Jordan Lee', version: '2.1', status: 'Effective', effectiveDate: '2026-02-15', reviewDate: '2027-02-15', controlledCopy: true },
  { id: 'd3', code: 'FRM-088', title: 'Equipment Cleaning Log', category: 'Form', owner: 'Priya Shah', version: '1.3', status: 'For Review', effectiveDate: '2026-08-01', reviewDate: '2027-08-01', controlledCopy: false },
  { id: 'd4', code: 'POL-012', title: 'Electronic Records Policy', category: 'Policy', owner: 'Alex Brooks', version: '3.0', status: 'Pending Signature', effectiveDate: '2026-09-01', reviewDate: '2027-09-01', controlledCopy: true },
  { id: 'd5', code: 'WI-450', title: 'Line Clearance', category: 'Work Instruction', owner: 'Sam Rivera', version: '5.2', status: 'Superseded', effectiveDate: '2025-01-10', reviewDate: '2026-01-10', expiryDate: '2026-08-01', controlledCopy: false },
]

export const mockWorkflow: WorkflowStep[] = [
  { id: 'w1', role: 'Document Owner', assignee: 'Maya Chen', status: 'Approved', dueDate: '2026-06-08', comments: 'Draft submitted.' },
  { id: 'w2', role: 'Reviewer', assignee: 'Jordan Lee', status: 'Approved', dueDate: '2026-06-11', comments: 'Technical review complete.' },
  { id: 'w3', role: 'QA', assignee: 'Priya Shah', status: 'In Progress', dueDate: '2026-06-15' },
  { id: 'w4', role: 'Approver', assignee: 'Alex Brooks', status: 'Pending', dueDate: '2026-06-18' },
]

export const mockSignatures: SignatureRequest[] = [
  { id: 's1', documentId: 'd4', documentTitle: 'Electronic Records Policy', recipient: 'Jordan Lee', role: 'Policy Owner', status: 'Signed', requestedAt: '2026-06-10', completedAt: '2026-06-11' },
  { id: 's2', documentId: 'd4', documentTitle: 'Electronic Records Policy', recipient: 'Priya Shah', role: 'Quality Approver', status: 'Pending Signature', requestedAt: '2026-06-10' },
  { id: 's3', documentId: 'd4', documentTitle: 'Electronic Records Policy', recipient: 'Alex Brooks', role: 'Final Approver', status: 'Not Started', requestedAt: '2026-06-10' },
]

