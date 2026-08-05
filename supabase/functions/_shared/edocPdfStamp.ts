/**
 * Shared eDoc PDF stamp + history helpers for Edge Functions (pdf-lib).
 * Layout mirrors src/features/edoc/pdfStampGeometry.ts — keep in sync.
 */
import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
  type RGB,
} from 'https://esm.sh/pdf-lib@1.17.1'
import {
  containRect,
  cssNormalizedToPdfRect,
  displayTimezoneLabel,
  formatSigningDateLabel,
  planSignatureStampLayout,
  STAMP_SIGNATURE_DRAW_BOOST,
  type SignatureStampLayout,
} from './edocStampGeometry.ts'

export { containRect, cssNormalizedToPdfRect, displayTimezoneLabel, formatSigningDateLabel, planSignatureStampLayout }
export type { SignatureStampLayout }

export type StampField = {
  id: string
  fieldType: string
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export type SignatureBlockInput = {
  signerName: string
  reason: string
  email: string
  signedAtLabel: string
  appearancePngBytes: Uint8Array
  role?: string
  recordId?: string
}

export type HistoryEvent = {
  sequence: number
  title: string
  actorLine?: string
  timestampLabel: string
  detailLines: string[]
  tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral'
  sortKey?: string
}

export type HistoryPayload = {
  title: string
  statusLabel: string
  documentId: string
  transactionId: string
  createdAtLabel: string
  createdByName: string
  createdByEmail: string
  createdByOrganization?: string
  completedAtLabel: string
  versionDisplay: string
  versionId: string
  revisionNumber?: number | null
  /** SHA-256 of signed content before history pages were appended. */
  signedContentSha256: string
  pageCountBeforeHistory: number
  events: HistoryEvent[]
}

const NAVY = rgb(0.063, 0.165, 0.263) // #102a43
const ACCENT = rgb(0.09, 0.412, 0.667) // #1769aa
const BORDER = rgb(0.55, 0.62, 0.7)
const MUTED = rgb(0.322, 0.404, 0.475) // #526779
const STATUS = rgb(0.082, 0.42, 0.271) // #156b45
const PANEL_BG = rgb(0.94, 0.95, 0.97)
const TEAL = rgb(0.05, 0.45, 0.55)

function drawStampTextLines(
  page: PDFPage,
  lines: SignatureStampLayout['nameLines'],
  fonts: { regular: PDFFont; bold: PDFFont },
  fallbackX: number,
  cardRight: number,
  pad: number,
) {
  for (const line of lines) {
    const size = line.size ?? 8
    const x = line.x ?? fallbackX + (line.indent ?? 0)
    page.drawText(line.text, {
      x,
      y: line.y,
      size,
      font: line.bold ? fonts.bold : fonts.regular,
      color: line.muted ? MUTED : NAVY,
      maxWidth: Math.max(8, cardRight - pad - x),
    })
  }
}

/** Draw professional transparent signature stamp. Returns layout metadata for audit/UI. */
export async function drawSignatureBlock(
  pdf: PDFDocument,
  page: PDFPage,
  field: StampField,
  input: SignatureBlockInput,
  fonts: { regular: PDFFont; bold: PDFFont },
): Promise<SignatureStampLayout> {
  const { width: pageWidth, height: pageHeight } = page.getSize()
  const pageSize = { width: pageWidth, height: pageHeight }
  const rect = cssNormalizedToPdfRect(field, pageSize)
  const layout = planSignatureStampLayout(rect, {
    signerName: input.signerName,
    reason: input.reason,
    email: input.email,
    signedAtLabel: input.signedAtLabel,
    role: input.role,
    recordId: input.recordId,
  }, pageSize)

  // Hairline border only — fully transparent fill (no chrome / handles).
  page.drawRectangle({
    x: layout.card.x,
    y: layout.card.y,
    width: layout.card.width,
    height: layout.card.height,
    borderWidth: 0.75,
    borderColor: BORDER,
  })

  if (layout.accentWidth > 0) {
    page.drawRectangle({
      x: layout.card.x,
      y: layout.card.y,
      width: layout.accentWidth,
      height: layout.card.height,
      color: ACCENT,
      borderWidth: 0,
    })
  }

  if (layout.verticalDivider) {
    page.drawLine({
      start: { x: layout.verticalDivider.x, y: layout.verticalDivider.y1 },
      end: { x: layout.verticalDivider.x, y: layout.verticalDivider.y2 },
      thickness: 0.6,
      color: BORDER,
    })
  }
  if (layout.horizontalDivider) {
    page.drawLine({
      start: { x: layout.horizontalDivider.x1, y: layout.horizontalDivider.y },
      end: { x: layout.horizontalDivider.x2, y: layout.horizontalDivider.y },
      thickness: 0.6,
      color: BORDER,
    })
  }

  const cardRight = layout.card.x + layout.card.width
  drawStampTextLines(page, layout.nameLines, fonts, layout.imageBox.x, cardRight, layout.pad)
  drawStampTextLines(page, layout.roleLines, fonts, layout.imageBox.x, cardRight, layout.pad)

  if (layout.status) {
    const dot = Math.max(2.5, layout.status.size * 0.5)
    page.drawCircle({
      x: layout.status.x + dot / 2,
      y: layout.status.y + layout.status.size * 0.28,
      size: dot / 2,
      color: STATUS,
    })
    page.drawText(layout.status.text, {
      x: layout.status.x + dot + 3.5,
      y: layout.status.y,
      size: layout.status.size,
      font: fonts.bold,
      color: STATUS,
      maxWidth: Math.max(8, cardRight - layout.pad - layout.status.x - dot - 3.5),
    })
  }

  drawStampTextLines(page, layout.reasonLines, fonts, layout.status?.x ?? layout.imageBox.x, cardRight, layout.pad)
  drawStampTextLines(page, layout.metaLines, fonts, layout.status?.x ?? layout.imageBox.x, cardRight, layout.pad)

  let appearance: PDFImage | null = null
  try {
    appearance = await pdf.embedPng(input.appearancePngBytes)
  } catch {
    try {
      appearance = await pdf.embedJpg(input.appearancePngBytes)
    } catch {
      appearance = null
    }
  }

  if (appearance) {
    const boxW = Math.max(8, layout.imageBox.width)
    const boxH = Math.max(8, layout.imageBox.height)
    const fit = containRect(boxW, boxH, appearance.width, appearance.height)
    const boost = STAMP_SIGNATURE_DRAW_BOOST
    const drawW = Math.min(fit.width * boost, boxW)
    const drawH = Math.min(fit.height * boost, boxH)
    const rawX = layout.imageBox.x + (
      layout.mode === 'narrow' || layout.mode === 'slim'
        ? (boxW - drawW) / 2
        : 0
    )
    const rawY = layout.imageBox.y + (boxH - drawH) / 2
    const minX = layout.card.x + layout.accentWidth + 1
    const maxX = layout.card.x + layout.card.width - 1.5 - drawW
    const minY = layout.card.y + 1.5
    const maxY = layout.card.y + layout.card.height - 1.5 - drawH
    page.drawImage(appearance, {
      x: Math.min(Math.max(rawX, minX), Math.max(minX, maxX)),
      y: Math.min(Math.max(rawY, minY), Math.max(minY, maxY)),
      width: drawW,
      height: drawH,
    })
  } else {
    page.drawText(input.signerName.slice(0, 28), {
      x: layout.imageBox.x + 2,
      y: layout.imageBox.y + layout.imageBox.height / 2,
      size: Math.min(10, layout.fontSize + 1),
      font: fonts.regular,
      color: ACCENT,
      maxWidth: layout.imageBox.width - 4,
    })
  }

  return layout
}

/** Compact initial mark — image only, contained, no metadata card. */
async function drawInitialBlock(
  pdf: PDFDocument,
  page: PDFPage,
  field: StampField,
  input: SignatureBlockInput,
  fonts: { regular: PDFFont; bold: PDFFont },
) {
  const { width: pageWidth, height: pageHeight } = page.getSize()
  const rect = cssNormalizedToPdfRect(field, { width: pageWidth, height: pageHeight })
  const pad = 3
  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    borderWidth: 0.6,
    borderColor: BORDER,
  })
  let appearance: PDFImage | null = null
  try {
    appearance = await pdf.embedPng(input.appearancePngBytes)
  } catch {
    try {
      appearance = await pdf.embedJpg(input.appearancePngBytes)
    } catch {
      appearance = null
    }
  }
  if (appearance) {
    const fit = containRect(rect.width - pad * 2, rect.height - pad * 2, appearance.width, appearance.height)
    page.drawImage(appearance, {
      x: rect.x + pad + fit.offsetX,
      y: rect.y + pad + fit.offsetY,
      width: fit.width,
      height: fit.height,
    })
  } else {
    page.drawText((input.signerName || 'OK').slice(0, 8), {
      x: rect.x + pad,
      y: rect.y + rect.height / 2 - 4,
      size: 8,
      font: fonts.bold,
      color: TEAL,
      maxWidth: rect.width - pad * 2,
    })
  }
}

