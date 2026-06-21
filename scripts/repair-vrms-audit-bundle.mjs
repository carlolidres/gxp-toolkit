import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const auditCsvPath = join(process.cwd(), 'reference', 'VRMSdatabase', 'VRMS - AuditTrail.csv')
const bundlePath = join(process.cwd(), 'src', 'data', 'vrmsProductionData.json')

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

  return rows
}

const rows = parseCsv(readFileSync(auditCsvPath, 'utf8')).slice(1)
const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'))

bundle.auditEvents = rows.map((row, index) => {
  const trackerOrBlank = row[3] ?? ''
  const middle = row[4] ?? ''
  const trailingDetails = row[5] ?? ''

  return {
    id: `audit-${index + 1}`,
    timestamp: row[0] ?? '',
    userEmail: row[1] ?? '',
    action: row[2] ?? '',
    routingTracker: trackerOrBlank,
    docTracer: trailingDetails ? middle : '',
    details: trailingDetails || middle,
  }
})

writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`)
console.log(`Repaired ${bundle.auditEvents.length} audit events in ${bundlePath}`)
