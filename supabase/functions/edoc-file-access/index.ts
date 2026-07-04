import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { fileId, accessType = 'preview' } = await req.json()

    const { data: userData, error: userError } = await caller.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Authentication required' }, 401)

    const { data: file, error: fileError } = await caller
      .from('edoc_document_files')
      .select('id, organization_id, document_id, bucket_id, object_key')
      .eq('id', fileId)
      .maybeSingle()

    if (fileError || !file) return json({ error: 'File not found or not authorized' }, 404)

    const { data: profileId } = await caller.rpc('edoc_current_profile_id')
    if (profileId) {
      await caller.from('edoc_file_access_logs').insert({
        organization_id: file.organization_id,
        file_id: file.id,
        profile_id: profileId,
        access_type: accessType === 'download' ? 'download' : 'preview',
      })
    }

    const { data: signed, error: signedError } = await service.storage
      .from(file.bucket_id)
      .createSignedUrl(file.object_key, 300, { download: accessType === 'download' })

    if (signedError || !signed?.signedUrl) return json({ error: 'Signed URL could not be generated' }, 500)
    return json({ signedUrl: signed.signedUrl, expiresInSeconds: 300 })
  } catch (_error) {
    return json({ error: 'Unexpected file-access error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

