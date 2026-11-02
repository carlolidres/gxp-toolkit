import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

import { profileGridLimits, profileItemNotApplicable, readProfileBatch } from './productProfileWorkbook'
import type { EquipmentSheet } from '../vmp/equipmentWorkbook'

const PAGE_WIDTH = 841.89
const PAGE_HEIGHT = 595.28
const MARGIN = 36
const FOOTER = 28
const SECTIONS: { id: string; appendix: string; group: string }[] = [
  { id: 'raw-material', appendix: 'APPENDIX 1: RAW MATERIALS TABULATION', group: 'Raw Materials' },
  { id: 'packaging-material', appendix: 'APPENDIX 2: PACKAGING MATERIALS TABULATION', group: 'Packaging Materials' },
  { id: 'equipment', appendix: 'EQUIPMENT TABULATION', group: 'Equipment' },
  { id: 'in-process-control', appendix: 'APPENDIX 3: IN-PROCESS CONTROL TABULATION', group: 'In-process Control' },
  { id: 'analytical-report', appendix: 'APPENDIX 4: ANALYTICAL REPORT TABULATION', group: 'Analytical Report' },
  { id: 'stability', appendix: 'APPENDIX 5: STABILITY TABULATION', group: 'Stability' },
  { id: 'holding-time', appendix: 'APPENDIX 6: HOLDING-TIME TABULATION', group: 'Holding-Time' },
  { id: 'other-data', appendix: 'APPENDIX 7: OTHER DATA TABULATION', group: 'Other Data' },
  { id: 'deviation-report', appendix: 'APPENDIX 8: DEVIATION REPORT TABULATION', group: 'Deviation Report' },
  { id: 'product-complaints', appendix: 'APPENDIX 9: PRODUCT COMPLAINTS TABULATION', group: 'Product Complaints' },
]

export type ProfilePrintValue = { itemCode: string; controlNo: string; gray: boolean }

export type ProfilePrintBatch = {
  row: number
  uniqueBatchNo: string
  released: string
  values: ProfilePrintValue[]
}

export type ProfilePrintTable = {
  groupTitle: string
  materials: string[]
  batches: ProfilePrintBatch[]
}

export type ProfilePrintHeading = {
  appendix: string
  client: string
  productName: string
  productCode: string
  groupTitle: string
}

export function profilePrintHeading(input: { section: string; client: string; productName: string; productCode: string }): ProfilePrintHeading {
  const section = SECTIONS.find((item) => item.id === input.section) ?? SECTIONS[0]
  return {
    appendix: section.appendix,
    client: input.client.trim().toUpperCase(),
    productName: input.productName.trim().toUpperCase(),
    productCode: input.productCode.trim().toUpperCase(),
    groupTitle: section.group,
  }
}

export function profilePrintTable(sheet: EquipmentSheet, section = 'raw-material'): ProfilePrintTable {
  const limits = profileGridLimits(sheet)
  const materials: { column: number; name: string }[] = []
  for (let column = 1; column < limits.columns; column += 2) {
    const name = String(sheet.cells[`0:${column}`] ?? '').trim()
    materials.push({ column, name: name || 'DESCRIPTION' })
  }
  const batches: ProfilePrintBatch[] = []
  for (let row = 2; row < limits.rows; row += 1) {
    const entry = readProfileBatch(sheet, row)
    const uniqueBatchNo = entry.uniqueBatchNo.trim() || String(sheet.cells[`${row}:0`] ?? '').trim()
    if (!uniqueBatchNo) continue
    batches.push({
      row,
      uniqueBatchNo,
      released: entry.fgReleasedDate.trim(),
      values: materials.map(({ column }) => {
        const gray = profileItemNotApplicable(sheet, row, column)
        return {
          itemCode: gray ? '' : String(sheet.cells[`${row}:${column}`] ?? '').trim(),
          controlNo: gray ? '' : String(sheet.cells[`${row}:${column + 1}`] ?? '').trim(),
          gray,
        }
      }),
    })
  }
  return {
    groupTitle: profilePrintHeading({ section, client: '', productName: '', productCode: '' }).groupTitle,
    materials: materials.map((item) => item.name),
    batches,
  }
}

export function batchesInReleaseRange(batches: ProfilePrintBatch[], from: string, to: string): number[] {
  return batches.filter((batch) => {
    if (!from && !to) return true
    if (!batch.released) return false
    if (from && batch.released < from) return false
    if (to && batch.released > to) return false
    return true
  }).map((batch) => batch.row)
}

/** Tick a second batch to include every batch between the two. Clearing a box removes only that batch. */
export function toggleBatchSelection(order: number[], selected: number[], row: number, checked: boolean): number[] {
  const chosen = new Set(selected)
  if (!checked) {
    chosen.delete(row)
    return order.filter((item) => chosen.has(item))
  }
  if (chosen.size === 1) {
    const [only] = [...chosen]
    const start = order.indexOf(only)
    const end = order.indexOf(row)
    if (start >= 0 && end >= 0) {
      const [from, to] = start < end ? [start, end] : [end, start]
      return order.slice(from, to + 1)
    }
  }
  chosen.add(row)
  return order.filter((item) => chosen.has(item))
}

function plain(value: string): string {
  return value.replace(/[^\x20-\x7E\n]/g, ' ').replace(/[ \t]+\n/g, '\n').trim()
}

function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = plain(text).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= width || !current) current = next
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawLines(page: PDFPage, lines: string[], x: number, bottom: number, width: number, height: number, font: PDFFont, size: number) {
  if (!lines.length) return
  const leading = size + 2
  const block = lines.length * leading
  let baseline = bottom + (height + block) / 2 - size
  for (const line of lines) {
    const textWidth = Math.min(width - 4, font.widthOfTextAtSize(line, size))
    const scale = font.widthOfTextAtSize(line, size) > width - 4 ? (width - 4) / font.widthOfTextAtSize(line, size) : 1
    page.drawText(line, {
      x: x + (width - textWidth) / 2,
      y: baseline,
      size: size * scale,
      font,
      color: rgb(0, 0, 0),
    })
    baseline -= leading
  }
}

