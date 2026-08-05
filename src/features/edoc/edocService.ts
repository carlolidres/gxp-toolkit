import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase'
import { notifyEdocInboxChanged } from './edocInboxSync'
import { isEdocIntegrityPackageComplete } from './pageIntegrity'
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
  organization?: string | null
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

async function resolveProfileLabels(profileIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(profileIds.filter(Boolean))]
  const labels = new Map<string, string>()
  if (uniqueIds.length === 0) return labels

  const client = requireClient()
  const { data, error } = await client.rpc('edoc_profile_labels', { p_profile_ids: uniqueIds })
  if (error) throw new Error(error.message)
  for (const row of data ?? []) {
    labels.set(String(row.id), String(row.display_name))
  }
  return labels
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

    const ownerLabels = await resolveProfileLabels((data ?? []).map((row) => row.owner_id))
    return (data ?? []).map((row) => ({
      id: row.id,
      documentNumber: row.document_number,
      title: row.title,
      status: normalizeStatus(row.status),
      ownerName: ownerLabels.get(row.owner_id) ?? row.owner_id,
      department: row.department_name ?? '',
      versionNumber: Number(row.current_version_number ?? 1),
      priority: row.priority ?? 'normal',
      dueAt: row.due_at,
      updatedAt: row.updated_at,
    }))
  },

  async getDocument(documentId: string): Promise<EdocDocumentListItem | null> {
    if (!isSupabaseConfigured()) {
      return mockDocuments.find((document) => document.id === documentId) ?? null
    }

    const client = requireClient()
    const { data, error } = await client
      .from('edoc_documents')
      .select('id, document_number, title, status, owner_id, department_name, current_version_number, priority, due_at, updated_at')
      .eq('id', documentId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null

    const ownerLabels = await resolveProfileLabels([data.owner_id])
    return {
      id: data.id,
      documentNumber: data.document_number,
      title: data.title,
      status: normalizeStatus(data.status),
      ownerName: ownerLabels.get(data.owner_id) ?? data.owner_id,
      department: data.department_name ?? '',
      versionNumber: Number(data.current_version_number ?? 1),
      priority: data.priority ?? 'normal',
      dueAt: data.due_at,
      updatedAt: data.updated_at,
    }
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
    return (data ?? [])
      .filter((row) => row.assignment_status === 'active')
      .map((row) => ({
      id: row.assignment_id,
      documentId: row.document_id,
      routeId: row.route_id,
      stepId: row.step_id,
      versionId: row.version_id,
      documentTitle: row.document_title,
      documentNumber: row.document_number,
      action: row.action,
      stepKind: row.step_kind === 'external_auth' ? 'external_auth' : 'signatory',
      status: row.assignment_status,
      dueAt: row.due_at,
      ownerName: row.owner_name ?? row.owner_id,
      versionSha256: row.version_sha256,
    }))
  },

  async listProfiles(): Promise<ProfileOption[]> {
    if (!isSupabaseConfigured()) {
      return [
        { id: 'mock-reviewer', displayName: 'Demo Reviewer', email: 'reviewer@example.test', organization: 'Acme' },
        { id: 'mock-approver', displayName: 'Demo Approver', email: 'approver@example.test', organization: 'Beta' },
      ]
    }

    const client = requireClient()
    // profiles RLS is own-row (or admin). Use org-scoped SECURITY DEFINER RPC for assignee pickers.
    const { data, error } = await client.rpc('edoc_list_assignable_profiles')

    if (error) throw new Error(error.message)
    return (data ?? []).map((row: {
      id: string
      display_name: string
      email: string
      organization: string | null
    }) => ({
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      organization: row.organization ?? null,
    }))
  },

  async listOrgDocumentControllers(): Promise<Array<{ profileId: string; displayName: string; email: string }>> {
    if (!isSupabaseConfigured()) return []
    const client = requireClient()
    const { data, error } = await client.rpc('edoc_list_org_document_controllers')
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: { profile_id: string; display_name: string; email: string }) => ({
      profileId: row.profile_id,
      displayName: row.display_name,
      email: row.email,
    }))
  },

  async listMissingControllerWarnings(): Promise<
    Array<{ organizationLabel: string; memberCount: number; edocOrganizationId: string | null }>
  > {
    if (!isSupabaseConfigured()) return []
    const client = requireClient()
    const { data, error } = await client.rpc('edoc_admin_missing_controller_warnings')
    if (error) throw new Error(error.message)
    return (data ?? []).map(
      (row: {
        organization_label: string
        member_count: number | string
        edoc_organization_id: string | null
      }) => ({
        organizationLabel: row.organization_label,
        memberCount: Number(row.member_count),
        edocOrganizationId: row.edoc_organization_id,
      }),
    )
  },

  async createAndSendDraft(
    input: EdocCreateDraftInput,
    pdfBytes?: ArrayBuffer | null,
  ): Promise<{
    documentId: string
    routeId: string
    versionId: string | null
    fileId: string | null
    activeAssignmentId: string | null
  }> {
    if (!isSupabaseConfigured()) {
      notifyEdocInboxChanged()
      return {
        documentId: `mock-doc-${Date.now()}`,
        routeId: `mock-route-${Date.now()}`,
        versionId: `mock-version-${Date.now()}`,
        fileId: `mock-file-${Date.now()}`,
        activeAssignmentId: 'edoc-task-demo-001',
      }
    }

    const client = requireClient()
    const { data, error } = await client.rpc('edoc_create_and_start_route', {
      p_payload: input,
    })
    if (error) throw new Error(error.message)
    const result = data as {
      document_id?: string
      route_id?: string
      version_id?: string | null
      file_id?: string | null
      bucket_id?: string | null
      object_key?: string | null
      active_assignment_id?: string | null
    } | null
    if (!result?.document_id || !result.route_id) {
      throw new Error('eDoc route creation did not return identifiers.')
    }

    if (pdfBytes && result.bucket_id && result.object_key) {
      const blob = new Blob([pdfBytes], { type: input.file?.mimeType || 'application/pdf' })
      const { error: uploadError } = await client.storage
        .from(result.bucket_id)
        .upload(result.object_key, blob, {
          contentType: input.file?.mimeType || 'application/pdf',
          upsert: true,
        })
      if (uploadError) {
        throw new Error(`Document route was created, but PDF upload failed: ${uploadError.message}`)
      }
    }

    notifyEdocInboxChanged()
    return {
      documentId: result.document_id,
      routeId: result.route_id,
      versionId: result.version_id ?? null,
      fileId: result.file_id ?? null,
      activeAssignmentId: result.active_assignment_id ?? null,
    }
  },

  async getDocumentOriginalFile(documentId: string): Promise<{
    id: string
    bucketId: string
    objectKey: string
    fileName: string
    fileRole?: string
  } | null> {
    if (!isSupabaseConfigured()) return null

    const client = requireClient()
    const { data, error } = await client
      .from('edoc_document_files')
      .select('id, bucket_id, object_key, file_name, file_role')
      .eq('document_id', documentId)
      .eq('file_role', 'original')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null
    return {
      id: data.id,
      bucketId: data.bucket_id,
      objectKey: data.object_key,
      fileName: data.file_name,
      fileRole: data.file_role,
    }
  },

  /** Prefer Final Signed PDF (certificate) → latest signed → original. */
  async getPreferredDocumentFile(
    documentId: string,
    options?: {
      forSigning?: boolean
      preferSha256?: string | null
      preferObjectKey?: string | null
    },
  ): Promise<{
    id: string
    bucketId: string
    objectKey: string
    fileName: string
    fileRole: string
    label: string
    sha256: string | null
  } | null> {
    if (!isSupabaseConfigured()) return null
    const client = requireClient()
    const { data, error } = await client
      .from('edoc_document_files')
      .select('id, bucket_id, object_key, file_name, file_role, sha256, created_at')
      .eq('document_id', documentId)
      .in('file_role', ['certificate', 'signed', 'original'])
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    const rows = data ?? []
    const preferSha = options?.preferSha256?.trim().toLowerCase() || null
    const preferKey = options?.preferObjectKey?.trim() || null

    const byDigest = preferSha
      ? rows.find((row) => (row.sha256 || '').toLowerCase() === preferSha)
      : null
    const byObjectKey = preferKey
      ? rows.find((row) => row.object_key === preferKey)
      : null

    const certificate = rows.find((row) => row.file_role === 'certificate')
    // Signing must follow the live content chain (signed → original), never the final package.
    const signedForChain = rows.find((row) => (
      row.file_role === 'signed'
      && !String(row.object_key).includes('final-completed-')
    )) ?? rows.find((row) => row.file_role === 'signed')
    const original = rows.find((row) => row.file_role === 'original')
    const chosen = options?.forSigning
      ? (signedForChain ?? original)
      : (byDigest ?? byObjectKey ?? certificate ?? signedForChain ?? original)
    if (!chosen) return null
    return {
      id: chosen.id,
      bucketId: chosen.bucket_id,
      objectKey: chosen.object_key,
      fileName: chosen.file_name,
      fileRole: chosen.file_role,
      sha256: chosen.sha256 ?? null,
      label:
        chosen.file_role === 'certificate'
          ? 'Final Signed PDF'
          : chosen.file_role === 'signed'
            ? 'Signed PDF'
            : 'Original PDF',
    }
  },

  async getCompletionCertificateMeta(documentId: string): Promise<{
    pageCount: number | null
    contentPageCount: number | null
    verificationCode: string | null
    finalPdfSha256: string | null
    objectKey: string | null
    hasPageIntegrity: boolean
  } | null> {
    if (!isSupabaseConfigured()) return null
    const client = requireClient()
    const { data, error } = await client
      .from('edoc_completion_certificates')
      .select('id, page_count, content_page_count, verification_code, final_pdf_sha256, object_key, status')
      .eq('document_id', documentId)
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    if (data.status === 'generating') {
      return {
        pageCount: data.page_count ?? null,
        contentPageCount: data.content_page_count ?? null,
        verificationCode: data.verification_code ?? null,
        finalPdfSha256: data.final_pdf_sha256 ?? null,
        objectKey: data.object_key ?? null,
        hasPageIntegrity: false,
      }
    }
    const { count, error: integrityError } = await client
      .from('edoc_page_integrity_codes')
      .select('id', { count: 'exact', head: true })
      .eq('certificate_id', data.id)
    if (integrityError) throw new Error(integrityError.message)
    return {
      pageCount: data.page_count ?? null,
      contentPageCount: data.content_page_count ?? null,
      verificationCode: data.verification_code ?? null,
      finalPdfSha256: data.final_pdf_sha256 ?? null,
      objectKey: data.object_key ?? null,
      hasPageIntegrity: isEdocIntegrityPackageComplete(count ?? 0, data.content_page_count),
    }
  },

  async requestFileAccess(fileId: string, accessType: 'preview' | 'download' = 'preview'): Promise<{
    signedUrl: string
    expiresInSeconds: number
  }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured for file access.')
    }

    const client = requireClient()
    const { data, error } = await client.functions.invoke('edoc-file-access', {
      body: { fileId, accessType },
    })
    if (error) {
      const context = (error as { context?: Response }).context
      if (context && typeof context.json === 'function') {
        try {
          const payload = (await context.json()) as { error?: string; message?: string }
          const detail = payload.error || payload.message
          if (detail) throw new Error(detail)
        } catch (parseError) {
          if (parseError instanceof Error && parseError.message !== error.message) throw parseError
        }
      }
      throw new Error(error.message || 'Could not request PDF file access.')
    }
    const payload = data as { signedUrl?: string; expiresInSeconds?: number; error?: string } | null
    if (payload?.error) throw new Error(payload.error)
    if (!payload?.signedUrl) throw new Error('Signed file URL was not returned.')
    return {
      signedUrl: payload.signedUrl,
      expiresInSeconds: payload.expiresInSeconds ?? 300,
    }
  },

  async loadDocumentPdfBytes(
    documentId: string,
    options?: { forSigning?: boolean },
  ): Promise<ArrayBuffer> {
    const file =
      (await this.getPreferredDocumentFile(documentId, options)) ??
      (await this.getDocumentOriginalFile(documentId))
    if (!file) throw new Error('No PDF is registered for this document.')
    const access = await this.requestFileAccess(file.id, 'preview')
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 60_000)
    try {
      const response = await fetch(access.signedUrl, { signal: controller.signal })
      if (!response.ok) throw new Error(`Could not download the PDF (HTTP ${response.status}).`)
      const buffer = await response.arrayBuffer()
      if (buffer.byteLength < 5) throw new Error('Downloaded PDF is empty.')
      return buffer
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('PDF download timed out. Check your connection and try again.')
      }
      throw err
    } finally {
      window.clearTimeout(timer)
    }
  },

  async finalizeDocument(routeId: string): Promise<{ ok: boolean; idempotent?: boolean; error?: string; verificationCode?: string }> {
    if (!isSupabaseConfigured()) return { ok: true, idempotent: true }
    const client = requireClient()
    const { data, error } = await client.functions.invoke('edoc-finalize-document', {
      body: { routeId },
    })
    if (error) {
      const context = (error as { context?: Response }).context
      if (context && typeof context.json === 'function') {
        try {
          const payload = (await context.json()) as { error?: string }
          if (payload.error) return { ok: false, error: payload.error }
        } catch {
          // fall through
        }
      }
      return { ok: false, error: error.message }
    }
    const payload = data as { error?: string; idempotent?: boolean; verification_code?: string } | null
    if (payload?.error) return { ok: false, error: payload.error }
    return {
      ok: true,
      idempotent: Boolean(payload?.idempotent),
      verificationCode: payload?.verification_code,
    }
  },

  /** Finalize the latest completed route for a document (integrity PDF + verify code). */
  async finalizeCompletedDocument(documentId: string): Promise<{
    ok: boolean
    idempotent?: boolean
    error?: string
    verificationCode?: string
  }> {
    if (!isSupabaseConfigured()) return { ok: true, idempotent: true }
    const client = requireClient()
    const { data: route, error } = await client
      .from('edoc_document_routes')
      .select('id')
      .eq('document_id', documentId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!route?.id) return { ok: false, error: 'No completed route found for this document.' }
    return this.finalizeDocument(route.id)
  },

  async adminDeleteDocument(documentId: string): Promise<{
    ok: boolean
    documentNumber?: string | null
    title?: string | null
    message?: string
  }> {
    if (!isSupabaseConfigured()) {
      return { ok: true, message: 'Mock document deleted.' }
    }
    const client = requireClient()
    const { data, error } = await client.functions.invoke('edoc-admin-delete-document', {
      body: { documentId },
    })
    if (error) {
      const context = (error as { context?: Response }).context
      if (context && typeof context.json === 'function') {
        try {
          const payload = (await context.json()) as { error?: string; message?: string }
          const detail = payload.error || payload.message
          if (detail) throw new Error(detail)
        } catch (parseError) {
          if (parseError instanceof Error && parseError.message !== error.message) throw parseError
        }
      }
      throw new Error(error.message)
    }
    const payload = data as {
      ok?: boolean
      error?: string
      documentNumber?: string | null
      title?: string | null
      storageErrors?: string[]
    } | null
    if (payload?.error) throw new Error(payload.error)
    const storageNote = payload?.storageErrors?.length
      ? ` Storage cleanup warnings: ${payload.storageErrors.join('; ')}`
      : ''
    return {
      ok: true,
      documentNumber: payload?.documentNumber ?? null,
      title: payload?.title ?? null,
      message: `Document permanently deleted.${storageNote}`,
    }
  },

  async completeAssignment(input: {
    routeId: string
    assignmentId: string
    action: 'review' | 'approve' | 'acknowledge' | 'return' | 'reject'
    reason?: string
    comment?: string
  }): Promise<EdocActionResult> {
    if (input.action === 'review') {
      throw new Error(
        'Reviewed-by tasks must be completed with an electronic signature (Sign document).',
      )
    }
    if (!isSupabaseConfigured()) {
      notifyEdocInboxChanged()
      return {
        ok: true,
        routeCompleted: false,
        documentStatus: input.action === 'return' ? 'returned' : 'awaiting_action',
        message: 'Mock assignment action recorded.',
      }
    }

    const client = requireClient()
    const optionalNote = input.comment?.trim() || ''
    const { data, error } = await client.rpc('edoc_advance_route', {
      p_route_id: input.routeId,
      p_assignment_id: input.assignmentId,
      p_action: input.action,
      p_reason: input.reason ?? null,
      p_comment: optionalNote || null,
    })
    if (error) throw new Error(error.message)
    const result = data as EdocActionResult

    // Optional note is stored on step_actions; also surface it in the audit timeline.
    if (optionalNote) {
      const { data: routeRow } = await client
        .from('edoc_document_routes')
        .select('organization_id, document_id, version_id')
        .eq('id', input.routeId)
        .maybeSingle()
      if (routeRow) {
        const { error: noteError } = await client.rpc('edoc_create_audit_event', {
          p_organization_id: routeRow.organization_id,
          p_event_type: 'signer_note',
          p_entity_type: 'assignment',
          p_entity_id: input.assignmentId,
          p_document_id: routeRow.document_id,
          p_version_id: routeRow.version_id,
          p_reason: optionalNote.slice(0, 2000),
          p_previous_value: null,
          p_new_value: { source: 'optional_note', action: input.action },
        })
        if (noteError) {
          console.warn('Optional note audit event failed:', noteError.message)
        }
      }
    }

    if (result.routeCompleted) {
      const finalized = await this.finalizeDocument(input.routeId)
      if (!finalized.ok) {
        notifyEdocInboxChanged()
        return {
          ...result,
          message: `${result.message ?? 'Route completed.'} Final PDF generation pending: ${finalized.error ?? 'retry later'}.`,
        }
      }
    }
    notifyEdocInboxChanged()
    return result
  },

  async signAssignment(input: {
    documentId: string
    assignmentId: string
    password: string
    consent: boolean
    signatureMeaning: string
    typedSignature: string
    versionSha256: string
    comment?: string
  }): Promise<EdocActionResult> {
    if (!isSupabaseConfigured()) {
      notifyEdocInboxChanged()
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
    if (error) {
      const context = (error as { context?: Response }).context
      if (context && typeof context.json === 'function') {
        try {
          const payload = (await context.json()) as { error?: string; message?: string }
          const detail = payload.error || payload.message
          if (detail) throw new Error(detail)
        } catch (parseError) {
          if (parseError instanceof Error && parseError.message !== error.message) throw parseError
        }
      }
      throw new Error(error.message)
    }
    const payload = data as (EdocActionResult & {
      error?: string
      finalize?: { error?: string; verification_code?: string; idempotent?: boolean }
      fieldLayout?: { adjusted?: boolean; message?: string | null }
    }) | null
    if (payload?.error) throw new Error(payload.error)

    // Edge finalize is the primary writer; client retries only when edge failed or package incomplete.
    let finalizeNote: string | undefined
    if (payload?.routeCompleted) {
      const edgeFailed = Boolean(
        !payload.finalize
        || (typeof payload.finalize === 'object' && payload.finalize && 'error' in payload.finalize && payload.finalize.error),
      )
      const cert = await this.getCompletionCertificateMeta(input.documentId)
      const incomplete = !cert?.hasPageIntegrity || !cert.verificationCode || !cert.finalPdfSha256
      if (edgeFailed || incomplete) {
        const finalized = await this.finalizeCompletedDocument(input.documentId)
        if (!finalized.ok) {
          finalizeNote = `Final PDF generation pending: ${finalized.error ?? 'retry later'}.`
        }
      }
    }

    notifyEdocInboxChanged()
    return {
      ...(payload as EdocActionResult),
      message: [payload?.message, finalizeNote].filter(Boolean).join(' ') || 'Signature recorded.',
      fieldLayout: payload?.fieldLayout
        ? {
            adjusted: Boolean(payload.fieldLayout.adjusted),
            message: payload.fieldLayout.message ?? null,
          }
        : undefined,
    }
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