function toneColor(tone: HistoryEvent['tone']): RGB {
  if (tone === 'success') return rgb(0.13, 0.55, 0.28)
  if (tone === 'info') return TEAL
  if (tone === 'warning') return rgb(0.75, 0.45, 0.05)
  if (tone === 'danger') return rgb(0.75, 0.15, 0.15)
  return MUTED
}

function wrapMono(text: string, maxChars: number): string[] {
  const value = text.trim()
  if (!value) return ['']
  const size = Math.max(8, Math.floor(maxChars))
  const lines: string[] = []
  for (let i = 0; i < value.length; i += size) lines.push(value.slice(i, i + size))
  return lines.length ? lines : ['']
}

function drawWrappedMono(
  page: PDFPage,
  text: string,
  x: number,
  yTop: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color: RGB,
): number {
  const charW = font.widthOfTextAtSize('0', size)
  const maxChars = Math.max(8, Math.floor(maxWidth / Math.max(charW, 1)))
  const lines = wrapMono(text, maxChars)
  let y = yTop
  for (const line of lines) {
    page.drawText(line, { x, y: y - size, size, font, color, maxWidth })
    y -= size * 1.2
  }
  return y
}

function estimateEventHeight(event: HistoryEvent): number {
  const detailCount = event.detailLines.length + (event.actorLine ? 1 : 0) + 1 // timestamp
  return 16 + detailCount * 11 + 14
}

