import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase'
import type {
  EdocActionResult,
  EdocAuditEvent,
  EdocCreateDraftInput,
  EdocDashboardMetrics,
  EdocDocumentListItem,
  EdocDocumentStatus,
  EdocInboxTask,
} from './types'

interface ProfileOption {
  id: string
  displayName: string
  email: string
}

const nowIso = new Date().toISOString()

const mockDocuments: EdocDocumentListItem[] = [
  {
    id: 'edoc-demo-001',
    documentNumber: 'EDOC-DEMO-001',
    title: 'Demo Batch Record Review',
    status: 'awaiting_action',
    ownerName: 'Quality Systems',
    department: 'QA',
    versionNumber: 1,
    priority: 'high',
    dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    updatedAt: nowIso,
  },
  {
    id: 'edoc-demo-002',
    documentNumber: 'EDOC-DEMO-002',
    title: 'Returned SOP Revision',
    status: 'returned',
    ownerName: 'Validation',
    department: 'Validation',
    versionNumber: 2,
    priority: 'normal',
    dueAt: null,
    updatedAt: nowIso,
  },
]

const mockTasks: EdocInboxTask[] = [
  {
    id: 'edoc-task-demo-001',
    documentId: 'edoc-demo-001',
    routeId: 'edoc-route-demo-001',
    stepId: 'edoc-step-demo-001',
    versionId: 'edoc-version-demo-001',
    documentTitle: 'Demo Batch Record Review',
    documentNumber: 'EDOC-DEMO-001',
    action: 'review',
    status: 'active',
    dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    ownerName: 'Quality Systems',
    versionSha256: null,
  },
]

function emptyMetrics(): EdocDashboardMetrics {
  return {
    awaitingMyAction: 0,
    pendingReview: 0,
    pendingApproval: 0,
    pendingSignature: 0,
    pendingAcknowledgment: 0,
    drafts: 0,
    inRouting: 0,
    dueSoon: 0,
    overdue: 0,
    returned: 0,
    rejected: 0,
    completed: 0,
  }
}

function calculateMetrics(documents: EdocDocumentListItem[], tasks: EdocInboxTask[]): EdocDashboardMetrics {
  const today = Date.now()
  const dueSoonCutoff = today + 7 * 86400000
  return {
    ...emptyMetrics(),
    awaitingMyAction: tasks.filter((task) => task.status === 'active').length,
    pendingReview: tasks.filter((task) => task.action === 'review' && task.status === 'active').length,
    pendingApproval: tasks.filter((task) => task.action === 'approve' && task.status === 'active').length,
    pendingSignature: tasks.filter((task) => task.action === 'sign' && task.status === 'active').length,
    pendingAcknowledgment: tasks.filter((task) => task.action === 'acknowledge' && task.status === 'active').length,
    drafts: documents.filter((document) => document.status === 'draft' || document.status === 'preparing').length,
    inRouting: documents.filter((document) => document.status === 'in_routing' || document.status === 'awaiting_action').length,
    dueSoon: documents.filter((document) => {
      if (!document.dueAt) return false
      const time = new Date(document.dueAt).getTime()
      return time >= today && time <= dueSoonCutoff
    }).length,
    overdue: documents.filter((document) => document.dueAt && new Date(document.dueAt).getTime() < today).length,
    returned: documents.filter((document) => document.status === 'returned').length,
    rejected: documents.filter((document) => document.status === 'rejected').length,
    completed: documents.filter((document) => document.status === 'completed').length,
  }
}

function requireClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase is not configured.')
  return client
}

async function currentProfileId(): Promise<string> {
  const client = requireClient()
  const { data, error } = await client.rpc('current_profile_id')
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Current profile is not available.')
  return String(data)
}

function normalizeStatus(value: unknown): EdocDocumentStatus {
  const status = String(value || 'draft')
  const allowed: EdocDocumentStatus[] = [
    'draft',
    'preparing',
    'ready_for_routing',
    'in_routing',
    'awaiting_action',
    'returned',
    'rejected',
    'completed',
    'cancelled',
    'expired',
    'archived',
  ]
  return allowed.includes(status as EdocDocumentStatus) ? (status as EdocDocumentStatus) : 'draft'
}

