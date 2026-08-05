import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type StorageObject = { bucket_id?: string; object_key?: string }

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
    const documentId = typeof body.documentId === 'string' ? body.documentId.trim() : ''
    if (!documentId) return json({ error: 'documentId is required' }, 400)

    const { data: userData, error: userError } = await caller.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Authentication required' }, 401)

    const { data: isAdmin, error: adminError } = await caller.rpc('is_vrms_admin')
    if (adminError) return json({ error: adminError.message }, 400)
    if (!isAdmin) return json({ error: 'Only administrators can permanently delete eDoc documents' }, 403)

    const { data: deleted, error: deleteError } = await caller.rpc('edoc_admin_delete_document', {
      p_document_id: documentId,
    })
    if (deleteError) return json({ error: deleteError.message }, 400)

    const payload = deleted as {
      ok?: boolean
      document_id?: string
      document_number?: string
      title?: string
      storage_objects?: StorageObject[]
    } | null

    const storageObjects = Array.isArray(payload?.storage_objects) ? payload.storage_objects : []
    const byBucket = new Map<string, string[]>()
    for (const item of storageObjects) {
      const bucket = String(item.bucket_id ?? '').trim()
      const key = String(item.object_key ?? '').trim()
      if (!bucket || !key) continue
      const list = byBucket.get(bucket) ?? []
      list.push(key)
      byBucket.set(bucket, list)
    }

    const storageErrors: string[] = []
    for (const [bucket, keys] of byBucket.entries()) {
      const { error: removeError } = await service.storage.from(bucket).remove(keys)
      if (removeError) storageErrors.push(`${bucket}: ${removeError.message}`)
    }

    return json({
      ok: true,
      documentId: payload?.document_id ?? documentId,
      documentNumber: payload?.document_number ?? null,
      title: payload?.title ?? null,
      storageRemoved: storageObjects.length - storageErrors.length,
      storageErrors: storageErrors.length ? storageErrors : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected delete error'
    return json({ error: message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
