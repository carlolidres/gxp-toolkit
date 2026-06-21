#!/usr/bin/env node
/**
 * Regenerate sqlite-out/ and apply dev.db when sqlite3 CLI is available.
 */

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function runNpmScript(script) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

runNpmScript('db:map')

const sqliteCheck = spawnSync('sqlite3', ['-version'], { encoding: 'utf8', shell: true })
if (sqliteCheck.status === 0) {
  runNpmScript('db:init')
} else {
  console.log('sqlite3 CLI unavailable — db:update completed schema map only.')
}
