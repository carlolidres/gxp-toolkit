#!/usr/bin/env node
/**
 * Parse database/sqlite/schema.sql + edoc_schema.sql and generate sqlite-out/ schema map.
 * Works without the sqlite3 CLI (regex/SQL parsing only).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SCHEMA_DIR = join(ROOT, 'database', 'sqlite')
const SCHEMA_FILES = ['schema.sql', 'edoc_schema.sql']
const OUT_DIR = join(ROOT, 'sqlite-out')

function readSchemaSql() {
  return SCHEMA_FILES.map((file) => readFileSync(join(SCHEMA_DIR, file), 'utf8')).join('\n\n')
}

/** @typedef {{ name: string, type: string, notNull: boolean, primaryKey: boolean, unique: boolean, default: string | null, check: string | null, foreignKey: ForeignKey | null }} Column */
/** @typedef {{ table: string, column: string, onDelete: string | null, onUpdate: string | null }} ForeignKey */
/** @typedef {{ name: string, table: string, columns: string[], unique: boolean }} IndexDef */
/** @typedef {{ table: string, expression: string, columns: string[] }} CheckDef */
/** @typedef {{ name: string, columns: Column[], checks: CheckDef[], foreignKeys: ForeignKey[] }} TableDef */

/**
 * @param {string} sql
 * @returns {string}
 */
function stripComments(sql) {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * @param {string} body
 * @returns {string[]}
 */
function splitDefinitions(body) {
  const parts = []
  let current = ''
  let depth = 0
  let inSingleQuote = false

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]
    const prev = body[i - 1]

    if (ch === "'" && prev !== '\\') {
      inSingleQuote = !inSingleQuote
    }

    if (!inSingleQuote) {
      if (ch === '(') depth += 1
      if (ch === ')') depth -= 1
    }

    if (ch === ',' && depth === 0 && !inSingleQuote) {
      parts.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }

  if (current.trim()) parts.push(current.trim())
  return parts
}

/**
 * @param {string} def
 * @returns {ForeignKey | null}
 */
function parseInlineForeignKey(def) {
  const match = def.match(
    /REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i,
  )
  if (!match) return null
  return {
    table: match[1],
    column: match[2],
    onDelete: match[3] ? match[3].replace(/\s+/g, ' ') : null,
    onUpdate: match[4] ? match[4].replace(/\s+/g, ' ') : null,
  }
}

/**
 * @param {string} def
 * @returns {string | null}
 */
function parseCheckExpression(def) {
  const match = def.match(/\bCHECK\s*\(([\s\S]+)\)\s*$/i)
  return match ? match[1].trim() : null
}

/**
 * @param {string} def
 * @returns {Column | null}
 */
function parseColumnDefinition(def) {
  const trimmed = def.trim()
  if (!trimmed || /^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)\b/i.test(trimmed)) {
    return null
  }

  const nameMatch = trimmed.match(/^(\w+)\s+(.+)$/s)
  if (!nameMatch) return null

  const name = nameMatch[1]
  const rest = nameMatch[2]
  const typeMatch = rest.match(/^([\w()]+(?:\s*\(\s*\d+\s*(?:,\s*\d+\s*)?\))?)/i)
  const type = typeMatch ? typeMatch[1] : 'UNKNOWN'

  const defaultMatch = rest.match(/\bDEFAULT\s+((?:\([^)]*\)|'[^']*'|"[^"]*"|[^\s,]+(?:\s+[^\s,]+)*?))(?=\s+(?:NOT\s+NULL|NULL|UNIQUE|PRIMARY|CHECK|REFERENCES|,|$))/i)
    ?? rest.match(/\bDEFAULT\s+(.+)$/i)

  return {
    name,
    type: type.toUpperCase(),
    notNull: /\bNOT\s+NULL\b/i.test(rest),
    primaryKey: /\bPRIMARY\s+KEY\b/i.test(rest),
    unique: /\bUNIQUE\b/i.test(rest) && !/\bREFERENCES\b/i.test(rest.split('UNIQUE')[0]),
    default: defaultMatch ? defaultMatch[1].trim() : null,
    check: parseCheckExpression(rest),
    foreignKey: parseInlineForeignKey(rest),
  }
}

