import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  PDFDocument,
} from 'https://esm.sh/pdf-lib@1.17.1'
import {
  appendHistoryPages,
  sha256Hex,
  type HistoryPayload,
} from '../_shared/edocPdfStamp.ts'
import { applyContentIntegrityAndVerifyMarks } from '../_shared/edocIntegrityFinalize.ts'
import {
  buildCompletionHistoryEvents,
  formatHistoryTimestamp,
  versionSummaryLabels,
} from '../_shared/edocCompletionHistory.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type CertRow = {
  id: string
  verification_code: string
  issued_at?: string
  object_key: string
  final_pdf_sha256: string | null
  page_count: number | null
  content_page_count: number | null
  status: string
}

function isIntegrityPackageComplete(integrityCount: number, contentPageCount: number | null | undefined): boolean {
  if (integrityCount <= 0) return false
  if (contentPageCount == null || contentPageCount <= 0) return integrityCount > 0
  return integrityCount === contentPageCount
}

function isFinalCompletedObjectKey(objectKey: string): boolean {
  return objectKey.includes('/final-completed-') || objectKey.includes('final-completed-')
}

async function purgeOrphanFinalFiles(
  service: SupabaseClient,
  documentId: string,
  versionId: string,
): Promise<void> {
  const { data: files } = await service
    .from('edoc_document_files')
    .select('id, bucket_id, object_key, file_role')
    .eq('document_id', documentId)
    .eq('version_id', versionId)
    .in('file_role', ['certificate', 'signed'])

  const orphans = (files ?? []).filter((row: { file_role: string; object_key: string }) => (
    row.file_role === 'certificate' || isFinalCompletedObjectKey(row.object_key)
  ))

  for (const row of orphans) {
    try {
      await service.storage.from(row.bucket_id).remove([row.object_key])
    } catch {
      // best-effort storage cleanup
    }
    await service.from('edoc_document_files').delete().eq('id', row.id)
  }
}

