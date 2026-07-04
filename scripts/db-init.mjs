#!/usr/bin/env node
/**
 * Apply schema.sql + seed.sql when sqlite3 CLI is available; otherwise skip gracefully.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function hasSqlite3() {
  const result = spawnSync('sqlite3', ['-version'], { encoding: 'utf8', shell: true })
  return result.status === 0
}

function runInit() {
  const dbPath = join(ROOT, 'database', 'sqlite', 'dev.db')
  const schemaPath = join(ROOT, 'database', 'sqlite', 'schema.sql')
  const edocSchemaPath = join(ROOT, 'database', 'sqlite', 'edoc_schema.sql')
  const seedPath = join(ROOT, 'database', 'sqlite', 'seed.sql')
  const edocSeedPath = join(ROOT, 'database', 'sqlite', 'edoc_seed.sql')

  if (!existsSync(schemaPath)) {
    console.error('Missing database/sqlite/schema.sql')
    process.exit(1)
  }

  const read = (p) => p.replace(/\\/g, '/')
  const args = [
    dbPath,
    `.read ${read(schemaPath)}`,
    `.read ${read(edocSchemaPath)}`,
    `.read ${read(seedPath)}`,
    `.read ${read(edocSeedPath)}`,
  ]
  const result = spawnSync('sqlite3', args, { encoding: 'utf8', cwd: ROOT, shell: true })

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || 'sqlite3 init failed')
    process.exit(result.status ?? 1)
  }

  console.log(`SQLite database initialized at database/sqlite/dev.db`)
}

if (!hasSqlite3()) {
  console.log('sqlite3 CLI not on PATH — skipping db init. Use schema.sql / seed.sql and npm run db:map as reference.')
  process.exit(0)
}

runInit()
