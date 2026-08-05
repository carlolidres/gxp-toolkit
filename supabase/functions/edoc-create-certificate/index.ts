/**
 * Backward-compatible alias: delegates to edoc-finalize-document.
 * Kept so older clients calling edoc-create-certificate still work.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const authHeader = req.headers.get('Authorization') ?? ''
  const body = await req.text()
  const response = await fetch(`${supabaseUrl}/functions/v1/edoc-finalize-document`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('ANON_KEY') ?? '',
      'Content-Type': 'application/json',
    },
    body,
  })
  const text = await response.text()
  return new Response(text, {
    status: response.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
