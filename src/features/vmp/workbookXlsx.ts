import { createSheet, createWorkbook, type EquipmentSheet, type EquipmentWorkbook } from './equipmentWorkbook'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export async function workbookToXlsx(workbook: EquipmentWorkbook): Promise<Uint8Array> {
  const files: { name: string; data: Uint8Array }[] = []
  const sheetFiles = workbook.sheets.map((sheet, index) => ({
    sheet,
    id: index + 1,
    path: `xl/worksheets/sheet${index + 1}.xml`,
  }))
  files.push({ name: '[Content_Types].xml', data: encoder.encode(contentTypes(sheetFiles.length)) })
  files.push({ name: '_rels/.rels', data: encoder.encode(rootRels()) })
  files.push({ name: 'xl/workbook.xml', data: encoder.encode(workbookXml(sheetFiles.map((item) => item.sheet.name))) })
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRels(sheetFiles.length)) })
  for (const item of sheetFiles) files.push({ name: item.path, data: encoder.encode(sheetXml(item.sheet)) })
  return zipFiles(files)
}

export async function xlsxToWorkbook(buffer: ArrayBuffer): Promise<EquipmentWorkbook> {
  const files = await unzipFiles(new Uint8Array(buffer))
  const workbookXmlText = textFile(files, 'xl/workbook.xml')
  const workbookDoc = new DOMParser().parseFromString(workbookXmlText, 'application/xml')
  const names = [...workbookDoc.getElementsByTagName('sheet')].map((sheet) => sheet.getAttribute('name') || 'Sheet')
  const rels = new DOMParser().parseFromString(textFile(files, 'xl/_rels/workbook.xml.rels'), 'application/xml')
  const targets = [...rels.getElementsByTagName('Relationship')].map((item) => item.getAttribute('Target') || '')
  const shared = files.get('xl/sharedStrings.xml')
  const strings = shared ? sharedStrings(decoder.decode(shared)) : []
  const workbook = createWorkbook()
  workbook.name = 'Equipment Masterlist'
  workbook.sheets = names.map((name, index) => {
    const target = targets[index] || `worksheets/sheet${index + 1}.xml`
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
    const xml = textFile(files, path)
    return sheetFromXml(name, xml, strings)
  })
  const first = workbook.sheets[0]
  if (first) workbook.activeSheetId = first.id
  return workbook
}

function contentTypes(count: number): string {
  const sheets = Array.from({ length: count }, (_, index) => (
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets}
</Types>`
}

function rootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
}

function workbookXml(names: string[]): string {
  const sheets = names.map((name, index) => (
    `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  )).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets}</sheets>
</workbook>`
}

function workbookRels(count: number): string {
  const rows = Array.from({ length: count }, (_, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rows}</Relationships>`
}

function sheetXml(sheet: EquipmentSheet): string {
  const rows = new Map<number, Map<number, string>>()
  for (const [key, value] of Object.entries(sheet.cells)) {
    const [row, column] = key.split(':').map(Number)
    if (!Number.isInteger(row) || !Number.isInteger(column)) continue
    const line = rows.get(row) ?? new Map<number, string>()
    line.set(column, value)
    rows.set(row, line)
  }
  const body = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([row, cells]) => {
    const values = [...cells.entries()].sort((a, b) => a[0] - b[0]).map(([column, value]) => (
      `<c r="${columnName(column)}${row + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
    )).join('')
    return `<row r="${row + 1}">${values}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`
}

function sheetFromXml(name: string, xml: string, shared: string[]): EquipmentSheet {
  const sheet = createSheet(name, 120, 9)
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  for (const cell of doc.getElementsByTagName('c')) {
    const ref = cell.getAttribute('r') || ''
    const match = /^([A-Z]+)(\d+)$/.exec(ref)
    if (!match) continue
    const column = columnIndex(match[1] ?? '')
    const row = Number(match[2]) - 1
    const type = cell.getAttribute('t')
    let value = ''
    if (type === 'inlineStr') value = cell.getElementsByTagName('t')[0]?.textContent ?? ''
    else if (type === 's') value = shared[Number(cell.getElementsByTagName('v')[0]?.textContent ?? '-1')] ?? ''
    else value = cell.getElementsByTagName('v')[0]?.textContent ?? ''
    if (value) sheet.cells[`${row}:${column}`] = value
    sheet.rowCount = Math.max(sheet.rowCount, row + 1)
    sheet.columnCount = Math.max(sheet.columnCount, column + 1)
  }
  while (sheet.rowHeights.length < sheet.rowCount) sheet.rowHeights.push(24)
  while (sheet.columnWidths.length < sheet.columnCount) sheet.columnWidths.push(104)
  return sheet
}

function sharedStrings(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return [...doc.getElementsByTagName('si')].map((item) => [...item.getElementsByTagName('t')].map((node) => node.textContent ?? '').join(''))
}

function textFile(files: Map<string, Uint8Array>, name: string): string {
  const data = files.get(name)
  if (!data) throw new Error('This Excel file is missing a worksheet.')
  return decoder.decode(data)
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function columnName(index: number): string {
  let n = index + 1
  let name = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

function columnIndex(name: string): number {
  return [...name].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1
}

async function zipFiles(files: { name: string; data: Uint8Array }[]): Promise<Uint8Array> {
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = encoder.encode(file.name)
    const local = zipHeader(0x04034b50, name, file.data, 0)
    parts.push(local, file.data)
    central.push(zipHeader(0x02014b50, name, file.data, offset, true))
    offset += local.length + file.data.length
  }
  const centralStart = offset
  const directory = concat(central)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, directory.length, true)
  end.setUint32(16, centralStart, true)
  return concat([...parts, directory, new Uint8Array(end.buffer)])
}

function zipHeader(signature: number, name: Uint8Array, raw: Uint8Array, offset: number, central = false): Uint8Array {
  const size = central ? 46 : 30
  const header = new Uint8Array(size + name.length)
  const view = new DataView(header.buffer)
  view.setUint32(0, signature, true)
  if (central) {
    view.setUint16(4, 20, true)
    view.setUint16(6, 20, true)
    view.setUint32(16, crc32(raw), true)
    view.setUint32(20, raw.length, true)
    view.setUint32(24, raw.length, true)
    view.setUint16(28, name.length, true)
    view.setUint32(42, offset, true)
  } else {
    view.setUint16(4, 20, true)
    view.setUint32(14, crc32(raw), true)
    view.setUint32(18, raw.length, true)
    view.setUint32(22, raw.length, true)
    view.setUint16(26, name.length, true)
  }
  header.set(name, size)
  return header
}

async function unzipFiles(data: Uint8Array): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>()
  let offset = 0
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  while (offset + 30 <= data.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const nameStart = offset + 30
    const name = decoder.decode(data.slice(nameStart, nameStart + nameLength))
    const dataStart = nameStart + nameLength + extraLength
    const compressed = data.slice(dataStart, dataStart + compressedSize)
    const raw = method === 0 ? compressed : await inflate(compressed)
    files.set(name, raw)
    offset = dataStart + compressedSize
  }
  return files
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const input = new ReadableStream({
    start(controller) {
      controller.enqueue(data)
      controller.close()
    },
  })
  const stream = input.pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((total, part) => total + part.length, 0)
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