function drawBox(page: PDFPage, x: number, bottom: number, width: number, height: number, fill?: ReturnType<typeof rgb>) {
  page.drawRectangle({
    x,
    y: bottom,
    width,
    height,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.8,
    color: fill ?? rgb(1, 1, 1),
  })
}

export async function buildProfilePdf(input: {
  appendix: string
  client: string
  productName: string
  productCode: string
  groupTitle: string
  materials: string[]
  batches: ProfilePrintBatch[]
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const materials = input.materials.length ? input.materials : ['DESCRIPTION']
  const inner = PAGE_WIDTH - MARGIN * 2
  const batchWidth = 86
  const pairWidth = (inner - batchWidth) / materials.length
  const subWidth = pairWidth / 2
  const size = subWidth < 42 ? 6 : subWidth < 58 ? 7 : 8
  const gray = rgb(197 / 255, 200 / 255, 206 / 255)
  const pages: PDFPage[] = []

  const bannerLines = [
    plain(input.appendix).toUpperCase(),
    `Client: ${plain(input.client).toUpperCase()}`,
    `Product Name: ${plain(input.productName).toUpperCase()}`,
    `Formulation Code: ${plain(input.productCode).toUpperCase()}`,
  ]

  function nameHeight() {
    const lines = materials.map((name) => wrapText(name, bold, size, pairWidth - 6).length)
    return Math.max(16, Math.max(...lines) * (size + 2) + 6)
  }

  function tableHeadHeight() {
    return 16 + nameHeight() + 16
  }

  function rowHeight(batch: ProfilePrintBatch) {
    const lines = batch.values.map((value) => Math.max(1, value.controlNo.split('\n').filter((item) => item.trim()).length, value.itemCode ? 1 : 1))
    return Math.max(18, Math.max(...lines) * (size + 2) + 8)
  }

  function drawBanner(page: PDFPage, top: number) {
    let y = top
    for (const line of bannerLines) {
      page.drawText(line, { x: MARGIN, y: y - 11, size: 10, font: bold, color: rgb(0, 0, 0) })
      y -= 13
    }
    return y - 10
  }

  function drawTableHead(page: PDFPage, top: number) {
    const names = nameHeight()
    const height = tableHeadHeight()
    const bottom = top - height
    drawBox(page, MARGIN, bottom, batchWidth, height)
    drawLines(page, wrapText('Unique Batch No.', bold, size, batchWidth - 6), MARGIN, bottom, batchWidth, height, bold, size)
    drawBox(page, MARGIN + batchWidth, bottom + names + 16, inner - batchWidth, 16)
    drawLines(page, [input.groupTitle], MARGIN + batchWidth, bottom + names + 16, inner - batchWidth, 16, bold, size)
    materials.forEach((name, index) => {
      const x = MARGIN + batchWidth + index * pairWidth
      drawBox(page, x, bottom + 16, pairWidth, names)
      drawLines(page, wrapText(name, bold, size, pairWidth - 6), x, bottom + 16, pairWidth, names, bold, size)
      drawBox(page, x, bottom, subWidth, 16)
      drawBox(page, x + subWidth, bottom, subWidth, 16)
      drawLines(page, ['Item Code'], x, bottom, subWidth, 16, font, size)
      drawLines(page, ['Control No.'], x + subWidth, bottom, subWidth, 16, font, size)
    })
    return bottom
  }

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  pages.push(page)
  let cursor = drawTableHead(page, drawBanner(page, PAGE_HEIGHT - MARGIN))

  for (const batch of input.batches) {
    const height = rowHeight(batch)
    if (cursor - height < MARGIN + FOOTER) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      pages.push(page)
      cursor = drawTableHead(page, drawBanner(page, PAGE_HEIGHT - MARGIN))
    }
    const bottom = cursor - height
    drawBox(page, MARGIN, bottom, batchWidth, height)
    drawLines(page, [batch.uniqueBatchNo], MARGIN, bottom, batchWidth, height, bold, size)
    batch.values.forEach((value, index) => {
      const x = MARGIN + batchWidth + index * pairWidth
      const fill = value.gray ? gray : undefined
      drawBox(page, x, bottom, subWidth, height, fill)
      drawBox(page, x + subWidth, bottom, subWidth, height, fill)
      if (!value.gray) {
        drawLines(page, value.itemCode ? [value.itemCode] : [], x, bottom, subWidth, height, font, size)
        drawLines(page, value.controlNo.split('\n').map((item) => item.trim()).filter(Boolean), x + subWidth, bottom, subWidth, height, font, size)
      }
    })
    if (batch.values.length === 0) {
      drawBox(page, MARGIN + batchWidth, bottom, inner - batchWidth, height)
    }
    cursor = bottom
  }

  pages.forEach((item, index) => {
    const label = `Page ${index + 1} of ${pages.length}`
    const width = font.widthOfTextAtSize(label, 9)
    item.drawText(label, { x: (PAGE_WIDTH - width) / 2, y: 16, size: 9, font, color: rgb(0, 0, 0) })
  })
  return doc.save()
}

export function profilePdfName(productCode: string, section: string): string {
  const code = productCode.trim().toUpperCase().replace(/[^\w.-]+/g, '-') || 'PRODUCT'
  const name = section.trim().toLowerCase().replace(/[^\w.-]+/g, '-') || 'profile'
  return `${code}-${name}-tabulation.pdf`
}
