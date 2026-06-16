#!/usr/bin/env node
/**
 * Validate environment files for GxP Toolkit.
 * Run: npm run verify:env
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const EXAMPLE = join(ROOT, '.env.example')
const LOCAL = join(ROOT, '.env.local')

const VALID_APP_ENVS = new Set(['development', 'staging', 'production'])

function parseEnv(content) {
  const vars = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return vars
}

let failed = false

function fail(msg) {
  console.error(`verify:env FAIL — ${msg}`)
  failed = true
}

function warn(msg) {
  console.warn(`verify:env WARN — ${msg}`)
}

function ok(msg) {
  console.log(`verify:env OK — ${msg}`)
}

if (!existsSync(EXAMPLE)) {
  fail('.env.example is missing')
} else {
  const example = readFileSync(EXAMPLE, 'utf8')
  const vars = parseEnv(example)

  if (vars.VITE_SUPABASE_ANON_KEY?.startsWith('eyJ')) {
    fail('.env.example contains a real Supabase anon key. Use your-anon-key-here — real keys belong in .env.local only.')
  }

  if (vars.VITE_APP_ENV && (vars.VITE_APP_ENV.startsWith('/') || vars.VITE_APP_ENV.includes('github'))) {
    fail(`VITE_APP_ENV in .env.example must be development|staging|production, not a path (got "${vars.VITE_APP_ENV}"). Use VITE_BASE_PATH for GitHub Pages subpath.`)
  }

  ok('.env.example structure checked')
}

if (existsSync(LOCAL)) {
  const local = readFileSync(LOCAL, 'utf8')
  const vars = parseEnv(local)

  if (vars.VITE_APP_ENV && !VALID_APP_ENVS.has(vars.VITE_APP_ENV)) {
    if (vars.VITE_APP_ENV.startsWith('/')) {
      fail(
        `VITE_APP_ENV="${vars.VITE_APP_ENV}" looks like a base path. Set VITE_APP_ENV=development and use VITE_BASE_PATH=${vars.VITE_APP_ENV} instead.`,
      )
    } else {
      warn(`VITE_APP_ENV="${vars.VITE_APP_ENV}" is not development|staging|production`)
    }
  }

  if (vars.VITE_BASE_PATH && !vars.VITE_BASE_PATH.startsWith('/')) {
    warn(`VITE_BASE_PATH should start with / (e.g. /gxp-toolkit/)`)
  }

  ok('.env.local structure checked')
} else {
  warn('.env.local not found — copy .env.example to .env.local for local dev')
}

if (failed) {
  process.exit(1)
}

console.log('verify:env passed')