/**
 * @param {string} def
 * @param {string} tableName
 * @returns {{ foreignKeys: ForeignKey[], checks: CheckDef[] }}
 */
function parseTableConstraint(def, tableName) {
  const trimmed = def.trim()
  const result = { foreignKeys: [], checks: [] }

  const fkMatch = trimmed.match(
    /FOREIGN\s+KEY\s*\(\s*(\w+)\s*\)\s*REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i,
  )
  if (fkMatch) {
    result.foreignKeys.push({
      table: fkMatch[2],
      column: fkMatch[3],
      onDelete: fkMatch[4] ? fkMatch[4].replace(/\s+/g, ' ') : null,
      onUpdate: fkMatch[5] ? fkMatch[5].replace(/\s+/g, ' ') : null,
      fromColumn: fkMatch[1],
    })
    return result
  }

  const checkMatch = trimmed.match(/\bCHECK\s*\(([\s\S]+)\)\s*$/i)
  if (checkMatch) {
    result.checks.push({
      table: tableName,
      expression: checkMatch[1].trim(),
      columns: extractCheckColumns(checkMatch[1]),
    })
  }

  return result
}

/**
 * @param {string} expression
 * @returns {string[]}
 */
function extractCheckColumns(expression) {
  const cols = new Set()
  const inMatch = expression.match(/(\w+)\s+IN\s*\(/i)
  if (inMatch) cols.add(inMatch[1])
  return [...cols]
}

/**
 * @param {string} sql
 * @returns {TableDef[]}
 */
function parseTables(sql) {
  const tables = []
  const tableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\)\s*;/gi

  let match
  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1]
    const body = match[2]
    /** @type {Column[]} */
    const columns = []
    /** @type {ForeignKey[]} */
    const foreignKeys = []
    /** @type {CheckDef[]} */
    const checks = []

    for (const def of splitDefinitions(body)) {
      const column = parseColumnDefinition(def)
      if (column) {
        columns.push(column)
        if (column.foreignKey) {
          foreignKeys.push({ ...column.foreignKey, fromColumn: column.name })
        }
        if (column.check) {
          checks.push({
            table: tableName,
            expression: column.check,
            columns: extractCheckColumns(column.check),
          })
        }
        continue
      }

      const constraint = parseTableConstraint(def, tableName)
      foreignKeys.push(...constraint.foreignKeys)
      checks.push(...constraint.checks)
    }

    tables.push({ name: tableName, columns, checks, foreignKeys })
  }

  return tables
}

/**
 * @param {string} sql
 * @returns {IndexDef[]}
 */
function parseIndexes(sql) {
  const indexes = []
  const indexRegex =
    /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+(\w+)\s*\(\s*([^)]+)\s*\)\s*;/gi

  let match
  while ((match = indexRegex.exec(sql)) !== null) {
    indexes.push({
      name: match[2],
      unique: Boolean(match[1]),
      table: match[3],
      columns: match[4].split(',').map((c) => c.trim()),
    })
  }

  return indexes
}

/**
 * @param {string} sql
 * @returns {number | null}
 */
function parseSchemaVersion(sql) {
  const match = sql.match(
    /INSERT\s+OR\s+(?:IGNORE|REPLACE)\s+INTO\s+schema_migrations\s*\([^)]*\)\s*VALUES\s*\(\s*(\d+)/i,
  )
  return match ? Number(match[1]) : null
}

/**
 * @param {TableDef[]} tables
 * @returns {object[]}
 */
function buildEdges(tables) {
  /** @type {object[]} */
  const edges = []

  for (const table of tables) {
    for (const fk of table.foreignKeys) {
      edges.push({
        id: `${table.name}.${fk.fromColumn}->${fk.table}.${fk.column}`,
        type: 'foreign_key',
        from: { table: table.name, column: fk.fromColumn },
        to: { table: fk.table, column: fk.column },
        onDelete: fk.onDelete,
        onUpdate: fk.onUpdate,
      })
    }
  }

  return edges
}

/**
 * @param {TableDef[]} tables
 * @param {IndexDef[]} indexes
 * @param {number | null} schemaVersion
 * @returns {object}
 */
