import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  decodeSignatureAppearanceBytes,
  displayTimezoneLabel,
  formatSigningDateLabel,
  sha256Hex,
  stampFieldsOntoPdf,
  type StampField,
} from '../_shared/edocPdfStamp.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_MEANINGS = new Set([
  'I prepared this document.',
  'I reviewed this document.',
  'I approve this document.',
  'I acknowledge receipt and understanding of this document.',
  'I verified the accuracy and completeness of this document.',
])

const REVIEWED_SIGNATURE_MEANING = 'I reviewed this document.'
const APPROVED_SIGNATURE_MEANING = 'I approve this document.'
const ACKNOWLEDGED_SIGNATURE_MEANING =
  'I acknowledge receipt and understanding of this document.'

const SIGNATORY_ESIGN_ACTIONS = new Set(['sign', 'review', 'approve', 'acknowledge'])

function lockedMeaningForAction(action: string): string | null {
  if (action === 'review') return REVIEWED_SIGNATURE_MEANING
  if (action === 'approve') return APPROVED_SIGNATURE_MEANING
  if (action === 'acknowledge') return ACKNOWLEDGED_SIGNATURE_MEANING
  return null
}

function advanceReasonForAction(action: string, signerName: string, meaning: string): string {
  if (action === 'review') {
    return `Document reviewed and electronically signed by ${signerName}. Reason: ${meaning}`
  }
  if (action === 'approve') {
    return `Document approved and electronically signed by ${signerName}. Reason: ${meaning}`
  }
  if (action === 'acknowledge') {
    return `Document acknowledged and electronically signed by ${signerName}. Reason: ${meaning}`
  }
  return meaning
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'Edge function is missing Supabase credentials' }, 500)
    }
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const body = await req.json()

    if (!body.consent) return json({ error: 'Explicit consent is required' }, 400)
    if (!body.password || body.signatureMeaning == null || String(body.signatureMeaning).trim() === '') {
      return json({ error: 'Password and Reason for Signing are required' }, 400)
    }

    const { data: userData, error: userError } = await caller.auth.getUser()
    if (userError || !userData.user?.email) return json({ error: 'Authentication required' }, 401)

    const password = String(body.password)
    // JWT getUser() often omits identities — load authoritative auth user for provider check.
    const { data: adminUserData } = await service.auth.admin.getUserById(userData.user.id)
    const identities = (adminUserData.user?.identities ?? userData.user.identities ?? []) as Array<{
      provider?: string
    }>
    const hasEmailPasswordIdentity =
      identities.length === 0
      || identities.some((identity) => identity.provider === 'email')
    if (!hasEmailPasswordIdentity) {
      return json({
        error:
          'This account signs in with Google or Microsoft and has no email password. Set a password under Account Settings (or register an email/password login) before signing documents.',
      }, 403)
    }

    // Re-auth must use a clean anon client. Calling signInWithPassword on the
    // JWT-authenticated caller client often fails or corrupts the request session.
    const reauthClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: reauthData, error: reauthError } = await reauthClient.auth.signInWithPassword({
      email: userData.user.email,
      password,
    })
    if (
      reauthError
      || !reauthData.user
      || reauthData.user.id !== userData.user.id
    ) {
      const detail = reauthError?.message?.toLowerCase() ?? ''
      if (detail.includes('invalid login') || detail.includes('invalid credentials')) {
        return json({ error: 'Re-authentication failed: incorrect password.' }, 403)
      }
      return json({
        error: reauthError?.message
          ? `Re-authentication failed: ${reauthError.message}`
          : 'Re-authentication failed.',
      }, 403)
    }

    // Authz: caller JWT must be able to read this assignment (assignee RLS).
    // Then load route/version with service role — nested route embeds can be null when
    // the signer is an assignee but not an org member under edoc_document_routes RLS.
    const { data: assignment, error: assignmentError } = await caller
      .from('edoc_route_step_assignees')
      .select('id, organization_id, route_id, step_id, assignee_id, status, edoc_route_steps(action, status, step_kind)')
      .eq('id', body.assignmentId)
      .maybeSingle()

    if (assignmentError || !assignment) {
      return json({
        error: assignmentError?.message
          ? `Assignment not found or not authorized: ${assignmentError.message}`
          : 'Assignment not found or not authorized',
      }, 404)
    }
    if (assignment.status !== 'active') return json({ error: 'Assignment is not active' }, 409)

    const { data: callerProfileId, error: callerProfileError } = await caller.rpc('current_profile_id')
    if (callerProfileError || !callerProfileId) {
      return json({ error: 'Could not resolve signer profile' }, 403)
    }
    if (assignment.assignee_id !== callerProfileId) {
      return json({ error: 'Only the assigned signer can complete this electronic signature.' }, 403)
    }

    const stepMeta = assignment.edoc_route_steps as {
      action?: string
      status?: string
      step_kind?: string
    } | {
      action?: string
      status?: string
      step_kind?: string
    }[] | null
    const stepRow = Array.isArray(stepMeta) ? stepMeta[0] : stepMeta
    const stepAction = stepRow?.action ?? 'sign'
    const stepKind = stepRow?.step_kind ?? 'signatory'
    if (stepKind === 'external_auth' || !SIGNATORY_ESIGN_ACTIONS.has(stepAction)) {
      return json({
        error: 'This assignment does not use electronic signature. Complete it from the workspace action panel.',
      }, 400)
    }
    const lockedMeaning = lockedMeaningForAction(stepAction)
    const signatureMeaning = lockedMeaning ?? String(body.signatureMeaning).trim()
    if (!ALLOWED_MEANINGS.has(signatureMeaning)) {
      return json({ error: 'Invalid Reason for Signing' }, 400)
    }

    const { data: route, error: routeError } = await service
      .from('edoc_document_routes')
      .select('id, document_id, version_id, status, transaction_id')
      .eq('id', assignment.route_id)
      .maybeSingle()

    if (routeError || !route) {
      return json({
        error: routeError?.message
          ? `Document route not found: ${routeError.message}`
          : 'Document route not found',
      }, 404)
    }

    const documentId = body.documentId || route.document_id
    const versionId = route.version_id
    if (!versionId) return json({ error: 'Document route has no version_id' }, 404)
    if (body.documentId && body.documentId !== route.document_id) {
      return json({ error: 'Document does not match this assignment route' }, 409)
    }

    const { data: profile, error: profileError } = await service
      .from('profiles')
      .select('id, display_name, email, organization, job_title, signature_data_url')
      .eq('id', assignment.assignee_id)
      .maybeSingle()

    if (profileError || !profile) {
      return json({
        error: profileError?.message
          ? `Signer profile not found: ${profileError.message}`
          : 'Signer profile not found',
      }, 404)
    }
    if (!profile.signature_data_url) {
      return json({ error: 'Configure your electronic signature in Account Settings before signing.' }, 400)
    }

    const typedName = typeof body.typedSignature === 'string' ? body.typedSignature.trim() : ''
    const signerName = typedName || (profile.display_name || '').trim() || userData.user.email
    const signerEmail = profile.email || userData.user.email

    const { data: version, error: versionError } = await service
      .from('edoc_document_versions')
      .select('id, original_sha256, final_sha256')
      .eq('id', versionId)
      .maybeSingle()
    if (versionError || !version) {
      return json({
        error: versionError?.message
          ? `Document version not found: ${versionError.message}`
          : `Document version not found (${versionId})`,
      }, 404)
    }

    const { data: latestSigned } = await service
      .from('edoc_document_files')
      .select('id, bucket_id, object_key, sha256, file_role')
      .eq('document_id', documentId)
      .eq('version_id', versionId)
      .eq('file_role', 'signed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: originalFile } = await service
      .from('edoc_document_files')
      .select('id, bucket_id, object_key, sha256')
      .eq('document_id', documentId)
      .eq('version_id', versionId)
      .eq('file_role', 'original')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const sourceFile = latestSigned ?? originalFile
    if (!sourceFile) return json({ error: 'Source PDF not found' }, 404)

    const { data: pdfBlob, error: downloadError } = await service.storage
      .from(sourceFile.bucket_id)
      .download(sourceFile.object_key)
    if (downloadError || !pdfBlob) return json({ error: 'Could not load source PDF' }, 500)

    const sourceBytes = new Uint8Array(await pdfBlob.arrayBuffer())
    const sourceHash = await sha256Hex(sourceBytes)
    const clientHash = typeof body.versionSha256 === 'string' ? body.versionSha256.trim().toLowerCase() : ''
    if (!clientHash) {
      return json({ error: 'Document content hash is required. Reload the document and try again.' }, 400)
    }
    if (clientHash !== sourceHash.toLowerCase()) {
      return json({
        error:
          'Document hash mismatch — the PDF changed since it was loaded. Reload the document and try again.',
      }, 409)
    }

    const { data: fields, error: fieldsError } = await service
      .from('edoc_signature_fields')
      .select('id, field_type, page_number, x, y, width, height, rotation')
      .eq('assignment_id', assignment.id)

    if (fieldsError) return json({ error: fieldsError.message }, 400)
    const stampFields: StampField[] = (fields ?? []).map((f: Record<string, unknown>) => ({
      id: String(f.id),
      fieldType: String(f.field_type),
      pageNumber: Number(f.page_number),
      x: Number(f.x),
      y: Number(f.y),
      width: Number(f.width),
      height: Number(f.height),
      rotation: Number(f.rotation ?? 0),
    }))

    if (!stampFields.some((f) => f.fieldType === 'signature' || f.fieldType === 'initial')) {
      return json({ error: 'No signature fields are assigned to this task.' }, 400)
    }

    const signedAt = new Date()
    const eventId = crypto.randomUUID()
    const roleLabel = (
      (typeof profile.job_title === 'string' && profile.job_title.trim())
      || (stepAction === 'approve'
        ? 'Approver'
        : stepAction === 'review'
          ? 'Reviewer'
          : stepAction === 'acknowledge'
            ? 'Acknowledger'
            : 'Signatory')
    )
    const appearanceBytes = await decodeSignatureAppearanceBytes(profile.signature_data_url)
    let stampedBytes: Uint8Array
    let adjustments: Array<{
      fieldId: string
      mode: string
      adjusted: boolean
      original: { x: number; y: number; width: number; height: number }
      final: { x: number; y: number; width: number; height: number }
    }> = []
    try {
      const stamped = await stampFieldsOntoPdf(sourceBytes, stampFields, {
        signerName,
        reason: signatureMeaning,
        email: signerEmail,
        signedAtLabel: formatSigningDateLabel(signedAt),
        appearancePngBytes: appearanceBytes,
        role: roleLabel,
        recordId: eventId.slice(0, 8).toUpperCase(),
      })
      stampedBytes = stamped.bytes
      adjustments = stamped.adjustments
    } catch (stampError) {
      const message = stampError instanceof Error ? stampError.message : 'Could not apply signature stamp'
      const status = /does not have enough free space|cannot display/i.test(message) ? 400 : 500
      return json({ error: message }, status)
    }
    const signedHash = await sha256Hex(stampedBytes)
    const signingSessionId = crypto.randomUUID()
    const integrityMaterial = new TextEncoder().encode(
      `${eventId}|${assignment.id}|${signedHash}|${signatureMeaning}|${assignment.assignee_id}`,
    )
    const integrityHash = await sha256Hex(integrityMaterial)
    const signedFileName = `${documentId}-${assignment.id}-${eventId}-signed.pdf`
    const objectKey = `organizations/${assignment.organization_id}/documents/${documentId}/signed/${signedFileName}`

    const { error: uploadError } = await service.storage
      .from('edoc-signed')
      .upload(objectKey, stampedBytes, { contentType: 'application/pdf', upsert: false })
    if (uploadError) return json({ error: `Signed PDF could not be stored: ${uploadError.message}` }, 500)

    const { error: eventInsertError } = await service.from('edoc_signature_events').insert({
      id: eventId,
      organization_id: assignment.organization_id,
      document_id: documentId,
      version_id: versionId,
      route_id: assignment.route_id,
      step_id: assignment.step_id,
      assignment_id: assignment.id,
      signer_id: assignment.assignee_id,
      signer_display_name: signerName,
      signer_email: signerEmail,
      signer_organization: profile.organization ?? null,
      signature_meaning: signatureMeaning,
      signature_appearance_type: 'image',
      display_timezone: displayTimezoneLabel(signedAt),
      field_ids: stampFields.map((f) => f.id),
      auth_method: 'password',
      source_ip: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent'),
      session_id: signingSessionId,
      original_pdf_hash: sourceHash || signedHash,
      signed_pdf_hash: signedHash,
      integrity_hash: integrityHash,
    })
    if (eventInsertError) {
      return json({ error: `Signature event could not be stored: ${eventInsertError.message}` }, 500)
    }

    const { error: fileInsertError } = await service.from('edoc_document_files').insert({
      organization_id: assignment.organization_id,
      document_id: documentId,
      version_id: versionId,
      file_role: 'signed',
      bucket_id: 'edoc-signed',
      object_key: objectKey,
      file_name: signedFileName,
      mime_type: 'application/pdf',
      size_bytes: stampedBytes.byteLength,
      sha256: signedHash,
      created_by: assignment.assignee_id,
    })
    if (fileInsertError) {
      return json({ error: `Signed file record could not be stored: ${fileInsertError.message}` }, 500)
    }

    const layoutAdjusted = adjustments.filter((a) => a.adjusted)
    if (layoutAdjusted.length) {
      // Non-blocking audit; PostgREST builder is thenable but has no .catch().
      await service.from('edoc_audit_events').insert({
        organization_id: assignment.organization_id,
        event_type: 'signature_field_layout_adjusted',
        entity_type: 'assignment',
        entity_id: assignment.id,
        document_id: documentId,
        version_id: versionId,
        actor_id: assignment.assignee_id,
        actor_name: 'System',
        reason: 'Signature field auto-expanded to keep manifestation readable (signer intent unchanged)',
        new_value: { adjustments: layoutAdjusted, signature_event_id: eventId },
      })
    }

    const { data: advanced, error: advanceError } = await caller.rpc('edoc_advance_route', {
      p_route_id: assignment.route_id,
      p_assignment_id: assignment.id,
      p_action: stepAction,
      p_reason: advanceReasonForAction(stepAction, signerName, signatureMeaning),
      p_comment: body.comment ? String(body.comment) : null,
    })
    if (advanceError) return json({ error: advanceError.message }, 400)

    const signerNote = typeof body.comment === 'string' ? body.comment.trim() : ''
    if (signerNote) {
      await service.from('edoc_audit_events').insert({
        organization_id: assignment.organization_id,
        event_type: 'signer_note',
        entity_type: 'assignment',
        entity_id: assignment.id,
        document_id: documentId,
        version_id: versionId,
        actor_id: assignment.assignee_id,
        actor_name: signerName,
        reason: signerNote.slice(0, 2000),
        new_value: { signature_event_id: eventId, source: 'optional_note' },
      })
    }

    const routeCompleted = Boolean((advanced as { routeCompleted?: boolean } | null)?.routeCompleted)
    let finalizeResult: unknown = null
    if (routeCompleted) {
      // Prefer service key so finalize is not blocked by caller RLS after last signer completes.
      finalizeResult = await invokeFinalize(supabaseUrl, serviceKey, assignment.route_id)
    }

    return json({
      ...(advanced as object),
      signedPdfHash: signedHash,
      signatureEventId: eventId,
      finalize: finalizeResult,
      fieldLayout: {
        adjusted: layoutAdjusted.length > 0,
        message: layoutAdjusted.length
          ? 'The signature field was automatically adjusted to keep all signature information readable.'
          : null,
        adjustments,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected signing error'
    return json({ error: message }, 500)
  }
})

async function invokeFinalize(supabaseUrl: string, serviceKey: string, routeId: string) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/edoc-finalize-document`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ routeId }),
    })
    const payload = await response.json()
    if (!response.ok) {
      return { error: (payload as { error?: string })?.error || `Finalize failed (${response.status})` }
    }
    return payload
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Finalize invoke failed' }
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
