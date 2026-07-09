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

/** Generic success — do not reveal whether the email exists. */
const ACCEPTED = {
  success: true,
  message:
    'If an account exists for that email, an administrator has been notified. You will receive a temporary password by email after approval.',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
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
    .select('id, email, display_name, auth_user_id, active, password_reset_requested_at')
    .ilike('email', email)
    .maybeSingle()

  if (profileError) return json({ error: 'Password reset request failed.' }, 502)

  // Enumeration-safe: unknown / inactive / OAuth-only accounts look the same as success.
  if (!profile || !profile.active || !profile.auth_user_id) {
    return json(ACCEPTED)
  }

  const now = new Date().toISOString()
  const alreadyPending = Boolean(profile.password_reset_requested_at)

  const { error: updateError } = await adminClient
    .from('profiles')
    .update({
      password_reset_requested_at: now,
      updated_at: now,
    })
    .eq('id', profile.id)

  if (updateError) return json({ error: 'Password reset request failed.' }, 502)

  if (!alreadyPending) {
    const { error: messageError } = await adminClient.from('app_feedback_messages').insert({
      sender_profile_id: profile.id,
      sender_name: profile.display_name || profile.email,
      sender_email: profile.email,
      category: 'improvement',
      content: `[Password reset request] ${profile.display_name || profile.email} (${profile.email}) requested a password reset. Open User Management and click Reset Password beside this account to approve.`,
      status: 'unread',
      submitted_at: now,
    })
    if (messageError) {
      // Request flag is already set; admin can still act from User Management.
      console.error('forgot-password: admin notification insert failed', messageError.message)
    }
  }

  return json(ACCEPTED)
})
