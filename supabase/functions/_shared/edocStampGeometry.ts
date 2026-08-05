/**
 * Professional adaptive e-signature stamp geometry (wide / compact / micro).
 * Visual hierarchy mirrors screenshot/professional-esignature-template.html.
 * Keep in sync with supabase/functions/_shared/edocStampGeometry.ts
 */

export type NormalizedFieldRect = {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export type PdfPageSize = {
  width: number
  height: number
}

export type PdfRect = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

/** Internal mode names (wide≈full, micro≈narrow) for backward-compatible callers. */
export type StampLayoutMode = 'full' | 'compact' | 'narrow' | 'slim' | 'banner'

export const STAMP_MODE_LABEL: Record<StampLayoutMode, string> = {
  full: 'Wide',
  compact: 'Compact',
  narrow: 'Micro',
  slim: 'Micro Slim',
  banner: 'Micro Banner',
}

export const STAMP_PAD_FULL = 8
export const STAMP_PAD_COMPACT = 6
export const STAMP_PAD_NARROW = 5
export const STAMP_PAD_SLIM = 4
export const STAMP_PAD_BANNER = 3.5
export const STAMP_LEFT_RATIO = 0.52
export const STAMP_MIN_FONT_PT = 6
export const STAMP_PREFERRED_FONT_PT = 9
/** Wide two-column (template ~420px CSS; ~260pt keeps default 0.42-wide fields in Wide). */
export const FULL_LAYOUT_MIN_WIDTH_PT = 260
export const FULL_LAYOUT_MIN_HEIGHT_PT = 70
export const COMPACT_LAYOUT_MIN_WIDTH_PT = 150
export const COMPACT_LAYOUT_MIN_HEIGHT_PT = 60
/** Classic micro (side-by-side ink | status). */
export const MICRO_LAYOUT_MIN_WIDTH_PT = 105
export const MICRO_LAYOUT_MIN_HEIGHT_PT = 42
/** Tall narrow margin — ink stacked above name/status/date. */
export const SLIM_LAYOUT_MIN_WIDTH_PT = 72
export const SLIM_LAYOUT_MIN_HEIGHT_PT = 82
/** Short horizontal signature line. */
export const BANNER_LAYOUT_MIN_WIDTH_PT = 135
export const BANNER_LAYOUT_MIN_HEIGHT_PT = 27
/** Soft boost so transparent ink has presence without leaving the image box. */
export const STAMP_SIGNATURE_DRAW_BOOST = 1.05

export const DEFAULT_SIGNATURE_FIELD_NORM = { width: 0.42, height: 0.12 } as const
/**
 * Absolute floor for any signature field (banner height / slim width extremes).
 * Prefer `signatureMinNormForSize` which adapts to aspect ratio.
 */
export const MIN_SIGNATURE_FIELD_NORM = { width: 0.12, height: 0.043 } as const
/** Reject fields smaller than this normalized area (~5k CSS-px² on 640×830). */
export const MIN_SIGNATURE_AREA_NORM = 0.008

export const STAMP_REF_WIDTH_PT = 465 // ~620 CSS px
export const STAMP_REF_HEIGHT_PT = 142 // ~190 CSS px

/** Aspect-aware minimum normalized size for placement clamp / draw validation. */
export function signatureMinNormForSize(width: number, height: number): { width: number; height: number } {
  const w = Math.max(0.001, width)
  const h = Math.max(0.001, height)
  const aspect = w / h
  if (aspect < 0.9) {
    // Tall / slim margin
    return { width: 0.12, height: 0.13 }
  }
  if (aspect > 3.2) {
    // Short banner line
    return { width: 0.28, height: 0.043 }
  }
  // Classic micro
  return { width: 0.22, height: 0.067 }
}

export function meetsSignatureMinArea(width: number, height: number): boolean {
  return width * height >= MIN_SIGNATURE_AREA_NORM
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Field scale from template reference size (620×190 CSS). */
export function computeFieldScale(widthPt: number, heightPt: number): number {
  const widthScale = widthPt / STAMP_REF_WIDTH_PT
  const heightScale = heightPt / STAMP_REF_HEIGHT_PT
  return clamp(Math.min(widthScale, heightScale), 0.42, 1.35)
}

/** Convert CSS-normalized field (origin top-left) to PDF points (origin bottom-left). */
export function cssNormalizedToPdfRect(field: NormalizedFieldRect, page: PdfPageSize): PdfRect {
  const width = field.width * page.width
  const height = field.height * page.height
  const x = field.x * page.width
  const y = page.height - field.y * page.height - height
  const rotation = Number.isFinite(field.rotation) ? (((field.rotation! % 360) + 360) % 360) : 0
  return { x, y, width, height, rotation }
}

/** Fit an image into a box preserving aspect ratio (contain). Never stretches. */
export function containRect(
  boxWidth: number,
  boxHeight: number,
  imageWidth: number,
  imageHeight: number,
): { width: number; height: number; offsetX: number; offsetY: number } {
  if (imageWidth <= 0 || imageHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return { width: boxWidth, height: boxHeight, offsetX: 0, offsetY: 0 }
  }
  const scale = Math.min(boxWidth / imageWidth, boxHeight / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return {
    width,
    height,
    offsetX: (boxWidth - width) / 2,
    offsetY: (boxHeight - height) / 2,
  }
}

export function clampFontSizeForHeight(
  availableHeight: number,
  lineCount: number,
  opts?: { min?: number; max?: number; lineGap?: number },
): number {
  const min = opts?.min ?? STAMP_MIN_FONT_PT
  const max = opts?.max ?? STAMP_PREFERRED_FONT_PT
  const lineGap = opts?.lineGap ?? 1.3
  if (lineCount <= 0 || availableHeight <= 0) return min
  const size = availableHeight / (lineCount * lineGap)
  return Math.min(max, Math.max(min, size))
}

export function approxTextWidth(text: string, fontSize: number, bold = false): number {
  const factor = bold ? 0.55 : 0.5
  return text.length * fontSize * factor
}

export function wrapTextLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  maxLines = 8,
  bold = false,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (approxTextWidth(next, fontSize, bold) <= maxWidth) {
      current = next
      continue
    }
    if (current) lines.push(current)
    if (approxTextWidth(word, fontSize, bold) > maxWidth) {
      let rest = word
      while (rest.length > 0 && lines.length < maxLines) {
        let cut = rest.length
        while (cut > 1 && approxTextWidth(rest.slice(0, cut), fontSize, bold) > maxWidth) cut -= 1
        lines.push(rest.slice(0, cut))
        rest = rest.slice(cut)
        if (lines.length >= maxLines) {
          if (rest) lines[maxLines - 1] = `${lines[maxLines - 1]}${rest}`
          rest = ''
        }
      }
      current = ''
    } else {
      current = word
    }
    if (lines.length >= maxLines) break
  }
  if (current && lines.length < maxLines) lines.push(current)
  else if (current && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1]} ${current}`
  return lines.length ? lines : ['']
}

/** Ellipsis truncate to a single line for micro/compact metadata. */
export function ellipsize(text: string, maxWidth: number, fontSize: number, bold = false): string {
  const value = text.trim()
  if (!value) return ''
  if (approxTextWidth(value, fontSize, bold) <= maxWidth) return value
  const ellipsis = '…'
  let cut = value.length
  while (cut > 1 && approxTextWidth(value.slice(0, cut) + ellipsis, fontSize, bold) > maxWidth) {
    cut -= 1
  }
  return `${value.slice(0, Math.max(1, cut))}${ellipsis}`
}

export function formatSigningDateLabel(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const hours24 = date.getHours()
  const hours12 = hours24 % 12 || 12
  const ampm = hours24 < 12 ? 'AM' : 'PM'
  const offsetMin = -date.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const oh = String(Math.floor(abs / 60))
  const om = pad(abs % 60)
  const tz = om === '00' ? `GMT${sign}${oh}` : `GMT${sign}${oh}:${om}`
  return `${months[date.getMonth()]} ${pad(date.getDate())}, ${date.getFullYear()} ${pad(hours12)}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${ampm} ${tz}`
}

export function displayTimezoneLabel(date: Date = new Date()): string {
  const offsetMin = -date.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const oh = String(Math.floor(abs / 60))
  const om = String(abs % 60).padStart(2, '0')
  return om === '00' ? `GMT${sign}${oh}` : `GMT${sign}${oh}:${om}`
}

export function splitSigningDateParts(fullLabel: string): { datePart: string; timePart: string } {
  const match = /^([A-Za-z]{3} \d{2}, \d{4})\s+(.+)$/.exec(fullLabel.trim())
  if (match) return { datePart: match[1], timePart: match[2] }
  return { datePart: fullLabel.trim(), timePart: '' }
}

export type StampTextLine = {
  text: string
  y: number
  bold: boolean
  /** Absolute PDF x when known; draw path falls back to column heuristics. */
  x?: number
  indent?: number
  muted?: boolean
  size?: number
}

export type SignatureStampContent = {
  signerName: string
  reason: string
  email: string
  signedAtLabel: string
  /** Job title / signatory level — hidden in micro mode. */
  role?: string
  /** Verification / signature event id — hidden in micro mode. */
  recordId?: string
}

export type SignatureStampLayout = {
  mode: StampLayoutMode
  fontSize: number
  fieldScale: number
  pad: number
  adjusted: boolean
  originalCard: { x: number; y: number; width: number; height: number }
  card: { x: number; y: number; width: number; height: number }
  /** Left accent bar width in PDF points (0 = none). */
  accentWidth: number
  imageBox: { x: number; y: number; width: number; height: number }
  /** Name under the ink (wide/compact) or beside (micro). */
  nameLines: StampTextLine[]
  roleLines: StampTextLine[]
  status: { x: number; y: number; text: string; size: number } | null
  reasonLines: StampTextLine[]
  metaLines: StampTextLine[]
  verticalDivider: { x: number; y1: number; y2: number } | null
  horizontalDivider: { y: number; x1: number; x2: number } | null
  /** @deprecated Prefer nameLines/reasonLines/metaLines; kept for older draw paths. */
  signatureLabel: { x: number; y: number; text: string } | null
  detailColumnX: number
  detailMaxWidth: number
  detailLines: StampTextLine[]
  emailLabel: { x: number; y: number; text: string } | null
  emailValue: { x: number; y: number; text: string; maxWidth: number }
}

export function pickPreferredMode(width: number, height: number): StampLayoutMode {
  if (width >= FULL_LAYOUT_MIN_WIDTH_PT && height >= FULL_LAYOUT_MIN_HEIGHT_PT) return 'full'
  if (width >= COMPACT_LAYOUT_MIN_WIDTH_PT && height >= COMPACT_LAYOUT_MIN_HEIGHT_PT) return 'compact'
  const aspect = width / Math.max(height, 1)
  if (aspect < 0.9 && height >= SLIM_LAYOUT_MIN_HEIGHT_PT * 0.85) return 'slim'
  if (aspect > 3.2 && width >= BANNER_LAYOUT_MIN_WIDTH_PT * 0.85) return 'banner'
  if (width >= MICRO_LAYOUT_MIN_WIDTH_PT && height >= MICRO_LAYOUT_MIN_HEIGHT_PT) return 'narrow'
  if (aspect < 1.1) return 'slim'
  if (aspect > 2.8) return 'banner'
  return 'narrow'
}

function modesToTry(preferred: StampLayoutMode): StampLayoutMode[] {
  const rest: StampLayoutMode[] = ['narrow', 'slim', 'banner', 'compact', 'full']
  return [preferred, ...rest.filter((m) => m !== preferred)]
}

function estimateMinSize(mode: StampLayoutMode, content: SignatureStampContent, fontSize: number): { width: number; height: number } {
  const name = content.signerName.trim() || 'Signer'
  const reason = content.reason.trim() || '—'
  if (mode === 'full') {
    return {
      width: Math.max(FULL_LAYOUT_MIN_WIDTH_PT, approxTextWidth(name, fontSize, true) + approxTextWidth(reason, fontSize) + 48),
      height: Math.max(FULL_LAYOUT_MIN_HEIGHT_PT, fontSize * 8),
    }
  }
  if (mode === 'compact') {
    return {
      width: Math.max(COMPACT_LAYOUT_MIN_WIDTH_PT, approxTextWidth(name, fontSize, true) + 40),
      height: Math.max(COMPACT_LAYOUT_MIN_HEIGHT_PT, fontSize * 7),
    }
  }
  if (mode === 'slim') {
    return {
      width: Math.max(SLIM_LAYOUT_MIN_WIDTH_PT, approxTextWidth(name, fontSize, true) * 0.55 + 24),
      height: Math.max(SLIM_LAYOUT_MIN_HEIGHT_PT, fontSize * 9),
    }
  }
  if (mode === 'banner') {
    return {
      width: Math.max(BANNER_LAYOUT_MIN_WIDTH_PT, approxTextWidth(name, fontSize, true) + 48),
      height: Math.max(BANNER_LAYOUT_MIN_HEIGHT_PT, fontSize * 3.2),
    }
  }
  return {
    width: Math.max(MICRO_LAYOUT_MIN_WIDTH_PT, approxTextWidth(name, fontSize, true) + 36),
    height: Math.max(MICRO_LAYOUT_MIN_HEIGHT_PT, fontSize * 5.5),
  }
}

export function expandRectWithinPage(
  rect: { x: number; y: number; width: number; height: number },
  target: { width: number; height: number },
  page: PdfPageSize,
  margin = 18,
): { x: number; y: number; width: number; height: number; adjusted: boolean } {
  const maxW = Math.max(40, page.width - margin * 2)
  const maxH = Math.max(40, page.height - margin * 2)
  const width = Math.min(Math.max(rect.width, target.width), maxW)
  const height = Math.min(Math.max(rect.height, target.height), maxH)

  let x = rect.x
  let y = rect.y

  if (x + width > page.width - margin) x = Math.max(margin, page.width - margin - width)
  if (x < margin) x = margin
  if (y < margin) y = margin
  if (y + height > page.height - margin) y = Math.max(margin, page.height - margin - height)

  const adjusted = Math.abs(x - rect.x) > 0.5
    || Math.abs(y - rect.y) > 0.5
    || Math.abs(width - rect.width) > 0.5
    || Math.abs(height - rect.height) > 0.5

  return { x, y, width, height, adjusted }
}

function emptyLegacyExtras(detailX: number, detailMaxWidth: number) {
  return {
    signatureLabel: null as SignatureStampLayout['signatureLabel'],
    detailColumnX: detailX,
    detailMaxWidth,
    detailLines: [] as StampTextLine[],
    emailLabel: null as SignatureStampLayout['emailLabel'],
    emailValue: { x: detailX, y: 0, text: '', maxWidth: detailMaxWidth },
  }
}

function tryWideLayout(
  rect: { x: number; y: number; width: number; height: number },
  content: SignatureStampContent,
  fontSize: number,
  fieldScale: number,
  originalCard: { x: number; y: number; width: number; height: number },
  adjusted: boolean,
): SignatureStampLayout | null {
  const pad = STAMP_PAD_FULL * fieldScale
  const accentWidth = clamp(3.2 * fieldScale, 2.2, 4.5)
  const innerLeft = rect.x + pad + accentWidth
  const innerRight = rect.x + rect.width - pad
  const innerWidth = innerRight - innerLeft
  const top = rect.y + rect.height - pad
  const bottom = rect.y + pad
  if (innerWidth < 160 || top - bottom < 54) return null

  const leftWidth = innerWidth * STAMP_LEFT_RATIO
  const dividerX = innerLeft + leftWidth
  const auditX = dividerX + pad
  const auditW = Math.max(40, innerRight - auditX)
  const nameSize = clamp(fontSize * 1.35, 8, 14)
  const roleSize = clamp(fontSize * 0.95, 6.5, 10)
  const statusSize = clamp(fontSize * 0.95, 7, 10)
  const reasonSize = clamp(fontSize * 1.1, 7.5, 11)
  const metaSize = clamp(fontSize * 0.85, 6.5, 9)

  const nameBand = nameSize * 1.2 + roleSize * 1.15 + 4
  const imageBox = {
    x: innerLeft,
    y: bottom + nameBand,
    width: Math.max(36, leftWidth - 4),
    height: Math.max(24, top - bottom - nameBand - 2),
  }

  const nameY = bottom + roleSize * 1.15 + 2
  const nameLines: StampTextLine[] = [{
    text: ellipsize(content.signerName.trim() || 'Signer', leftWidth - 4, nameSize, true),
    x: innerLeft,
    y: nameY,
    bold: true,
    size: nameSize,
  }]
  const role = (content.role || '').trim()
  const roleLines: StampTextLine[] = role
    ? [{
        text: ellipsize(role, leftWidth - 4, roleSize),
        x: innerLeft,
        y: bottom + 1,
        bold: false,
        muted: true,
        size: roleSize,
      }]
    : []

  let cursor = top - statusSize
  const status = { x: auditX, y: cursor, text: 'DIGITALLY SIGNED', size: statusSize }
  cursor -= statusSize * 1.45
  const reasonLines: StampTextLine[] = []
  for (const line of wrapTextLines(content.reason.trim() || '—', auditW, reasonSize, 2, true)) {
    reasonLines.push({ text: line, x: auditX, y: cursor, bold: true, size: reasonSize })
    cursor -= reasonSize * 1.25
  }
  const metaLines: StampTextLine[] = []
  const pushMeta = (text: string) => {
    if (!text) return
    metaLines.push({
      text: ellipsize(text, auditW, metaSize),
      x: auditX,
      y: cursor,
      bold: false,
      muted: true,
      size: metaSize,
    })
    cursor -= metaSize * 1.2
  }
  pushMeta(content.signedAtLabel.trim())
  pushMeta(content.email.trim())
  if (content.recordId?.trim()) pushMeta(`Record ID: ${content.recordId.trim()}`)
  if (cursor < bottom - 1) return null

  return {
    mode: 'full',
    fontSize,
    fieldScale,
    pad,
    adjusted,
    originalCard,
    card: { ...rect },
    accentWidth,
    imageBox,
    nameLines,
    roleLines,
    status,
    reasonLines,
    metaLines,
    verticalDivider: { x: dividerX, y1: bottom, y2: top },
    horizontalDivider: null,
    ...emptyLegacyExtras(auditX, auditW),
  }
}

function tryCompactLayout(
  rect: { x: number; y: number; width: number; height: number },
  content: SignatureStampContent,
  fontSize: number,
  fieldScale: number,
  originalCard: { x: number; y: number; width: number; height: number },
  adjusted: boolean,
): SignatureStampLayout | null {
  const pad = STAMP_PAD_COMPACT * fieldScale
  const accentWidth = clamp(2.8 * fieldScale, 2, 4)
  const innerLeft = rect.x + pad + accentWidth
  const innerRight = rect.x + rect.width - pad
  const innerWidth = innerRight - innerLeft
  const top = rect.y + rect.height - pad
  const bottom = rect.y + pad
  if (innerWidth < 100 || top - bottom < 48) return null

  const nameSize = clamp(fontSize * 1.2, 7.5, 12)
  const roleSize = clamp(fontSize * 0.9, 6.5, 9)
  const statusSize = clamp(fontSize * 0.9, 6.5, 9)
  const reasonSize = clamp(fontSize, 7, 10)
  const metaSize = clamp(fontSize * 0.8, 6, 8.5)

  const identityH = Math.max(36, (top - bottom) * 0.55)
  const inkW = innerWidth * 0.4
  const imageBox = {
    x: innerLeft,
    y: top - identityH + 2,
    width: Math.max(28, inkW - 4),
    height: Math.max(20, identityH - nameSize - 4),
  }
  const signerX = innerLeft + inkW + 6
  const signerW = Math.max(40, innerRight - signerX)
  const nameLines: StampTextLine[] = [{
    text: ellipsize(content.signerName.trim() || 'Signer', signerW, nameSize, true),
    x: signerX,
    y: top - identityH + nameSize + 2,
    bold: true,
    size: nameSize,
  }]
  const role = (content.role || '').trim()
  const roleLines: StampTextLine[] = role
    ? [{
        text: ellipsize(role, signerW, roleSize),
        x: signerX,
        y: top - identityH + 2,
        bold: false,
        muted: true,
        size: roleSize,
      }]
    : []

  const auditTop = top - identityH - 4
  const hDividerY = auditTop
  let cursor = auditTop - statusSize - 2
  const status = { x: innerLeft, y: cursor, text: 'DIGITALLY SIGNED', size: statusSize }
  cursor -= statusSize * 1.3
  const reasonLines: StampTextLine[] = [{
    text: ellipsize(content.reason.trim() || '—', innerWidth, reasonSize, true),
    x: innerLeft,
    y: cursor,
    bold: true,
    size: reasonSize,
  }]
  cursor -= reasonSize * 1.25
  const metaLines: StampTextLine[] = []
  metaLines.push({
    text: ellipsize(content.signedAtLabel.trim(), innerWidth * 0.55, metaSize),
    x: innerLeft,
    y: cursor,
    bold: false,
    muted: true,
    size: metaSize,
  })
  if (content.recordId?.trim()) {
    metaLines.push({
      text: ellipsize(`ID: ${content.recordId.trim()}`, innerWidth * 0.42, metaSize),
      x: innerLeft + innerWidth * 0.55,
      y: cursor,
      bold: false,
      muted: true,
      size: metaSize,
      indent: innerWidth * 0.55,
    })
  }
  // Email intentionally omitted in compact (template hides .email first).
  if (cursor < bottom) return null

  return {
    mode: 'compact',
    fontSize,
    fieldScale,
    pad,
    adjusted,
    originalCard,
    card: { ...rect },
    accentWidth,
    imageBox,
    nameLines,
    roleLines,
    status,
    reasonLines,
    metaLines,
    verticalDivider: null,
    horizontalDivider: { y: hDividerY, x1: innerLeft, x2: innerRight },
    ...emptyLegacyExtras(innerLeft, innerWidth),
  }
}

function tryMicroLayout(
  rect: { x: number; y: number; width: number; height: number },
  content: SignatureStampContent,
  fontSize: number,
  fieldScale: number,
  originalCard: { x: number; y: number; width: number; height: number },
  adjusted: boolean,
): SignatureStampLayout | null {
  const pad = STAMP_PAD_NARROW * fieldScale
  const accentWidth = clamp(2.4 * fieldScale, 1.8, 3.5)
  const innerLeft = rect.x + pad + accentWidth
  const innerRight = rect.x + rect.width - pad
  const innerWidth = innerRight - innerLeft
  const top = rect.y + rect.height - pad
  const bottom = rect.y + pad
  if (innerWidth < 72 || top - bottom < 32) return null

  const nameSize = clamp(fontSize, 6.5, 10)
  const statusSize = clamp(fontSize * 0.85, 6, 8)
  const metaSize = clamp(fontSize * 0.8, 6, 8)
  const leftW = innerWidth * 0.42
  const rightX = innerLeft + leftW + 5
  const rightW = Math.max(36, innerRight - rightX)

  const imageBox = {
    x: innerLeft,
    y: bottom + nameSize * 1.25,
    width: Math.max(24, leftW - 2),
    height: Math.max(16, top - bottom - nameSize * 1.35),
  }
  const nameLines: StampTextLine[] = [{
    text: ellipsize(content.signerName.trim() || 'Signer', leftW, nameSize, true),
    x: innerLeft,
    y: bottom + 1,
    bold: true,
    size: nameSize,
  }]

  const status = {
    x: rightX,
    y: top - statusSize,
    text: 'DIGITALLY SIGNED',
    size: statusSize,
  }
  const { datePart, timePart } = splitSigningDateParts(content.signedAtLabel)
  const metaLines: StampTextLine[] = [{
    text: ellipsize(timePart ? `${datePart} ${timePart}` : datePart, rightW, metaSize),
    x: rightX,
    y: bottom + 2,
    bold: false,
    muted: true,
    size: metaSize,
  }]

  return {
    mode: 'narrow',
    fontSize,
    fieldScale,
    pad,
    adjusted,
    originalCard,
    card: { ...rect },
    accentWidth,
    imageBox,
    nameLines,
    roleLines: [],
    status,
    reasonLines: [],
    metaLines,
    verticalDivider: { x: innerLeft + leftW, y1: bottom, y2: top },
    horizontalDivider: null,
    ...emptyLegacyExtras(rightX, rightW),
  }
}

/** Tall narrow margin: ink on top, name / status / date stacked below. */
function trySlimLayout(
  rect: { x: number; y: number; width: number; height: number },
  content: SignatureStampContent,
  fontSize: number,
  fieldScale: number,
  originalCard: { x: number; y: number; width: number; height: number },
  adjusted: boolean,
): SignatureStampLayout | null {
  const pad = STAMP_PAD_SLIM * fieldScale
  const accentWidth = clamp(2.2 * fieldScale, 1.6, 3.2)
  const innerLeft = rect.x + pad + accentWidth
  const innerRight = rect.x + rect.width - pad
  const innerWidth = innerRight - innerLeft
  const top = rect.y + rect.height - pad
  const bottom = rect.y + pad
  if (innerWidth < 48 || top - bottom < 64) return null

  const nameSize = clamp(fontSize * 0.95, 6.5, 9)
  const statusSize = clamp(fontSize * 0.8, 6, 7.5)
  const metaSize = clamp(fontSize * 0.75, 6, 7)

  const inkH = Math.max(22, (top - bottom) * 0.42)
  const imageBox = {
    x: innerLeft,
    y: top - inkH,
    width: Math.max(28, innerWidth),
    height: Math.max(18, inkH - 2),
  }

  let cursor = top - inkH - 2
  const nameLines: StampTextLine[] = [{
    text: ellipsize(content.signerName.trim() || 'Signer', innerWidth, nameSize, true),
    x: innerLeft,
    y: cursor - nameSize,
    bold: true,
    size: nameSize,
  }]
  cursor -= nameSize * 1.25

  const status = {
    x: innerLeft,
    y: cursor - statusSize,
    text: 'DIGITALLY SIGNED',
    size: statusSize,
  }
  cursor -= statusSize * 1.3

  const { datePart, timePart } = splitSigningDateParts(content.signedAtLabel)
  const metaLines: StampTextLine[] = [{
    text: ellipsize(timePart ? `${datePart} ${timePart}` : datePart, innerWidth, metaSize),
    x: innerLeft,
    y: Math.max(bottom, cursor - metaSize),
    bold: false,
    muted: true,
    size: metaSize,
  }]

  if (metaLines[0]!.y < bottom - 0.5) return null

  return {
    mode: 'slim',
    fontSize,
    fieldScale,
    pad,
    adjusted,
    originalCard,
    card: { ...rect },
    accentWidth,
    imageBox,
    nameLines,
    roleLines: [],
    status,
    reasonLines: [],
    metaLines,
    verticalDivider: null,
    horizontalDivider: { y: top - inkH - 1, x1: innerLeft, x2: innerRight },
    ...emptyLegacyExtras(innerLeft, innerWidth),
  }
}

/** Short horizontal band: ink left, name + status + date right. */
function tryBannerLayout(
  rect: { x: number; y: number; width: number; height: number },
  content: SignatureStampContent,
  fontSize: number,
  fieldScale: number,
  originalCard: { x: number; y: number; width: number; height: number },
  adjusted: boolean,
): SignatureStampLayout | null {
  const pad = STAMP_PAD_BANNER * fieldScale
  const accentWidth = clamp(2 * fieldScale, 1.4, 2.8)
  const innerLeft = rect.x + pad + accentWidth
  const innerRight = rect.x + rect.width - pad
  const innerWidth = innerRight - innerLeft
  const top = rect.y + rect.height - pad
  const bottom = rect.y + pad
  const innerH = top - bottom
  if (innerWidth < 100 || innerH < 18) return null

  const nameSize = clamp(fontSize * 0.9, 6, 8.5)
  const statusSize = clamp(fontSize * 0.72, 5.5, 7)
  const metaSize = clamp(fontSize * 0.7, 5.5, 7)

  const inkW = Math.min(innerWidth * 0.34, innerH * 2.8)
  const imageBox = {
    x: innerLeft,
    y: bottom,
    width: Math.max(24, inkW),
    height: Math.max(14, innerH),
  }
  const textX = innerLeft + inkW + 5
  const textW = Math.max(40, innerRight - textX)
  if (textW < 36) return null

  const mid = bottom + innerH / 2
  const nameLines: StampTextLine[] = [{
    text: ellipsize(content.signerName.trim() || 'Signer', textW, nameSize, true),
    x: textX,
    y: mid + nameSize * 0.15,
    bold: true,
    size: nameSize,
  }]

  // Status as short label above date when height allows; else name + date only with tiny status.
  const status = {
    x: textX,
    y: top - statusSize - 0.5,
    text: innerH >= 24 ? 'DIGITALLY SIGNED' : 'SIGNED',
    size: statusSize,
  }

  const { datePart, timePart } = splitSigningDateParts(content.signedAtLabel)
  const metaLines: StampTextLine[] = [{
    text: ellipsize(timePart ? `${datePart} ${timePart}` : datePart, textW, metaSize),
    x: textX,
    y: bottom + 1,
    bold: false,
    muted: true,
    size: metaSize,
  }]

  return {
    mode: 'banner',
    fontSize,
    fieldScale,
    pad,
    adjusted,
    originalCard,
    card: { ...rect },
    accentWidth,
    imageBox,
    nameLines,
    roleLines: [],
    status,
    reasonLines: [],
    metaLines,
    verticalDivider: { x: textX - 2.5, y1: bottom, y2: top },
    horizontalDivider: null,
    ...emptyLegacyExtras(textX, textW),
  }
}

function tryLayoutAtRect(
  mode: StampLayoutMode,
  rect: { x: number; y: number; width: number; height: number },
  content: SignatureStampContent,
  fontSize: number,
  fieldScale: number,
  originalCard: { x: number; y: number; width: number; height: number },
  adjusted: boolean,
): SignatureStampLayout | null {
  if (mode === 'full') return tryWideLayout(rect, content, fontSize, fieldScale, originalCard, adjusted)
  if (mode === 'compact') return tryCompactLayout(rect, content, fontSize, fieldScale, originalCard, adjusted)
  if (mode === 'slim') return trySlimLayout(rect, content, fontSize, fieldScale, originalCard, adjusted)
  if (mode === 'banner') return tryBannerLayout(rect, content, fontSize, fieldScale, originalCard, adjusted)
  return tryMicroLayout(rect, content, fontSize, fieldScale, originalCard, adjusted)
}

/**
 * Adaptive signature stamp planner aligned to the professional template.
 * Switches wide → compact → micro / slim / banner; expands within the page when needed.
 */
export function planSignatureStampLayout(
  rect: { x: number; y: number; width: number; height: number },
  content: SignatureStampContent,
  page?: PdfPageSize,
): SignatureStampLayout {
  const originalCard = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  const pageSize = page ?? {
    width: Math.max(rect.x + rect.width + 36, 612),
    height: Math.max(rect.y + rect.height + 36, 792),
  }
  const fieldScale = computeFieldScale(rect.width, rect.height)
  const baseFont = clamp(STAMP_PREFERRED_FONT_PT * fieldScale, STAMP_MIN_FONT_PT, 12)
  const fontSizes = [baseFont, baseFont * 0.92, baseFont * 0.84, STAMP_MIN_FONT_PT]
  const preferred = pickPreferredMode(rect.width, rect.height)

  for (const mode of modesToTry(preferred)) {
    for (const fontSize of fontSizes) {
      const fitted = tryLayoutAtRect(mode, rect, content, fontSize, fieldScale, originalCard, false)
      if (fitted) return fitted
    }
  }

  for (const mode of modesToTry(preferred)) {
    for (const fontSize of fontSizes) {
      const target = estimateMinSize(mode, content, fontSize)
      const expanded = expandRectWithinPage(rect, target, pageSize)
      if (expanded.width + 0.5 < target.width && expanded.height + 0.5 < target.height) continue
      const scale = computeFieldScale(expanded.width, expanded.height)
      const fitted = tryLayoutAtRect(
        mode,
        { x: expanded.x, y: expanded.y, width: expanded.width, height: expanded.height },
        content,
        fontSize,
        scale,
        originalCard,
        true,
      )
      if (fitted) return { ...fitted, adjusted: true }
    }
  }

  throw new Error(
    'This PDF page does not have enough free space to display a complete, readable signature manifestation.',
  )
}

/** @deprecated Kept for callers; adaptive planner no longer hard-blocks on fixed pt sizes. */
export const MIN_SIGNATURE_FIELD_WIDTH_PT = Math.min(MICRO_LAYOUT_MIN_WIDTH_PT, SLIM_LAYOUT_MIN_WIDTH_PT, BANNER_LAYOUT_MIN_WIDTH_PT)
export const MIN_SIGNATURE_FIELD_HEIGHT_PT = Math.min(MICRO_LAYOUT_MIN_HEIGHT_PT, SLIM_LAYOUT_MIN_HEIGHT_PT, BANNER_LAYOUT_MIN_HEIGHT_PT)
export function assertSignatureFieldReadable(_rect: { width: number; height: number }): void {
  // no-op: content-based planning replaced fixed minimum gates
}