function buildSchemaJson(tables, indexes, schemaVersion) {
  const nodes = tables.map((table) => ({
    id: table.name,
    type: 'table',
    columnCount: table.columns.length,
    primaryKeys: table.columns.filter((c) => c.primaryKey).map((c) => c.name),
    uniqueColumns: table.columns.filter((c) => c.unique).map((c) => c.name),
    columns: table.columns.map((c) => ({
      name: c.name,
      type: c.type,
      notNull: c.notNull,
      primaryKey: c.primaryKey,
      unique: c.unique,
      default: c.default,
      check: c.check,
      references: c.foreignKey
        ? {
            table: c.foreignKey.table,
            column: c.foreignKey.column,
            onDelete: c.foreignKey.onDelete,
            onUpdate: c.foreignKey.onUpdate,
          }
        : null,
    })),
    checks: table.checks,
    indexes: indexes.filter((idx) => idx.table === table.name),
  }))

  return {
    meta: {
      project: 'gxp-toolkit',
      source: SCHEMA_FILES.map((file) => relative(ROOT, join(SCHEMA_DIR, file)).replace(/\\/g, '/')).join(' + '),
      generatedAt: new Date().toISOString(),
      schemaVersion,
      tableCount: tables.length,
      edgeCount: buildEdges(tables).length,
      indexCount: indexes.length,
    },
    nodes,
    edges: buildEdges(tables),
    indexes,
  }
}

/**
 * @param {object} schema
 * @returns {string}
 */
function buildMermaidEr(schema) {
  const lines = ['erDiagram']
  const rendered = new Set()

  for (const edge of schema.edges) {
    const key = `${edge.from.table}-${edge.to.table}-${edge.from.column}`
    if (rendered.has(key)) continue
    rendered.add(key)
    const cardinality = edge.onDelete === 'CASCADE' ? '||--o{' : '||--o{'
    lines.push(`  ${edge.to.table} ${cardinality} ${edge.from.table} : "${edge.from.column}"`)
  }

  for (const node of schema.nodes) {
    lines.push(`  ${node.id} {`)
    for (const col of node.columns) {
      const tags = []
      if (col.primaryKey) tags.push('PK')
      if (col.unique) tags.push('UK')
      if (col.references) tags.push('FK')
      const suffix = tags.length ? ` ${tags.join(' ')}` : ''
      lines.push(`    ${col.type.toLowerCase()} ${col.name}${suffix}`)
    }
    lines.push('  }')
  }

  return lines.join('\n')
}

/**
 * @param {object} schema
 * @returns {string}
 */
