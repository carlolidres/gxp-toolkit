#!/usr/bin/env node
/**
 * Create disposable eDoc staging auth users (example.test). Requires service role — never commit the key.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... STAGING_EDOC_TEST_PASSWORD=... npm run edoc:provision-test-users
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const TEST_USERS = [
  { email: 'edoc-reviewer@example.test', displayName: 'Staging eDoc Reviewer' },
  { email: 'edoc-creator@example.test', displayName: 'Staging eDoc Creator' },
  { email: 'edoc-outsider@example.test', displayName: 'Staging eDoc Outsider' },
]

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

const envLocal = loadEnvLocal()
const url = process.env.VITE_SUPABASE_URL ?? envLocal.VITE_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const password = process.env.STAGING_EDOC_TEST_PASSWORD ?? process.env.E2E_EDOC_TEST_PASSWORD ?? ''

if (!url || url.includes('your-project')) {
  console.error('Set VITE_SUPABASE_URL (or .env.local) to the staging project URL.')
  process.exit(1)
}
if (!serviceKey) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY (Dashboard → Settings → API). Do not commit this key.')
  process.exit(1)
}
if (!password || password.length < 12) {
  console.error('Set STAGING_EDOC_TEST_PASSWORD (min 12 chars) for disposable test accounts.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

let failed = 0
for (const user of TEST_USERS) {
  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = listed?.users?.find((u) => u.email?.toLowerCase() === user.email)
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { display_name: user.displayName },
    })
    if (error) {
      console.error(`FAIL update ${user.email}:`, error.message)
      failed += 1
    } else {
      console.log(`OK updated ${user.email}`)
    }
    continue
  }

  const { error } = await admin.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: { display_name: user.displayName },
  })
  if (error) {
    console.error(`FAIL create ${user.email}:`, error.message)
    failed += 1
  } else {
    console.log(`OK created ${user.email}`)
  }
}

if (failed) process.exit(1)
console.log('Done. Run: npm run edoc:seed-staging-test')