async function loadCompleteCertificate(
  service: SupabaseClient,
  routeId: string,
): Promise<CertRow | null> {
  const { data: existing } = await service
    .from('edoc_completion_certificates')
    .select('id, verification_code, issued_at, object_key, final_pdf_sha256, page_count, content_page_count, status')
    .eq('route_id', routeId)
    .maybeSingle()
  if (!existing) return null
  const { count: integrityCount } = await service
    .from('edoc_page_integrity_codes')
    .select('id', { count: 'exact', head: true })
    .eq('certificate_id', existing.id)
  if (!isIntegrityPackageComplete(integrityCount ?? 0, existing.content_page_count)) {
    return null
  }
  return existing as CertRow
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let claimedCertificateId: string | null = null
  let service: SupabaseClient | null = null
  let claimDocumentId: string | null = null
  let claimVersionId: string | null = null

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { routeId } = await req.json()
    if (!routeId) return json({ error: 'routeId is required' }, 400)

    const isServiceCall = (() => {
      if (!serviceKey || !authHeader) return false
      const token = authHeader.replace(/^Bearer\s+/i, '').trim()
      return token === serviceKey.trim()
    })()

    const complete = await loadCompleteCertificate(service, routeId)
    if (complete) {
      return json({ ...complete, idempotent: true })
    }

    const { data: incomplete } = await service
      .from('edoc_completion_certificates')
      .select('id, document_id, version_id, object_key, bucket_id')
      .eq('route_id', routeId)
      .maybeSingle()
    if (incomplete) {
      // Incomplete package: drop cert row (page codes CASCADE) and orphan final file rows.
      await service.from('edoc_completion_certificates').delete().eq('id', incomplete.id)
      try {
        if (incomplete.bucket_id && incomplete.object_key) {
          await service.storage.from(incomplete.bucket_id).remove([incomplete.object_key])
        }
      } catch {
        // best-effort
      }
      await purgeOrphanFinalFiles(service, incomplete.document_id, incomplete.version_id)
    }

    const { data: route, error: routeError } = await service
      .from('edoc_document_routes')
      .select('id, organization_id, document_id, version_id, status, transaction_id, started_at, completed_at')
      .eq('id', routeId)
      .maybeSingle()

    if (routeError || !route) {
      return json({
        error: routeError?.message
          ? `Route not found: ${routeError.message}`
          : 'Route not found',
      }, 404)
    }

    if (!isServiceCall) {
      const { data: userData, error: userError } = await caller.auth.getUser()
      if (userError || !userData.user) return json({ error: 'Authentication required' }, 401)
      const { data: allowed, error: accessError } = await caller.rpc('edoc_can_access_document', {
        target_document_id: route.document_id,
      })
      if (accessError || !allowed) {
        return json({
          error: accessError?.message
            ? `Route not found or not authorized: ${accessError.message}`
            : 'Route not found or not authorized',
        }, 404)
      }
    }

    if (route.status !== 'completed') {
      return json({ error: 'Certificate can only be issued for completed routes' }, 409)
    }

    const { data: document, error: documentError } = await service
      .from('edoc_documents')
      .select('document_number, title, owner_id, status, created_at')
      .eq('id', route.document_id)
      .maybeSingle()

    if (documentError || !document) {
      return json({
        error: documentError?.message
          ? `Document not found: ${documentError.message}`
          : 'Document not found',
      }, 404)
    }

    claimDocumentId = route.document_id
    claimVersionId = route.version_id
    // Remove any leftover final packages before selecting source / claiming.
    await purgeOrphanFinalFiles(service, route.document_id, route.version_id)

    const certificateId = crypto.randomUUID()
    const verificationCode = crypto.randomUUID()
    const objectKey = `organizations/${route.organization_id}/documents/${route.document_id}/certificates/${certificateId}.pdf`

    // Claim route uniqueness BEFORE PDF work so losers never upload orphan bytes.
    const { error: claimError } = await service
      .from('edoc_completion_certificates')
      .insert({
        id: certificateId,
        organization_id: route.organization_id,
        document_id: route.document_id,
        version_id: route.version_id,
        route_id: route.id,
        object_key: objectKey,
        verification_code: verificationCode,
        final_pdf_sha256: null,
        page_count: null,
        content_page_count: null,
        status: 'generating',
      })

    if (claimError) {
      if (claimError.code === '23505') {
        const raced = await loadCompleteCertificate(service, routeId)
        if (raced) return json({ ...raced, idempotent: true })
        return json({
          error: 'Final Signed PDF is still being generated by another request. Retry shortly.',
        }, 409)
      }
      return json({ error: claimError.message }, 400)
    }
    claimedCertificateId = certificateId

    const { data: signedRows } = await service
      .from('edoc_document_files')
      .select('bucket_id, object_key, sha256')
      .eq('document_id', route.document_id)
      .eq('version_id', route.version_id)
      .eq('file_role', 'signed')
      .order('created_at', { ascending: false })

    const latestSigned = (signedRows ?? []).find(
      (row: { object_key: string }) => !isFinalCompletedObjectKey(row.object_key),
    ) ?? null

    const { data: originalFile } = await service
      .from('edoc_document_files')
      .select('bucket_id, object_key, sha256')
      .eq('document_id', route.document_id)
      .eq('version_id', route.version_id)
      .eq('file_role', 'original')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const source = latestSigned ?? originalFile
    if (!source) {
      await service.from('edoc_completion_certificates').delete().eq('id', certificateId)
      claimedCertificateId = null
      return json({ error: 'No PDF available to finalize' }, 404)
    }

    const { data: blob, error: dlError } = await service.storage.from(source.bucket_id).download(source.object_key)
    if (dlError || !blob) {
      await service.from('edoc_completion_certificates').delete().eq('id', certificateId)
      claimedCertificateId = null
      return json({ error: 'Could not load signed PDF' }, 500)
    }
    const sourceBytes = new Uint8Array(await blob.arrayBuffer())
    const pdf = await PDFDocument.load(sourceBytes)
    const pageCountBefore = pdf.getPageCount()

    const { data: owner } = await service
      .from('profiles')
      .select('display_name, email, organization')
      .eq('id', document.owner_id)
      .maybeSingle()

    const ownerName = (owner?.display_name || '').trim() || document.owner_id
    const ownerEmail = owner?.email || ''
    const ownerOrg = owner?.organization || ''

    const { data: versionRow } = await service
      .from('edoc_document_versions')
      .select('id, version_number, original_sha256')
      .eq('id', route.version_id)
      .maybeSingle()

    const { data: auditRows } = await service
      .from('edoc_audit_events')
      .select('id, event_type, actor_id, reason, created_at, document_id, entity_type, entity_id, new_value')
      .eq('document_id', route.document_id)
      .order('created_at', { ascending: true })

    const { data: signatureEvents } = await service
      .from('edoc_signature_events')
      .select('id, signer_display_name, signer_email, signer_organization, signature_meaning, signing_timestamp, source_ip, auth_method, signature_appearance_type, display_timezone')
      .eq('route_id', routeId)
      .order('signing_timestamp', { ascending: true })

    const actorIds = [...new Set((auditRows ?? []).map((r: { actor_id: string | null }) => r.actor_id).filter(Boolean))] as string[]
    const { data: actors } = actorIds.length
      ? await service.from('profiles').select('id, display_name, email, organization').in('id', actorIds)
      : { data: [] as Array<Record<string, string>> }
    const actorMap = new Map(
      (actors ?? []).map((a: Record<string, string>) => [
        a.id,
        { display_name: a.display_name, email: a.email, organization: a.organization },
      ]),
    )

    const runtimeOffset = -new Date().getTimezoneOffset()
    const displayOffsetMinutes = runtimeOffset === 0 ? 480 : runtimeOffset
    const events = buildCompletionHistoryEvents({
      audits: (auditRows ?? []).map((row: {
        id: string
        event_type: string
        actor_id: string | null
        reason: string | null
        created_at: string
      }) => ({
        id: row.id,
        event_type: row.event_type,
        actor_id: row.actor_id,
        reason: row.reason,
        created_at: row.created_at,
      })),
      signatures: (signatureEvents ?? []).map((sig: {
        id: string
        signer_display_name: string
        signer_email: string | null
        signer_organization: string | null
        signature_meaning: string
        signing_timestamp: string
        source_ip: string | null
        auth_method: string
        signature_appearance_type: string | null
      }) => ({
        id: sig.id,
        signer_display_name: sig.signer_display_name,
        signer_email: sig.signer_email,
        signer_organization: sig.signer_organization,
        signature_meaning: sig.signature_meaning,
        signing_timestamp: sig.signing_timestamp,
        source_ip: sig.source_ip,
        auth_method: sig.auth_method,
        signature_appearance_type: sig.signature_appearance_type,
      })),
      actors: actorMap,
      routeCompletedAt: route.completed_at,
      timeZoneOffsetMinutes: displayOffsetMinutes,
    })

    const completedAt = route.completed_at ? new Date(route.completed_at) : new Date()
    const createdAt = document.created_at ? new Date(document.created_at) : completedAt
    const versionLabels = versionSummaryLabels({
      versionId: route.version_id,
      versionNumber: versionRow?.version_number ?? null,
    })

    const signedContentSha256 = await sha256Hex(sourceBytes)

    const verifyBaseUrl = (
      Deno.env.get('EDOC_VERIFY_PUBLIC_BASE_URL')
      || Deno.env.get('PUBLIC_APP_URL')
      || 'https://carlolidres.github.io/gxp-toolkit/'
    )

    const { data: signatureFields } = await service
      .from('edoc_signature_fields')
      .select('page_number, x, y, width, height, field_type')
      .eq('document_id', route.document_id)
      .eq('version_id', route.version_id)
      .eq('field_type', 'signature')

    let contentIntegrity: Awaited<ReturnType<typeof applyContentIntegrityAndVerifyMarks>>
    try {
      contentIntegrity = await applyContentIntegrityAndVerifyMarks(pdf, {
        documentId: document.document_number || route.document_id,
        revision: versionRow?.version_number ?? 1,
        contentPageCount: pageCountBefore,
        verificationCode,
        verifyBaseUrl,
        signatureFields: (signatureFields ?? []).map((f: {
          page_number: number
          x: number
          y: number
          width: number
          height: number
        }) => ({
          pageNumber: Number(f.page_number) || 1,
          x: Number(f.x) || 0,
          y: Number(f.y) || 0,
          width: Number(f.width) || 0,
          height: Number(f.height) || 0,
        })),
      })
    } catch (integrityError) {
      await service.from('edoc_completion_certificates').delete().eq('id', certificateId)
      claimedCertificateId = null
      const detail = integrityError instanceof Error ? integrityError.message : 'unknown integrity error'
      return json({ error: `Content integrity / verify marks failed: ${detail}` }, 500)
    }

    const payload: HistoryPayload = {
      title: document.title || document.document_number || 'Document',
      statusLabel: 'COMPLETED',
      documentId: route.document_id,
      transactionId: route.transaction_id || route.id,
      createdAtLabel: formatHistoryTimestamp(createdAt, displayOffsetMinutes),
      createdByName: ownerName,
      createdByEmail: ownerEmail,
      createdByOrganization: ownerOrg || undefined,
      completedAtLabel: formatHistoryTimestamp(completedAt, displayOffsetMinutes),
      versionDisplay: versionLabels.versionDisplay,
      versionId: versionLabels.versionIdLabel,
      revisionNumber: versionRow?.version_number ?? null,
      signedContentSha256,
      pageCountBeforeHistory: pageCountBefore,
      events,
    }

    const pageCount = await appendHistoryPages(pdf, payload)
    const finalBytes = await pdf.save()
    const finalHash = await sha256Hex(finalBytes)

    if (pageCount <= pageCountBefore) {
      await service.from('edoc_completion_certificates').delete().eq('id', certificateId)
      claimedCertificateId = null
      return json({
        error: `Completion history was not appended (pages before=${pageCountBefore}, after=${pageCount}).`,
      }, 500)
    }

    if (!contentIntegrity.records.length || contentIntegrity.records.length !== pageCountBefore) {
      await service.from('edoc_completion_certificates').delete().eq('id', certificateId)
      claimedCertificateId = null
      return json({
        error: `Page integrity generation incomplete (expected ${pageCountBefore}, got ${contentIntegrity.records.length}).`,
      }, 500)
    }

    const { error: uploadError } = await service.storage
      .from('edoc-certificates')
      .upload(objectKey, finalBytes, { contentType: 'application/pdf', upsert: false })
    if (uploadError) {
      await service.from('edoc_completion_certificates').delete().eq('id', certificateId)
      claimedCertificateId = null
      return json({ error: `Certificate could not be stored: ${uploadError.message}` }, 500)
    }

    const finalSignedKey = `organizations/${route.organization_id}/documents/${route.document_id}/signed/final-completed-${certificateId}.pdf`
    const { error: finalSignedUploadError } = await service.storage
      .from('edoc-signed')
      .upload(finalSignedKey, finalBytes, { contentType: 'application/pdf', upsert: false })
    if (finalSignedUploadError) {
      try { await service.storage.from('edoc-certificates').remove([objectKey]) } catch { /* best-effort */ }
      await service.from('edoc_completion_certificates').delete().eq('id', certificateId)
      claimedCertificateId = null
      return json({ error: `Final signed PDF could not be stored: ${finalSignedUploadError.message}` }, 500)
    }

    const { error: certFileError } = await service.from('edoc_document_files').insert({
      organization_id: route.organization_id,
      document_id: route.document_id,
      version_id: route.version_id,
      file_role: 'certificate',
      bucket_id: 'edoc-certificates',
      object_key: objectKey,
      file_name: `final-completed-${document.document_number}.pdf`,
      mime_type: 'application/pdf',
      size_bytes: finalBytes.byteLength,
      sha256: finalHash,
      created_by: document.owner_id,
    })
    if (certFileError) {
      try {
        await service.storage.from('edoc-certificates').remove([objectKey])
        await service.storage.from('edoc-signed').remove([finalSignedKey])
      } catch { /* best-effort */ }
      await service.from('edoc_completion_certificates').delete().eq('id', certificateId)
      claimedCertificateId = null
      return json({ error: `Certificate file record failed: ${certFileError.message}` }, 500)
    }

    const { error: signedFileError } = await service.from('edoc_document_files').insert({
      organization_id: route.organization_id,
      document_id: route.document_id,
      version_id: route.version_id,
      file_role: 'signed',
      bucket_id: 'edoc-signed',
      object_key: finalSignedKey,
      file_name: `final-completed-${document.document_number}.pdf`,
      mime_type: 'application/pdf',
      size_bytes: finalBytes.byteLength,
      sha256: finalHash,
      created_by: document.owner_id,
    })
    if (signedFileError) {
      await purgeOrphanFinalFiles(service, route.document_id, route.version_id)
      await service.from('edoc_completion_certificates').delete().eq('id', certificateId)
      claimedCertificateId = null
      return json({ error: `Final signed file record failed: ${signedFileError.message}` }, 500)
    }

    const { error: versionUpdateError } = await service
      .from('edoc_document_versions')
      .update({ final_sha256: finalHash })
      .eq('id', route.version_id)
    if (versionUpdateError) {
      await purgeOrphanFinalFiles(service, route.document_id, route.version_id)
      await service.from('edoc_completion_certificates').delete().eq('id', certificateId)
      claimedCertificateId = null
      return json({ error: `Version final hash update failed: ${versionUpdateError.message}` }, 500)
    }

    const pageRows = contentIntegrity.records.map((r) => ({
      id: crypto.randomUUID(),
      organization_id: route.organization_id,
      document_id: route.document_id,
      version_id: route.version_id,
      route_id: route.id,
      certificate_id: certificateId,
      page_number: r.pageNumber,
      algorithm: r.algorithm,
      page_content_sha256: r.pageContentSha256,
      page_integrity_code: r.pageIntegrityCodeFull,
      page_integrity_code_display: r.pageIntegrityCodeDisplay,
    }))
    const { error: pageInsertError } = await service.from('edoc_page_integrity_codes').insert(pageRows)
    if (pageInsertError) {
      await purgeOrphanFinalFiles(service, route.document_id, route.version_id)
      await service.from('edoc_completion_certificates').delete().eq('id', certificateId)
      claimedCertificateId = null
      return json({ error: `Page integrity records failed: ${pageInsertError.message}` }, 500)
    }

    const { data: certificate, error: updateError } = await service
      .from('edoc_completion_certificates')
      .update({
        final_pdf_sha256: finalHash,
        page_count: pageCount,
        content_page_count: pageCountBefore,
        status: 'generated',
      })
      .eq('id', certificateId)
      .select('id, verification_code, issued_at, final_pdf_sha256, page_count, content_page_count, status, object_key')
      .single()

    if (updateError || !certificate) {
      await purgeOrphanFinalFiles(service, route.document_id, route.version_id)
      await service.from('edoc_completion_certificates').delete().eq('id', certificateId)
      claimedCertificateId = null
      return json({ error: updateError?.message || 'Certificate finalize update failed' }, 500)
    }
    claimedCertificateId = null

    await service.from('edoc_audit_events').insert({
      organization_id: route.organization_id,
      event_type: 'completion_certificate_generated',
      entity_type: 'route',
      entity_id: route.id,
      document_id: route.document_id,
      version_id: route.version_id,
      actor_name: 'System',
      reason: 'Final distributed PDF generated (history appended); final_pdf_sha256 is of full PDF bytes',
      new_value: {
        certificate_id: certificateId,
        signed_content_sha256: signedContentSha256,
        final_pdf_sha256: finalHash,
        page_count: pageCount,
        content_page_count: pageCountBefore,
        verification_code: verificationCode,
        verify_url: contentIntegrity.verifyUrl,
      },
    })

    await service.from('edoc_audit_events').insert({
      organization_id: route.organization_id,
      event_type: 'page_integrity_codes_generated',
      entity_type: 'document_version',
      entity_id: route.version_id,
      document_id: route.document_id,
      version_id: route.version_id,
      actor_name: 'System',
      reason: `Generated ${contentIntegrity.records.length} page integrity code(s) (${contentIntegrity.records[0]?.algorithm})`,
      new_value: {
        algorithm: contentIntegrity.records[0]?.algorithm,
        page_count: contentIntegrity.records.length,
        verify_url: contentIntegrity.verifyUrl,
        certificate_id: certificateId,
      },
    })

    await service.from('edoc_audit_events').insert({
      organization_id: route.organization_id,
      event_type: 'history_page_appended',
      entity_type: 'route',
      entity_id: route.id,
      document_id: route.document_id,
      version_id: route.version_id,
      actor_name: 'System',
      reason: 'Completion-history page appended; signed-content SHA-256 printed on certificate is pre-append',
      new_value: {
        certificate_id: certificateId,
        page_count: pageCount,
        content_page_count: pageCountBefore,
        signed_content_sha256: signedContentSha256,
      },
    })

    return json({ ...certificate, verifyUrl: contentIntegrity.verifyUrl, idempotent: false })
  } catch (error) {
    if (service && claimedCertificateId) {
      try {
        await service.from('edoc_completion_certificates').delete().eq('id', claimedCertificateId)
        if (claimDocumentId && claimVersionId) {
          await purgeOrphanFinalFiles(service, claimDocumentId, claimVersionId)
        }
      } catch {
        // best-effort rollback
      }
    }
    const message = error instanceof Error ? error.message : 'Unexpected certificate error'
    return json({ error: message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
