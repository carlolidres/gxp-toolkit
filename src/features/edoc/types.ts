export type EdocDocumentStatus =
  | 'draft'
  | 'preparing'
  | 'ready_for_routing'
  | 'in_routing'
  | 'awaiting_action'
  | 'returned'
  | 'rejected'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'archived'

export type EdocRouteAction =
  | 'review'
  | 'approve'
  | 'sign'
  | 'acknowledge'
  | 'return'
  | 'reject'
  | 'delegate'
  | 'cancel'

export type EdocAssignableAction = Extract<
  EdocRouteAction,
  'review' | 'approve' | 'sign' | 'acknowledge'
>

export type EdocRoutingMode = 'sequential' | 'parallel' | 'mixed'
export type EdocCompletionRule = 'all' | 'any' | 'majority' | 'minimum_count'
export type EdocStepStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'rejected'
  | 'returned'
  | 'skipped'
  | 'invalidated'
export type EdocAssigneeStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'rejected'
  | 'returned'
  | 'delegated'
  | 'invalidated'

export type EdocPriority = 'low' | 'normal' | 'high' | 'urgent'

export type EdocFieldType =
  | 'signature'
  | 'initial'
  | 'date_signed'
  | 'name'
  | 'job_title'
  | 'text'
  | 'approval_meaning'
  | 'review_meaning'
  | 'acknowledgment'
  | 'checkbox'

export interface EdocDocumentListItem {
  id: string
  documentNumber: string
  title: string
  status: EdocDocumentStatus
  ownerName: string
  department: string
  versionNumber: number
  priority: EdocPriority
  dueAt: string | null
  updatedAt: string
}

export interface EdocDashboardMetrics {
  awaitingMyAction: number
  pendingReview: number
  pendingApproval: number
  pendingSignature: number
  pendingAcknowledgment: number
  drafts: number
  inRouting: number
  dueSoon: number
  overdue: number
  returned: number
  rejected: number
  completed: number
}

export interface EdocInboxTask {
  id: string
  documentId: string
  routeId: string
  stepId: string
  versionId: string
  documentTitle: string
  documentNumber: string
  action: EdocAssignableAction
  status: EdocAssigneeStatus
  dueAt: string | null
  ownerName: string
  versionSha256: string | null
}

export interface EdocRouteStepDraft {
  id: string
  groupId: string
  sequence: number
  action: EdocAssignableAction
  assigneeIds: string[]
  completionRule: EdocCompletionRule
  minimumCount: number | null
  dueAt: string
  allowDelegation: boolean
}

export interface EdocFieldDraft {
  id: string
  assigneeDraftId: string
  fieldType: EdocFieldType
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
  required: boolean
}

export interface EdocCreateDraftInput {
  metadata: {
    documentNumber: string
    title: string
    description: string
    documentType: string
    category: string
    department: string
    businessUnit: string
    confidentiality: string
    priority: EdocPriority
    dueAt: string
    tags: string[]
    retentionClass: string
  }
  file: {
    name: string
    sizeBytes: number
    mimeType: string
    sha256: string
  } | null
  routing: {
    mode: EdocRoutingMode
    steps: EdocRouteStepDraft[]
  }
  fields: EdocFieldDraft[]
}

export interface EdocActionResult {
  ok: boolean
  routeCompleted: boolean
  documentStatus: EdocDocumentStatus
  message: string
}

export interface EdocAuditEvent {
  id: string
  eventType: string
  entityType: string
  entityId: string | null
  documentId: string | null
  userName: string
  reason: string | null
  createdAt: string
}

