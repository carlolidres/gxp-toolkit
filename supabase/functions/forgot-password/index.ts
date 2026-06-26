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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const defaultPassword = Deno.env.get('DEFAULT_RESET_PASSWORD')?.trim()
  if (!supabaseUrl || !serviceRoleKey || !defaultPassword) {
    return json({ error: 'The password reset service is not configured.' }, 503)
  }

  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'A valid email address is required.' }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, email, auth_user_id, active')
    .ilike('email', email)
    .maybeSingle()

  if (profileError || !profile) {
    return json({ error: 'No email/password account was found for that address.' }, 404)
  }
  if (!profile.active) {
    return json({ error: 'This account is inactive. Contact an administrator.' }, 400)
  }
  if (!profile.auth_user_id) {
    return json(
      { error: 'This account uses Google or Microsoft sign-in. Use that provider instead of a password reset.' },
      400,
    )
  }

  const { error: passwordError } = await adminClient.auth.admin.updateUserById(profile.auth_user_id, {
    password: defaultPassword,
  })
  if (passwordError) return json({ error: 'The password could not be reset.' }, 502)

  await adminClient.auth.admin.signOut(profile.auth_user_id, 'global')

  const now = new Date().toISOString()
  const { error: updateError } = await adminClient
    .from('profiles')
    .update({
      must_change_password: true,
      password_reset_at: now,
      password_reset_by: null,
      updated_at: now,
    })
    .eq('id', profile.id)

  if (updateError) return json({ error: 'The mandatory password-change flag could not be set.' }, 502)

  return json({ success: true, temporaryPassword: defaultPassword })
})