function buildReport(schema) {
  const date = schema.meta.generatedAt.slice(0, 10)
  const lines = [
    `# SQLite Schema Report — GxP Toolkit (${date})`,
    '',
    '## Summary',
    `- Source: \`${schema.meta.source}\``,
    `- Schema version: **${schema.meta.schemaVersion ?? 'unknown'}**`,
    `- Tables: **${schema.meta.tableCount}** · Foreign keys: **${schema.meta.edgeCount}** · Indexes: **${schema.meta.indexCount}**`,
    `- Generated: ${schema.meta.generatedAt}`,
    '',
    '## Agent Usage',
    '',
    'Read this file and `sqlite-out/schema.json` after Graphify when touching data models, services, or types.',
    'Regenerate with `npm run db:map` after editing `database/sqlite/schema.sql`.',
    '',
    '## Tables',
    '',
  ]

  for (const node of schema.nodes) {
    lines.push(`### \`${node.id}\``)
    lines.push('')
    lines.push('| Column | Type | Null | PK | Unique | Default | Check | References |')
    lines.push('|--------|------|------|----|--------|---------|-------|------------|')

    for (const col of node.columns) {
      const refs = col.references
        ? `\`${col.references.table}.${col.references.column}\`${col.references.onDelete ? ` ON DELETE ${col.references.onDelete}` : ''}`
        : ''
      lines.push(
        `| \`${col.name}\` | ${col.type} | ${col.notNull ? 'NO' : 'YES'} | ${col.primaryKey ? 'YES' : ''} | ${col.unique ? 'YES' : ''} | ${col.default ?? ''} | ${col.check ? `\`${col.check.slice(0, 40)}${col.check.length > 40 ? '…' : ''}\`` : ''} | ${refs} |`,
      )
    }

    if (node.indexes.length) {
      lines.push('')
      lines.push('**Indexes:**')
      for (const idx of node.indexes) {
        lines.push(`- \`${idx.name}\` (${idx.columns.join(', ')})${idx.unique ? ' UNIQUE' : ''}`)
      }
    }

    if (node.checks?.length) {
      lines.push('')
      lines.push('**CHECK constraints:**')
      for (const check of node.checks) {
        lines.push(`- \`${check.expression.slice(0, 80)}${check.expression.length > 80 ? '…' : ''}\``)
      }
    }

    lines.push('')
  }

  if (schema.edges.length) {
    lines.push('## Relationships')
    lines.push('')
    for (const edge of schema.edges) {
      const actions = [edge.onDelete && `ON DELETE ${edge.onDelete}`, edge.onUpdate && `ON UPDATE ${edge.onUpdate}`]
        .filter(Boolean)
        .join(', ')
      lines.push(
        `- \`${edge.from.table}.${edge.from.column}\` → \`${edge.to.table}.${edge.to.column}\`${actions ? ` (${actions})` : ''}`,
      )
    }
    lines.push('')
  }

  if (schema.indexes.length) {
    lines.push('## All Indexes')
    lines.push('')
    lines.push('| Index | Table | Columns | Unique |')
    lines.push('|-------|-------|---------|--------|')
    for (const idx of schema.indexes) {
      lines.push(`| \`${idx.name}\` | \`${idx.table}\` | ${idx.columns.join(', ')} | ${idx.unique ? 'YES' : ''} |`)
    }
    lines.push('')
  }

  lines.push('## Entity Relationship Diagram')
  lines.push('')
  lines.push('```mermaid')
  lines.push(buildMermaidEr(schema))
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}

/**
 * @param {object} schema
 * @returns {string}
 */