export const edocService = {
  usesSupabase(): boolean {
    return isSupabaseConfigured()
  },

  async listDocuments(scope: 'my' | 'all' | 'returned' | 'completed' = 'all'): Promise<EdocDocumentListItem[]> {
    if (!isSupabaseConfigured()) {
      return mockDocuments.filter((document) => {
        if (scope === 'returned') return document.status === 'returned'
        if (scope === 'completed') return document.status === 'completed'
        return true
      })
    }

    const client = requireClient()
    const profileId = await currentProfileId()
    let query = client
      .from('edoc_documents')
      .select('id, document_number, title, status, owner_id, department_name, current_version_number, priority, due_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(100)

    if (scope === 'my') query = query.eq('owner_id', profileId)
    if (scope === 'returned') query = query.eq('status', 'returned')
    if (scope === 'completed') query = query.eq('status', 'completed')

    const { data, error } = await query
    if (error) throw new Error(error.message)

    return (data ?? []).map((row) => ({
      id: row.id,
      documentNumber: row.document_number,
      title: row.title,
      status: normalizeStatus(row.status),
      ownerName: row.owner_id,
      department: row.department_name ?? '',
      versionNumber: Number(row.current_version_number ?? 1),
      priority: row.priority ?? 'normal',
      dueAt: row.due_at,
      updatedAt: row.updated_at,
    }))
  },

  async getDashboard(): Promise<EdocDashboardMetrics> {
    const documents = await this.listDocuments('all')
    const tasks = await this.listInboxTasks()
    return calculateMetrics(documents, tasks)
  },

  async listInboxTasks(): Promise<EdocInboxTask[]> {
    if (!isSupabaseConfigured()) return mockTasks

    const client = requireClient()
    const profileId = await currentProfileId()
    const { data, error } = await client
      .from('edoc_assignment_inbox')
      .select('*')
      .eq('assignee_id', profileId)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(100)

    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => ({
      id: row.assignment_id,
      documentId: row.document_id,
      routeId: row.route_id,
      stepId: row.step_id,
      versionId: row.version_id,
      documentTitle: row.document_title,
      documentNumber: row.document_number,
      action: row.action,
      status: row.assignment_status,
      dueAt: row.due_at,
      ownerName: row.owner_name ?? row.owner_id,
      versionSha256: row.version_sha256,
    }))
  },

  async listProfiles(): Promise<ProfileOption[]> {
    if (!isSupabaseConfigured()) {
      return [
        { id: 'mock-reviewer', displayName: 'Demo Reviewer', email: 'reviewer@example.test' },
        { id: 'mock-approver', displayName: 'Demo Approver', email: 'approver@example.test' },
      ]
    }

    const client = requireClient()
    const { data, error } = await client
      .from('profiles')
      .select('id, display_name, email')
      .eq('active', true)
      .order('display_name', { ascending: true })

    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      email: row.email,
    }))
  },

  async createAndSendDraft(input: EdocCreateDraftInput): Promise<{ documentId: string; routeId: string }> {
    if (!isSupabaseConfigured()) {
      return { documentId: `mock-doc-${Date.now()}`, routeId: `mock-route-${Date.now()}` }
    }

    const client = requireClient()
    const { data, error } = await client.rpc('edoc_create_and_start_route', {
      p_payload: input,
    })
    if (error) throw new Error(error.message)
    const result = data as { document_id?: string; route_id?: string } | null
    if (!result?.document_id || !result.route_id) {
      throw new Error('eDoc route creation did not return identifiers.')
    }
    return { documentId: result.document_id, routeId: result.route_id }
  },

  async completeAssignment(input: {
    routeId: string
    assignmentId: string
    action: 'review' | 'approve' | 'acknowledge' | 'return' | 'reject'
    reason?: string
    comment?: string
  }): Promise<EdocActionResult> {
    if (!isSupabaseConfigured()) {
      return {
        ok: true,
        routeCompleted: false,
        documentStatus: input.action === 'return' ? 'returned' : 'awaiting_action',
        message: 'Mock assignment action recorded.',
      }
    }

    const client = requireClient()
    const { data, error } = await client.rpc('edoc_advance_route', {
      p_route_id: input.routeId,
      p_assignment_id: input.assignmentId,
      p_action: input.action,
      p_reason: input.reason ?? null,
      p_comment: input.comment ?? null,
    })
    if (error) throw new Error(error.message)
    return data as EdocActionResult
  },

  async signAssignment(input: {
    documentId: string
    assignmentId: string
    password: string
    consent: boolean
    signatureMeaning: string
    typedSignature: string
    versionSha256: string
  }): Promise<EdocActionResult> {
    if (!isSupabaseConfigured()) {
      return {
        ok: true,
        routeCompleted: true,
        documentStatus: 'completed',
        message: 'Mock signature completed.',
      }
    }

    const client = requireClient()
    const { data, error } = await client.functions.invoke('edoc-sign-document', {
      body: input,
    })
    if (error) throw new Error(error.message)
    return data as EdocActionResult
  },

  async listAuditEvents(documentId?: string): Promise<EdocAuditEvent[]> {
    if (!isSupabaseConfigured()) {
      return [
        {
          id: 'mock-audit-1',
          eventType: 'document_created',
          entityType: 'document',
          entityId: 'edoc-demo-001',
          documentId: 'edoc-demo-001',
          userName: 'Mock user',
          reason: null,
          createdAt: nowIso,
        },
      ]
    }

    const client = requireClient()
    let query = client
      .from('edoc_audit_events')
      .select('id, event_type, entity_type, entity_id, document_id, actor_name, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (documentId) query = query.eq('document_id', documentId)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      documentId: row.document_id,
      userName: row.actor_name ?? 'System',
      reason: row.reason,
      createdAt: row.created_at,
    }))
  },
}

