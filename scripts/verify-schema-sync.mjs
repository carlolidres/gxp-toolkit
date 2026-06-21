#!/usr/bin/env node
/**
 * Verify src/data mocks align with database/sqlite/seed.sql (IDs and counts).
 * Prevents schema/mock drift without requiring sqlite3 CLI.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function extractIdsFromTs(filePath, pattern) {
  const text = readFileSync(filePath, 'utf8')
  return [...text.matchAll(pattern)].map((m) => m[1])
}

function extractSeedIds(table) {
  const seed = readFileSync(join(ROOT, 'database', 'sqlite', 'seed.sql'), 'utf8')
  const regex = new RegExp(`INSERT OR REPLACE INTO ${table}[\\s\\S]*?VALUES\\s*([\\s\\S]*?);`, 'i')
  const match = seed.match(regex)
  if (!match) return []
  return [...match[1].matchAll(/\('([^']+)'/g)].map((m) => m[1])
}

function compare(label, mockIds, seedIds) {
  const mockSet = new Set(mockIds)
  const seedSet = new Set(seedIds)
  const missingInSeed = mockIds.filter((id) => !seedSet.has(id))
  const extraInSeed = seedIds.filter((id) => !mockSet.has(id))
  if (missingInSeed.length || extraInSeed.length) {
    console.error(`${label} ID mismatch:`)
    if (missingInSeed.length) console.error(`  In mocks, missing from seed: ${missingInSeed.join(', ')}`)
    if (extraInSeed.length) console.error(`  In seed, missing from mocks: ${extraInSeed.join(', ')}`)
    return false
  }
  console.log(`${label}: ${mockIds.length} IDs aligned`)
  return true
}

const checks = [
  compare(
    'users',
    extractIdsFromTs(join(ROOT, 'src', 'data', 'mockAuth.ts'), /id:\s*'([^']+)'/g),
    extractSeedIds('users'),
  ),
  compare(
    'documents',
    extractIdsFromTs(join(ROOT, 'src', 'data', 'mockDocuments.ts'), /id:\s*'([^']+)'/g).filter((id) => id.startsWith('d')),
    extractSeedIds('documents'),
  ),
]

if (!checks.every(Boolean)) {
  process.exit(1)
}

console.log('Schema/mock sync verification passed.')
