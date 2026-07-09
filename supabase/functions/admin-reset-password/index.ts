import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.10.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const DIGITS = '23456789'
const SPECIAL = '!@#$%^&*-_=+'
const ALL = UPPER + LOWER + DIGITS + SPECIAL

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function pick(charset: string, bytes: Uint8Array, index: number): string {
  return charset[bytes[index]! % charset.length]!
}

function generateTemporaryPassword(length = 16): string {
  const bytes = new Uint8Array(length + 4)
  crypto.getRandomValues(bytes)
  const chars = [
    pick(UPPER, bytes, 0),
    pick(LOWER, bytes, 1),
    pick(DIGITS, bytes, 2),
    pick(SPECIAL, bytes, 3),
  ]
  for (let i = 0; i < length - 4; i += 1) {
    chars.push(pick(ALL, bytes, i + 4))
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = bytes[i]! % (i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join('')
}

function resolveFromAddress(gmailUser: string): string {
  const configured = Deno.env.get('PASSWORD_RESET_FROM_EMAIL')?.trim()
  if (configured) return configured
  return `GxP Toolkit <${gmailUser}>`
}

async function sendTemporaryPasswordEmail(options: {
  to: string
  displayName: string
  temporaryPassword: string
}): Promise<void> {
  const gmailUser = Deno.env.get('GMAIL_USER')?.trim()
  const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD')?.trim()?.replace(/\s+/g, '')
  if (!gmailUser || !gmailAppPassword) {
    throw new Error(
      'Email delivery is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD secrets (Gmail App Password).',
    )
  }

  const from = resolveFromAddress(gmailUser)
  const subject = 'Your temporary GxP Toolkit password'
  const text = [
    `Hello ${options.displayName || options.to},`,
    '',
    'An administrator approved your password reset request.',
    'Use the temporary password below to sign in, then create a new password immediately.',
    '',
    `Temporary password: ${options.temporaryPassword}`,
    '',
    'If you did not request this reset, contact your administrator.',
  ].join('\n')

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  })

  try {
    await transporter.sendMail({
      from,
      to: options.to,
      subject,
      text,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to email temporary password via Gmail SMTP: ${detail}`)
  } finally {
    transporter.close()
  }
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
    .select('id, email, display_name, auth_user_id, active, password_reset_requested_at')
    .eq('id', profileId)
    .maybeSingle()

  if (profileError || !profile) return json({ error: 'The selected user profile was not found.' }, 404)
  if (!profile.active) return json({ error: 'Cannot reset password for an inactive account.' }, 400)
  if (!profile.auth_user_id) {
    return json({ error: 'This account has no email/password login linked. Password reset is not available.' }, 400)
  }
  if (!profile.password_reset_requested_at) {
    return json({ error: 'No pending password reset request for this user.' }, 400)
  }

  const temporaryPassword = generateTemporaryPassword(16)

  // Email first so a delivery failure does not leave an unknown password on the account.
  try {
    await sendTemporaryPasswordEmail({
      to: profile.email,
      displayName: profile.display_name || profile.email,
      temporaryPassword,
    })
  } catch (emailError) {
    return json(
      {
        error:
          emailError instanceof Error
            ? emailError.message
            : 'The temporary password could not be emailed. Password was not changed.',
      },
      502,
    )
  }

  const { error: passwordError } = await adminClient.auth.admin.updateUserById(profile.auth_user_id, {
    password: temporaryPassword,
  })
  if (passwordError) {
    return json(
      {
        error:
          'The temporary password was emailed but could not be applied to the account. Retry Reset Password or contact support.',
      },
      502,
    )
  }

  await adminClient.auth.admin.signOut(profile.auth_user_id, 'global')

  const { data: adminProfileId } = await callerClient.rpc('current_profile_id')
  const now = new Date().toISOString()

  const { error: updateError } = await adminClient
    .from('profiles')
    .update({
      must_change_password: true,
      password_reset_at: now,
      password_reset_by: adminProfileId ?? null,
      password_reset_requested_at: null,
      updated_at: now,
    })
    .eq('id', profileId)

  if (updateError) {
    return json(
      {
        error:
          'Password was emailed and applied, but the must-change flag could not be set. Ask the user to change password after sign-in, or retry.',
      },
      502,
    )
  }

  return json({ success: true, emailed: true })
})
