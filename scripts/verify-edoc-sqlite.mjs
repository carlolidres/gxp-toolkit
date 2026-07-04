#!/usr/bin/env node
/**
 * Validate eDoc SQLite reference schema: table coverage, FK targets, pilot seed integrity.
 * Works without sqlite3 CLI (static analysis). Runs live FK checks when sqlite3 is available.
 */

import { readFileSync, existsSync, unlinkSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SQLITE_DIR = join(ROOT, 'database', 'sqlite')

const SUPABASE_EDOC_TABLES = [
  'edoc_organizations',
  'edoc_organization_members',
  'edoc_documents',
  'edoc_document_versions',
  'edoc_document_files',
  'edoc_document_access_grants',
  'edoc_routing_templates',
  'edoc_document_routes',
  'edoc_route_steps',
  'edoc_route_step_assignees',
  'edoc_route_step_actions',
  'edoc_signature_fields',
  'edoc_signature_events',
  'edoc_completion_certificates',
  'edoc_comments',
  'edoc_notifications',
  'edoc_audit_events',
  'edoc_file_access_logs',
  'edoc_settings',
]

function readSql(name) {
  return readFileSync(join(SQLITE_DIR, name), 'utf8')
}

function extractTables(sql) {
  return [...sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)/gi)].map((m) => m[1])
}

function extractForeignKeys(sql) {
  const fks = []
  for (const match of sql.matchAll(/REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)/gi)) {
    fks.push({ table: match[1], column: match[2] })
  }
  return fks
}

function hasSqlite3() {
  return spawnSync('sqlite3', ['-version'], { encoding: 'utf8', shell: true }).status === 0
}

function runLiveValidation() {
  const tempDir = mkdtempSync(join(tmpdir(), 'gxp-edoc-'))
  const dbPath = join(tempDir, 'verify.db')
  const initSql = join(tempDir, 'init.sql')
  writeFileSync(
    initSql,
    [
      readSql('schema.sql'),
      readSql('edoc_schema.sql'),
      readSql('seed.sql'),
      readSql('edoc_seed.sql'),
      "SELECT count(*) AS org_count FROM edoc_organizations;",
      "SELECT count(*) AS doc_count FROM edoc_documents;",
      "SELECT count(*) AS assignment_count FROM edoc_route_step_assignees WHERE status = 'active';",
    ].join('\n'),
  )

  const result = spawnSync('sqlite3', [dbPath, `.read ${initSql.replace(/\\/g, '/')}`], {
    encoding: 'utf8',
    shell: true,
  })

  rmSync(tempDir, { recursive: true, force: true })

  if (result.status !== 0) {
    console.error('Live SQLite validation failed:')
    console.error(result.stderr || result.stdout)
    return false
  }

  console.log('Live SQLite validation passed (schema + seed applied without FK errors).')
  return true
}

const coreSql = readSql('schema.sql')
const edocSql = readSql('edoc_schema.sql')
const combinedTables = new Set([...extractTables(coreSql), ...extractTables(edocSql)])

let ok = true

for (const table of SUPABASE_EDOC_TABLES) {
  if (!combinedTables.has(table)) {
    console.error(`Missing SQLite table: ${table}`)
    ok = false
  }
}

if (ok) {
  console.log(`Table coverage: ${SUPABASE_EDOC_TABLES.length}/${SUPABASE_EDOC_TABLES.length} eDoc tables present in SQLite reference.`)
}

const knownTables = combinedTables
for (const fk of extractForeignKeys(edocSql)) {
  if (!knownTables.has(fk.table)) {
    console.error(`eDoc FK references unknown table: ${fk.table}`)
    ok = false
  }
}

if (ok) {
  console.log('Foreign key targets resolve within combined SQLite schema.')
}

if (hasSqlite3()) {
  ok = runLiveValidation() && ok
} else {
  console.log('sqlite3 CLI not on PATH — skipped live FK/seed apply check.')
}

if (!ok) process.exit(1)
console.log('eDoc SQLite reference verification passed.')
