import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1'

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
    const { routeId } = await req.json()

    const { data: route, error } = await caller
      .from('edoc_document_routes')
      .select('id, organization_id, document_id, version_id, status, edoc_documents(document_number, title)')
      .eq('id', routeId)
      .maybeSingle()

    if (error || !route) return json({ error: 'Route not found or not authorized' }, 404)
    if (route.status !== 'completed') return json({ error: 'Certificate can only be issued for completed routes' }, 409)

    const verificationCode = crypto.randomUUID()
    const certificateId = crypto.randomUUID()
    const pdfBytes = await createCertificatePdf({
      documentNumber: route.edoc_documents.document_number,
      title: route.edoc_documents.title,
      routeId: route.id,
      verificationCode,
    })
    const objectKey = `organizations/${route.organization_id}/documents/${route.document_id}/certificates/${certificateId}.pdf`

    const { error: uploadError } = await service.storage
      .from('edoc-certificates')
      .upload(objectKey, pdfBytes, { contentType: 'application/pdf', upsert: false })
    if (uploadError) return json({ error: 'Certificate could not be stored' }, 500)

    const { data: certificate, error: insertError } = await service
      .from('edoc_completion_certificates')
      .insert({
        id: certificateId,
        organization_id: route.organization_id,
        document_id: route.document_id,
        version_id: route.version_id,
        route_id: route.id,
        object_key: objectKey,
        verification_code: verificationCode,
      })
      .select('id, verification_code, issued_at')
      .single()

    if (insertError) return json({ error: insertError.message }, 400)
    return json(certificate)
  } catch (_error) {
    return json({ error: 'Unexpected certificate error' }, 500)
  }
})

async function createCertificatePdf(input: {
  documentNumber: string
  title: string
  routeId: string
  verificationCode: string
}) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  page.drawText('eDoc Completion Certificate', { x: 72, y: 700, size: 20, font: bold })
  page.drawText(`Document: ${input.documentNumber}`, { x: 72, y: 650, size: 12, font })
  page.drawText(`Title: ${input.title}`, { x: 72, y: 628, size: 12, font })
  page.drawText(`Route: ${input.routeId}`, { x: 72, y: 606, size: 12, font })
  page.drawText(`Verification code: ${input.verificationCode}`, { x: 72, y: 584, size: 12, font })
  page.drawText(`Issued at: ${new Date().toISOString()}`, { x: 72, y: 562, size: 12, font })
  return await pdf.save()
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