function buildHtml(schema) {
  const tableCards = schema.nodes
    .map((node) => {
      const rows = node.columns
        .map((col) => {
          const badges = [
            col.primaryKey ? '<span class="badge pk">PK</span>' : '',
            col.unique ? '<span class="badge uk">UK</span>' : '',
            col.references ? `<span class="badge fk" title="→ ${col.references.table}.${col.references.column}">FK</span>` : '',
            col.notNull ? '<span class="badge nn">NOT NULL</span>' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return `<tr><td><code>${col.name}</code></td><td>${col.type}</td><td>${badges}</td></tr>`
        })
        .join('')

      return `<section class="table-card" id="table-${node.id}"><h2>${node.id}</h2><table><thead><tr><th>Column</th><th>Type</th><th>Flags</th></tr></thead><tbody>${rows}</tbody></table></section>`
    })
    .join('\n')

  const fkLines = schema.edges
    .map(
      (edge) =>
        `<li><code>${edge.from.table}.${edge.from.column}</code> → <code>${edge.to.table}.${edge.to.column}</code>${edge.onDelete ? ` <em>(ON DELETE ${edge.onDelete})</em>` : ''}</li>`,
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GxP Toolkit — SQLite Schema Map</title>
  <style>
    :root { --bg: #0f1419; --card: #1a2332; --text: #e7ecf3; --muted: #8b9cb3; --accent: #4da3ff; --pk: #ffd166; --fk: #06d6a0; --uk: #c77dff; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; }
    header { padding: 1.5rem 2rem; border-bottom: 1px solid #2a3548; }
    header h1 { margin: 0 0 .25rem; font-size: 1.4rem; }
    header p { margin: 0; color: var(--muted); font-size: .9rem; }
    main { padding: 1.5rem 2rem 3rem; display: grid; gap: 1.25rem; }
    .meta { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: .5rem; }
    .meta span { background: var(--card); padding: .35rem .75rem; border-radius: 999px; font-size: .85rem; }
    .relationships { background: var(--card); border-radius: 12px; padding: 1rem 1.25rem; }
    .relationships h2 { margin-top: 0; font-size: 1rem; }
    .relationships ul { margin: 0; padding-left: 1.2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
    .table-card { background: var(--card); border-radius: 12px; padding: 1rem; border: 1px solid #2a3548; }
    .table-card h2 { margin: 0 0 .75rem; font-size: 1.05rem; color: var(--accent); }
    table { width: 100%; border-collapse: collapse; font-size: .85rem; }
    th, td { text-align: left; padding: .35rem .25rem; border-bottom: 1px solid #2a3548; vertical-align: top; }
    th { color: var(--muted); font-weight: 600; }
    .badge { display: inline-block; font-size: .65rem; padding: .1rem .35rem; border-radius: 4px; margin-right: .2rem; font-weight: 700; }
    .pk { background: #4a3f00; color: var(--pk); }
    .fk { background: #0a3d2e; color: var(--fk); }
    .uk { background: #2e1a4a; color: var(--uk); }
    .nn { background: #2a3548; color: var(--muted); }
    svg { width: 100%; max-width: 900px; height: auto; background: var(--card); border-radius: 12px; border: 1px solid #2a3548; }
    .diagram-wrap { overflow-x: auto; }
  </style>
</head>
<body>
  <header>
    <h1>GxP Toolkit — SQLite Schema Map</h1>
    <p>Generated from ${schema.meta.source} · ${schema.meta.generatedAt}</p>
  </header>
  <main>
    <div class="meta">
      <span>Schema v${schema.meta.schemaVersion ?? '?'}</span>
      <span>${schema.meta.tableCount} tables</span>
      <span>${schema.meta.edgeCount} foreign keys</span>
      <span>${schema.meta.indexCount} indexes</span>
    </div>
    <section class="relationships">
      <h2>Foreign Key Relationships</h2>
      <ul>${fkLines || '<li>No foreign keys</li>'}</ul>
    </section>
    <div class="diagram-wrap">${buildSvgDiagram(schema)}</div>
    <div class="grid">${tableCards}</div>
  </main>
</body>
</html>`
}

/**
 * @param {object} schema
 * @returns {string}
 */
function buildSvgDiagram(schema) {
  const tables = schema.nodes.map((n) => n.id)
  const positions = new Map()
  const cols = Math.ceil(Math.sqrt(tables.length))
  const cellW = 180
  const cellH = 100

  tables.forEach((name, i) => {
    positions.set(name, {
      x: 40 + (i % cols) * cellW,
      y: 40 + Math.floor(i / cols) * cellH,
    })
  })

  const edges = schema.edges
    .map((edge) => {
      const from = positions.get(edge.from.table)
      const to = positions.get(edge.to.table)
      if (!from || !to) return ''
      return `<line x1="${from.x + 70}" y1="${from.y + 20}" x2="${to.x + 70}" y2="${to.y + 20}" stroke="#4da3ff" stroke-width="1.5" marker-end="url(#arrow)" opacity="0.7"/>`
    })
    .join('\n')

  const nodes = tables
    .map((name) => {
      const pos = positions.get(name)
      return `<g><rect x="${pos.x}" y="${pos.y}" width="140" height="40" rx="8" fill="#1a2332" stroke="#4da3ff"/><text x="${pos.x + 70}" y="${pos.y + 25}" text-anchor="middle" fill="#e7ecf3" font-size="12">${name}</text></g>`
    })
    .join('\n')

  const width = cols * cellW + 40
  const height = Math.ceil(tables.length / cols) * cellH + 60

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#4da3ff"/></marker></defs>${edges}${nodes}</svg>`
}

function main() {
  const raw = readSchemaSql()
  const sql = stripComments(raw)
  const tables = parseTables(sql)
  const indexes = parseIndexes(sql)
  const schemaVersion = parseSchemaVersion(sql)
  const schema = buildSchemaJson(tables, indexes, schemaVersion)

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'schema.json'), `${JSON.stringify(schema, null, 2)}\n`)
  writeFileSync(join(OUT_DIR, 'SCHEMA_REPORT.md'), buildReport(schema))
  writeFileSync(join(OUT_DIR, 'schema-map.html'), buildHtml(schema))

  console.log(`SQLite schema map generated in ${relative(ROOT, OUT_DIR)}/`)
  console.log(`  ${schema.meta.tableCount} tables, ${schema.meta.edgeCount} foreign keys, ${schema.meta.indexCount} indexes`)
}

main()