function paginateHistoryEvents(
  events: HistoryEvent[],
  firstPageBudget: number,
  nextPageBudget: number,
): HistoryEvent[][] {
  if (!events.length) return [[]]
  const pages: HistoryEvent[][] = []
  let current: HistoryEvent[] = []
  let budget = firstPageBudget
  let used = 0

  for (const event of events) {
    const h = estimateEventHeight(event)
    if (current.length > 0 && used + h > budget) {
      pages.push(current)
      current = []
      used = 0
      budget = nextPageBudget
    }
    current.push(event)
    used += h
  }
  if (current.length) pages.push(current)
  return pages.length ? pages : [[]]
}

function drawStatusBadge(
  page: PDFPage,
  x: number,
  y: number,
  label: string,
  fonts: { bold: PDFFont },
) {
  const size = 8
  const textW = fonts.bold.widthOfTextAtSize(label, size)
  const padX = 6
  const padY = 3
  const w = textW + padX * 2
  const h = size + padY * 2
  page.drawRectangle({
    x,
    y: y - padY,
    width: w,
    height: h,
    color: rgb(0.86, 0.96, 0.9),
    borderWidth: 0.8,
    borderColor: rgb(0.13, 0.55, 0.28),
  })
  page.drawText(label, {
    x: x + padX,
    y: y,
    size,
    font: fonts.bold,
    color: rgb(0.1, 0.4, 0.22),
  })
  return w
}

