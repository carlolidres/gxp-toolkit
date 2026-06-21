#!/usr/bin/env node
/**
 * Delete dev.db and re-run db:init (graceful when sqlite3 CLI missing).
 */

import { spawnSync } from 'node:child_process'
import { unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DB_PATH = join(ROOT, 'database', 'sqlite', 'dev.db')

try {
  unlinkSync(DB_PATH)
  console.log('Removed database/sqlite/dev.db')
} catch {
  /* file may not exist */
}

const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'db:init'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
})

process.exit(result.status ?? 0)
