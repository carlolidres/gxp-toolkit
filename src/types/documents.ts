export type DocumentStatus =
  | 'Draft'
  | 'For Review'
  | 'Returned for Correction'
  | 'For Approval'
  | 'Approved'
  | 'Effective'
  | 'Superseded'
  | 'Obsolete'
  | 'Archived'
  | 'Rejected'
  | 'Signed'
  | 'Partially Signed'
  | 'Pending Signature'

export type SignatureStatus =
  | 'Not Started'
  | 'Pending Signature'
  | 'Partially Signed'
  | 'Signed'
  | 'Declined'
  | 'Expired'
  | 'Cancelled'

export interface DocumentRecord {
  id: string
  code: string
  title: string
  category: string
  owner: string
  version: string
  status: DocumentStatus
  effectiveDate: string
  reviewDate: string
  expiryDate?: string
  controlledCopy: boolean
}

export interface WorkflowStep {
  id: string
  role: 'Document Owner' | 'Reviewer' | 'Approver' | 'QA' | 'Admin' | 'Viewer'
  assignee: string
  status: 'Pending' | 'In Progress' | 'Approved' | 'Rejected' | 'Returned'
  dueDate: string
  comments?: string
}

export interface SignatureRequest {
  id: string
  documentId: string
  documentTitle: string
  recipient: string
  role: string
  status: SignatureStatus
  requestedAt: string
  completedAt?: string
}

