import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const csvDir = join(process.cwd(), 'reference', 'VRMSdatabase')
const bundle = JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'vrmsProductionData.json'), 'utf8'))

const csvFiles = [
  ['VRMS - AuditTrail.csv', 'auditEvents'],
  ['VRMS - Documents.csv', 'routingDocuments'],
  ['VRMS - Registry_Category.csv', 'Category'],
  ['VRMS - Registry_CheckedBy.csv', 'Checked by'],
  ['VRMS - Registry_Client.csv', 'Client'],
  ['VRMS - Registry_Department.csv', 'Department'],
  ['VRMS - Registry_PreparedBy.csv', 'Prepared by'],
  ['VRMS - Registry_ReportProtocol.csv', 'Report / Protocol'],
  ['VRMS - Registry_SentRouting.csv', 'Sent / Routing'],
  ['VRMS - Registry_Status.csv', 'Status'],
]

function parseCsv(text) {
  const rows = []
  let row = []
  let value = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const next = text[index + 1]

    if (character === '"') {
      if (inQuotes && next === '"') {
        value += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === ',' && !inQuotes) {
      row.push(value)
      value = ''
      continue
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && next === '\n') index += 1
      row.push(value)
      if (row.some((cell) => cell.length)) rows.push(row)
      row = []
      value = ''
      continue
    }

    value += character
  }

  if (value.length || row.length) {
    row.push(value)
    if (row.some((cell) => cell.length)) rows.push(row)
  }

  return rows.length > 0 ? rows.slice(1) : []
}

function appCount(target) {
  if (target === 'auditEvents' || target === 'routingDocuments') return bundle[target].length
  return bundle.registryValues.filter((row) => row.registryType === target).length
}

const results = csvFiles.map(([file, target]) => {
  const csvRows = parseCsv(readFileSync(join(csvDir, file), 'utf8')).length
  const bundledRows = appCount(target)
  return { file, target, csvRows, bundledRows, match: csvRows === bundledRows }
})

const failed = results.filter((row) => !row.match)
console.table(results)

if (failed.length) {
  console.error(`VRMS CSV bundle check failed for ${failed.length} file(s).`)
  process.exit(1)
}

const invalidAuditRows = bundle.auditEvents.filter((event) => {
  const detailsLooksLikeDocTracer = /^VMP-/.test(event.details)
  const routingTrackerLooksLikeDetails = event.routingTracker.length > 30
  return detailsLooksLikeDocTracer || routingTrackerLooksLikeDetails
})

if (invalidAuditRows.length) {
  console.error(`VRMS audit field check failed for ${invalidAuditRows.length} row(s).`)
  console.error(JSON.stringify(invalidAuditRows.slice(0, 3), null, 2))
  process.exit(1)
}

console.log('PASS: all VRMS CSV row counts are present in src/data/vrmsProductionData.json.')
console.log('PASS: audit event routing tracker, doc tracer, and details fields are semantically aligned.')