function drawHistoryChrome(
  page: PDFPage,
  payload: HistoryPayload,
  fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  pageIndex: number,
  totalPages: number,
  continued: boolean,
) {
  const { width, height } = page.getSize()
  const margin = 36
  page.drawRectangle({
    x: margin / 2,
    y: margin / 2,
    width: width - margin,
    height: height - margin,
    borderWidth: 1.25,
    borderColor: TEAL,
  })

  // Title once
  page.drawText(payload.title, {
    x: margin,
    y: height - 48,
    size: 16,
    font: fonts.bold,
    color: TEAL,
    maxWidth: width - margin * 2 - 110,
  })
  drawStatusBadge(page, width - margin - 88, height - 48, 'COMPLETED', fonts)

  page.drawText(continued ? 'Final Audit Report (continued)' : 'Final Audit Report', {
    x: margin,
    y: height - 66,
    size: 10,
    font: fonts.regular,
    color: MUTED,
  })

  page.drawText(`Document ID:`, {
    x: margin,
    y: height - 82,
    size: 8,
    font: fonts.bold,
    color: NAVY,
  })
  page.drawText(payload.documentId, {
    x: margin + 62,
    y: height - 82,
    size: 7.5,
    font: fonts.mono,
    color: MUTED,
    maxWidth: width / 2 - margin - 70,
  })

  page.drawText('Completed:', {
    x: width / 2 + 10,
    y: height - 82,
    size: 8,
    font: fonts.bold,
    color: NAVY,
  })
  page.drawText(payload.completedAtLabel, {
    x: width / 2 + 68,
    y: height - 82,
    size: 8,
    font: fonts.regular,
    color: MUTED,
    maxWidth: width / 2 - margin - 70,
  })

  // Footer
  page.drawText('GxP Toolkit eDocuSign', {
    x: margin,
    y: margin * 0.55,
    size: 7.5,
    font: fonts.bold,
    color: TEAL,
  })
  page.drawText(`Transaction ID: ${payload.transactionId}`, {
    x: margin + 120,
    y: margin * 0.55,
    size: 7,
    font: fonts.mono,
    color: MUTED,
    maxWidth: width - margin * 2 - 220,
  })
  page.drawText(`Completion Record · Page ${pageIndex + 1} of ${totalPages}`, {
    x: width - margin - 150,
    y: margin * 0.55,
    size: 7.5,
    font: fonts.regular,
    color: MUTED,
  })
}

function drawSummaryCard(
  page: PDFPage,
  payload: HistoryPayload,
  fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  topY: number,
  margin: number,
  contentWidth: number,
  totalPageCount: number,
): number {
  const labelSize = 8
  const valueSize = 8
  const monoSize = 7.5
  const colGap = 16
  const colW = (contentWidth - colGap) / 2
  const leftX = margin + 10
  const rightX = margin + colW + colGap + 10
  const labelW = 78

  type Row = { label: string; value: string; mono?: boolean; lines?: string[] }
  const leftRows: Row[] = [
    { label: 'Document ID', value: payload.documentId, mono: true },
    { label: 'Created', value: payload.createdAtLabel },
    { label: 'Created by', value: payload.createdByName },
    { label: 'Email', value: payload.createdByEmail || '—' },
  ]
  if (payload.createdByOrganization) {
    leftRows.push({ label: 'Organization', value: payload.createdByOrganization })
  }

  const rightRows: Row[] = [
    { label: 'Status', value: 'Completed' },
    { label: 'Completed', value: payload.completedAtLabel },
    { label: 'Transaction', value: payload.transactionId, mono: true },
    { label: 'Page count', value: String(totalPageCount) },
  ]
  if (payload.revisionNumber != null) {
    rightRows.push({ label: 'Revision', value: String(payload.revisionNumber) })
  } else {
    rightRows.push({ label: 'Version', value: payload.versionDisplay })
  }
  rightRows.push({ label: 'Version ID', value: payload.versionId, mono: true })

  const measureCol = (rows: Row[]) => {
    let h = 18 // section title
    for (const row of rows) {
      const maxChars = Math.floor((colW - labelW - 16) / (row.mono ? monoSize * 0.6 : valueSize * 0.5))
      const lines = row.mono ? wrapMono(row.value, maxChars) : [row.value]
      row.lines = lines
      h += Math.max(1, lines.length) * 11 + 2
    }
    return h
  }

  const leftH = measureCol(leftRows)
  const rightH = measureCol(rightRows)
  const hashLines = wrapMono(payload.signedContentSha256 || '—', Math.floor((contentWidth - 24) / (monoSize * 0.6)))
  const hashBlockH = 16 + hashLines.length * 10 + 8
  const panelH = Math.max(leftH, rightH) + hashBlockH + 16

  page.drawRectangle({
    x: margin,
    y: topY - panelH,
    width: contentWidth,
    height: panelH,
    color: PANEL_BG,
    borderWidth: 0.8,
    borderColor: BORDER,
  })

  page.drawText('DOCUMENT DETAILS', {
    x: leftX,
    y: topY - 14,
    size: 8,
    font: fonts.bold,
    color: TEAL,
  })
  page.drawText('COMPLETION DETAILS', {
    x: rightX,
    y: topY - 14,
    size: 8,
    font: fonts.bold,
    color: TEAL,
  })

  const drawCol = (rows: Row[], x: number, startY: number) => {
    let y = startY
    for (const row of rows) {
      page.drawText(`${row.label}:`, { x, y, size: labelSize, font: fonts.bold, color: NAVY })
      const lines = row.lines ?? [row.value]
      let lineY = y
      for (let i = 0; i < lines.length; i += 1) {
        page.drawText(lines[i]!, {
          x: x + labelW,
          y: lineY,
          size: row.mono ? monoSize : valueSize,
          font: row.mono ? fonts.mono : fonts.regular,
          color: MUTED,
          maxWidth: colW - labelW - 16,
        })
        lineY -= 11
      }
      y = lineY - 2
    }
    return y
  }

  const afterLeft = drawCol(leftRows, leftX, topY - 28)
  const afterRight = drawCol(rightRows, rightX, topY - 28)
  let y = Math.min(afterLeft, afterRight) - 6

  page.drawLine({
    start: { x: margin + 8, y },
    end: { x: margin + contentWidth - 8, y },
    thickness: 0.6,
    color: BORDER,
  })
  y -= 12
  page.drawText('SIGNED-CONTENT SHA-256', {
    x: leftX,
    y,
    size: 8,
    font: fonts.bold,
    color: TEAL,
  })
  y -= 2
  y = drawWrappedMono(page, payload.signedContentSha256 || '—', leftX, y, contentWidth - 24, fonts.mono, monoSize, MUTED)

  return topY - panelH
}

