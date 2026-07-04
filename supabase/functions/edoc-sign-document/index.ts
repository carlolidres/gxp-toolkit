import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const service = createClient(supabaseUrl, serviceKey)
    const body = await req.json()

    if (!body.consent) return json({ error: 'Explicit consent is required' }, 400)
    if (!body.password || !body.typedSignature || !body.signatureMeaning) {
      return json({ error: 'Password, typed signature, and signature meaning are required' }, 400)
    }

    const { data: userData, error: userError } = await caller.auth.getUser()
    if (userError || !userData.user?.email) return json({ error: 'Authentication required' }, 401)

    const { error: reauthError } = await caller.auth.signInWithPassword({
      email: userData.user.email,
      password: body.password,
    })
    if (reauthError) return json({ error: 'Re-authentication failed' }, 403)

    const { data: assignment, error: assignmentError } = await caller
      .from('edoc_route_step_assignees')
      .select('id, organization_id, route_id, step_id, assignee_id, status, edoc_route_steps(action, status), edoc_document_routes(document_id, version_id, status)')
      .eq('id', body.assignmentId)
      .maybeSingle()

    if (assignmentError || !assignment) return json({ error: 'Assignment not found or not authorized' }, 404)
    if (assignment.status !== 'active') return json({ error: 'Assignment is not active' }, 409)

    const signedPdfBytes = await createSignaturePdf({
      typedSignature: body.typedSignature,
      signatureMeaning: body.signatureMeaning,
      email: userData.user.email,
    })
    const signedHash = await sha256Hex(signedPdfBytes)
    const signedFileName = `${body.documentId}-${body.assignmentId}-signed.pdf`
    const objectKey = `organizations/${assignment.organization_id}/documents/${body.documentId}/signed/${signedFileName}`

    const { error: uploadError } = await service.storage
      .from('edoc-signed')
      .upload(objectKey, signedPdfBytes, { contentType: 'application/pdf', upsert: false })
    if (uploadError && !uploadError.message.includes('already exists')) {
      return json({ error: 'Signed PDF could not be stored' }, 500)
    }

    await service.from('edoc_signature_events').insert({
      organization_id: assignment.organization_id,
      document_id: body.documentId,
      version_id: assignment.edoc_document_routes.version_id,
      route_id: assignment.route_id,
      step_id: assignment.step_id,
      assignment_id: assignment.id,
      signer_id: assignment.assignee_id,
      signer_display_name: body.typedSignature,
      signature_meaning: body.signatureMeaning,
      auth_method: 'password',
      source_ip: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent'),
      original_pdf_hash: body.versionSha256,
      signed_pdf_hash: signedHash,
    })

    await service.from('edoc_document_files').insert({
      organization_id: assignment.organization_id,
      document_id: body.documentId,
      version_id: assignment.edoc_document_routes.version_id,
      file_role: 'signed',
      bucket_id: 'edoc-signed',
      object_key: objectKey,
      file_name: signedFileName,
      mime_type: 'application/pdf',
      size_bytes: signedPdfBytes.byteLength,
      sha256: signedHash,
      created_by: assignment.assignee_id,
    })

    const { data: advanced, error: advanceError } = await caller.rpc('edoc_advance_route', {
      p_route_id: assignment.route_id,
      p_assignment_id: assignment.id,
      p_action: 'sign',
      p_reason: null,
      p_comment: body.signatureMeaning,
    })

    if (advanceError) return json({ error: advanceError.message }, 400)
    return json({ ...advanced, signedPdfHash: signedHash })
  } catch (_error) {
    return json({ error: 'Unexpected signing error' }, 500)
  }
})

async function createSignaturePdf(input: { typedSignature: string; signatureMeaning: string; email: string }) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  page.drawText('eDoc Electronic Signature Record', { x: 72, y: 700, size: 18, font: bold, color: rgb(0.06, 0.16, 0.26) })
  page.drawText(`Signer: ${input.typedSignature}`, { x: 72, y: 650, size: 12, font })
  page.drawText(`Email: ${input.email}`, { x: 72, y: 628, size: 12, font })
  page.drawText(`Meaning: ${input.signatureMeaning}`, { x: 72, y: 606, size: 12, font })
  page.drawText(`Signed at: ${new Date().toISOString()}`, { x: 72, y: 584, size: 12, font })
  return await pdf.save()
}

async function sha256Hex(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

