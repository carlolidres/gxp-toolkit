import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'The reset service is not configured.' }, 503)
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })

  const { data: callerData, error: callerError } = await callerClient.auth.getUser()
  if (callerError || !callerData.user) return json({ error: 'Authentication is required.' }, 401)

  const { data: isAdmin, error: adminError } = await callerClient.rpc('is_vrms_admin')
  if (adminError || !isAdmin) return json({ error: 'Admin access is required.' }, 403)

  let body: { profileId?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }

  const profileId = typeof body.profileId === 'string' ? body.profileId.trim() : ''
  if (!profileId) return json({ error: 'A profile ID is required.' }, 400)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, email, auth_user_id, active')
    .eq('id', profileId)
    .maybeSingle()

  if (profileError || !profile) return json({ error: 'The selected user profile was not found.' }, 404)
  if (!profile.active) return json({ error: 'Cannot reset password for an inactive account.' }, 400)
  if (!profile.auth_user_id) {
    return json({ error: 'This account has no email/password login linked. Password reset is not available.' }, 400)
  }

  const defaultPassword = Deno.env.get('DEFAULT_RESET_PASSWORD')?.trim()
  if (!defaultPassword) {
    return json({ error: 'The reset service is not configured.' }, 503)
  }

  const { error: passwordError } = await adminClient.auth.admin.updateUserById(profile.auth_user_id, {
    password: defaultPassword,
  })
  if (passwordError) return json({ error: 'The password could not be reset.' }, 502)

  await adminClient.auth.admin.signOut(profile.auth_user_id, 'global')

  const { data: adminProfileId } = await callerClient.rpc('current_profile_id')
  const now = new Date().toISOString()

  const { error: updateError } = await adminClient
    .from('profiles')
    .update({
      must_change_password: true,
      password_reset_at: now,
      password_reset_by: adminProfileId ?? null,
      updated_at: now,
    })
    .eq('id', profileId)

  if (updateError) return json({ error: 'The mandatory password-change flag could not be set.' }, 502)

  return json({ success: true })
})