function drawHistoryEvent(
  page: PDFPage,
  event: HistoryEvent,
  x: number,
  topY: number,
  contentWidth: number,
  fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  connectorTop: number | null,
  connectorBottom: boolean,
): number {
  const color = toneColor(event.tone)
  const iconX = x + 8
  const textX = x + 28
  const maxW = contentWidth - 36

  if (connectorTop != null) {
    page.drawLine({
      start: { x: iconX, y: connectorTop },
      end: { x: iconX, y: topY - 2 },
      thickness: 0.8,
      color: BORDER,
    })
  }

  page.drawCircle({ x: iconX, y: topY - 4, size: 6, color })
  page.drawText(String(event.sequence), {
    x: iconX - 2,
    y: topY - 7,
    size: 6,
    font: fonts.bold,
    color: rgb(1, 1, 1),
  })

  page.drawText(event.title, {
    x: textX,
    y: topY - 8,
    size: 9,
    font: fonts.bold,
    color: NAVY,
    maxWidth: maxW,
  })

  let y = topY - 22
  if (event.actorLine) {
    page.drawText(event.actorLine, { x: textX, y, size: 8, font: fonts.regular, color: MUTED, maxWidth: maxW })
    y -= 11
  }
  page.drawText(event.timestampLabel, { x: textX, y, size: 8, font: fonts.regular, color: MUTED, maxWidth: maxW })
  y -= 11
  page.drawText('Time source: Server', { x: textX, y, size: 7.5, font: fonts.regular, color: MUTED, maxWidth: maxW })
  y -= 12

  for (const line of event.detailLines) {
    if (line.startsWith('Event ID:')) {
      const value = line.slice('Event ID:'.length).trim()
      page.drawText('Event ID:', { x: textX, y, size: 7.5, font: fonts.bold, color: NAVY })
      const labelW = fonts.bold.widthOfTextAtSize('Event ID:', 7.5) + 4
      const charW = fonts.mono.widthOfTextAtSize('0', 7)
      const maxChars = Math.max(8, Math.floor((maxW - labelW) / Math.max(charW, 1)))
      const idLines = wrapMono(value, maxChars)
      let lineY = y
      for (let i = 0; i < idLines.length; i += 1) {
        page.drawText(idLines[i]!, {
          x: textX + labelW,
          y: lineY,
          size: 7,
          font: fonts.mono,
          color: MUTED,
          maxWidth: maxW - labelW,
        })
        lineY -= 10
      }
      y = lineY - 2
    } else {
      page.drawText(line, {
        x: textX,
        y,
        size: 7.5,
        font: fonts.regular,
        color: MUTED,
        maxWidth: maxW,
      })
      y -= 11
    }
  }

  if (connectorBottom) {
    page.drawLine({
      start: { x: iconX, y: topY - 10 },
      end: { x: iconX, y: y + 2 },
      thickness: 0.8,
      color: BORDER,
    })
  }

  return y - 10
}

/** Append GxP Toolkit completion-history pages. Returns new page count. */
export async function appendHistoryPages(pdf: PDFDocument, payload: HistoryPayload): Promise<number> {
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    mono: await pdf.embedFont(StandardFonts.Courier),
  }

  const pageWidth = 612
  const pageHeight = 792
  const margin = 36
  const contentWidth = pageWidth - margin * 2
  const headerBottom = pageHeight - 96
  const footerTop = margin + 28
  const firstSummaryEstimate = 168
  const firstBudget = headerBottom - footerTop - firstSummaryEstimate - 40
  const nextBudget = headerBottom - footerTop - 40

  const chunks = paginateHistoryEvents(payload.events, firstBudget, nextBudget)
  const totalPages = chunks.length

  chunks.forEach((chunk, pageIndex) => {
    const page = pdf.addPage([pageWidth, pageHeight])
    drawHistoryChrome(page, payload, fonts, pageIndex, totalPages, pageIndex > 0)

    let y = headerBottom
    if (pageIndex === 0) {
      y = drawSummaryCard(page, payload, fonts, y, margin, contentWidth, payload.pageCountBeforeHistory + totalPages) - 18
      page.drawText('Document history', {
        x: margin,
        y,
        size: 11,
        font: fonts.bold,
        color: NAVY,
      })
      y -= 16
    } else {
      page.drawText('Document history (continued)', {
        x: margin,
        y,
        size: 11,
        font: fonts.bold,
        color: NAVY,
      })
      page.drawText(`${payload.title} · ${payload.documentId}`, {
        x: margin,
        y: y - 12,
        size: 7.5,
        font: fonts.regular,
        color: MUTED,
        maxWidth: contentWidth,
      })
      y -= 28
    }

    let prevConnector: number | null = null
    chunk.forEach((event, idx) => {
      const nextY = drawHistoryEvent(
        page,
        event,
        margin,
        y,
        contentWidth,
        fonts,
        prevConnector,
        idx < chunk.length - 1,
      )
      prevConnector = nextY + 8
      y = nextY
    })
  })

  return pdf.getPageCount()
}

export type StampFieldAdjustment = {
  fieldId: string
  mode: string
  adjusted: boolean
  original: { x: number; y: number; width: number; height: number }
  final: { x: number; y: number; width: number; height: number }
}

export type StampFieldsResult = {
  bytes: Uint8Array
  adjustments: StampFieldAdjustment[]
}

export async function stampFieldsOntoPdf(
  pdfBytes: Uint8Array,
  fields: StampField[],
  input: SignatureBlockInput,
): Promise<StampFieldsResult> {
  const pdf = await PDFDocument.load(pdfBytes)
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  }
  const pages = pdf.getPages()
  const adjustments: StampFieldAdjustment[] = []
  for (const field of fields) {
    if (!['signature', 'initial'].includes(field.fieldType)) continue
    const pageIndex = Math.min(Math.max(field.pageNumber, 1), pages.length) - 1
    const page = pages[pageIndex]
    if (!page) continue
    if (field.fieldType === 'signature') {
      const layout = await drawSignatureBlock(pdf, page, field, input, fonts)
      adjustments.push({
        fieldId: field.id,
        mode: layout.mode,
        adjusted: layout.adjusted,
        original: layout.originalCard,
        final: layout.card,
      })
    } else {
      await drawInitialBlock(pdf, page, field, input, fonts)
    }
  }
  return { bytes: await pdf.save(), adjustments }
}

export function decodeDataUrlToBytes(dataUrl: string): Uint8Array {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!match) throw new Error('Signature appearance must be a base64 data URL.')
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Near-white paper pixels → transparent so stamps have no opaque plate. */
const WHITE_CUTOFF = 245

export async function stripOpaqueWhiteBackground(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const { Image } = await import('https://esm.sh/imagescript@1.3.0')
    const image = await Image.decode(bytes)
    const pixels = image.bitmap as Uint8ClampedArray | Uint8Array
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      const a = pixels[i + 3]
      if (a === 0) continue
      if (r >= WHITE_CUTOFF && g >= WHITE_CUTOFF && b >= WHITE_CUTOFF) {
        pixels[i + 3] = 0
      }
    }
    return await image.encode()
  } catch {
    return bytes
  }
}

export async function decodeSignatureAppearanceBytes(dataUrl: string): Promise<Uint8Array> {
  return stripOpaqueWhiteBackground(decodeDataUrlToBytes(dataUrl))
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
