/**
 * Apply content-page integrity footers, signature verify links, and QR marks.
 * Must run AFTER stamps exist and BEFORE completion-history pages.
 * Final file SHA-256 must be computed only after this + history append.
 */
import {
  PDFDocument,
  PDFString,
  StandardFonts,
  rgb,
  type PDFPage,
} from 'https://esm.sh/pdf-lib@1.17.1'
import {
  buildPageIntegrityMaterial,
  buildPublicVerifyUrl,
  formatIntegrityFooterLine,
  PAGE_INTEGRITY_ALGORITHM,
  sha256HexText,
  truncatePageIntegrityCode,
} from './edocPageIntegrity.ts'
import { cssNormalizedToPdfRect, sha256Hex } from './edocPdfStamp.ts'

export type PageIntegrityRecord = {
  pageNumber: number
  pageContentSha256: string
  pageIntegrityCodeFull: string
  pageIntegrityCodeDisplay: string
  algorithm: typeof PAGE_INTEGRITY_ALGORITHM
}

export type SignatureFieldLink = {
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
}

async function hashSinglePageContent(source: PDFDocument, pageIndex: number): Promise<string> {
  const temp = await PDFDocument.create()
  const [copied] = await temp.copyPages(source, [pageIndex])
  temp.addPage(copied)
  const bytes = await temp.save()
  return sha256Hex(bytes)
}

function drawCenteredFooter(page: PDFPage, text: string, font: Awaited<ReturnType<PDFDocument['embedFont']>>) {
  const { width } = page.getSize()
  const size = Math.min(6.5, Math.max(5.2, width / 130))
  const maxWidth = width - 36
  let line = text
  // Helvetica/WinAnsi: use ASCII ellipsis only.
  while (font.widthOfTextAtSize(line, size) > maxWidth && line.length > 24) {
    line = `${line.slice(0, Math.floor(line.length * 0.9))}...`
  }
  const textWidth = font.widthOfTextAtSize(line, size)
  const x = Math.max(18, (width - textWidth) / 2)
  const y = 10
  // Opaque strip (no opacity API) so footer stays readable in all pdf-lib builds.
  page.drawRectangle({
    x: 12,
    y: 4,
    width: width - 24,
    height: 14,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  })
  page.drawText(line, {
    x,
    y,
    size,
    font,
    color: rgb(0.25, 0.32, 0.38),
    maxWidth,
  })
}

function addUriLink(page: PDFPage, pdf: PDFDocument, rect: { x: number; y: number; width: number; height: number }, uri: string) {
  const context = pdf.context
  const linkDict = context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
    Border: [0, 0, 1],
    C: [0.05, 0.49, 0.51],
    A: {
      Type: 'Action',
      S: 'URI',
      URI: PDFString.of(uri),
    },
    Contents: PDFString.of('Verify this electronic signature.'),
  })
  const linkRef = context.register(linkDict)
  page.node.addAnnot(linkRef)
}

async function embedQrPng(pdf: PDFDocument, url: string): Promise<import('https://esm.sh/pdf-lib@1.17.1').PDFImage | null> {
  try {
    const QRCode = await import('https://esm.sh/qrcode@1.5.4')
    const dataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 128,
      color: { dark: '#102a43', light: '#ffffff' },
    }) as string
    const match = /^data:image\/png;base64,(.+)$/i.exec(dataUrl)
    if (!match) return null
    const binary = atob(match[1])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return pdf.embedPng(bytes)
  } catch {
    return null
  }
}

/**
 * 1) Hash each content page (pre-footer)
 * 2) Draw integrity footers
 * 3) Add signature URI links + QR (verify URL)
 */
export async function applyContentIntegrityAndVerifyMarks(
  pdf: PDFDocument,
  input: {
    documentId: string
    revision: string | number
    contentPageCount: number
    verificationCode: string
    verifyBaseUrl: string
    signatureFields: SignatureFieldLink[]
  },
): Promise<{ records: PageIntegrityRecord[]; verifyUrl: string }> {
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const pages = pdf.getPages()
  const contentCount = Math.min(input.contentPageCount, pages.length)
  const records: PageIntegrityRecord[] = []

  for (let i = 0; i < contentCount; i += 1) {
    const pageNumber = i + 1
    const pageContentSha256 = await hashSinglePageContent(pdf, i)
    const material = buildPageIntegrityMaterial({
      documentId: input.documentId,
      revision: input.revision,
      pageNumber,
      pageContentSha256,
    })
    const full = await sha256HexText(material)
    const display = truncatePageIntegrityCode(full)
    records.push({
      pageNumber,
      pageContentSha256,
      pageIntegrityCodeFull: full,
      pageIntegrityCodeDisplay: display,
      algorithm: PAGE_INTEGRITY_ALGORITHM,
    })
  }

  for (const record of records) {
    const page = pages[record.pageNumber - 1]
    if (!page) continue
    drawCenteredFooter(
      page,
      formatIntegrityFooterLine({
        documentId: input.documentId,
        revision: input.revision,
        pageNumber: record.pageNumber,
        pageCount: contentCount,
        pageIntegrityCode: record.pageIntegrityCodeDisplay,
      }),
      font,
    )
  }

  const verifyUrl = buildPublicVerifyUrl(input.verifyBaseUrl, input.verificationCode)
  let qrImage: import('https://esm.sh/pdf-lib@1.17.1').PDFImage | null = null
  try {
    qrImage = await embedQrPng(pdf, verifyUrl)
  } catch {
    qrImage = null
  }

  for (const field of input.signatureFields) {
    const pageIndex = Math.min(Math.max(Number(field.pageNumber) || 1, 1), pages.length) - 1
    const page = pages[pageIndex]
    if (!page) continue
    const { width: pageW, height: pageH } = page.getSize()
    const pdfRect = cssNormalizedToPdfRect(
      {
        x: Number(field.x) || 0,
        y: Number(field.y) || 0,
        width: Number(field.width) || 0,
        height: Number(field.height) || 0,
      },
      { width: pageW, height: pageH },
    )
    if (!(pdfRect.width > 2 && pdfRect.height > 2)) continue

    try {
      addUriLink(page, pdf, pdfRect, verifyUrl)
    } catch {
      // Link annotation is best-effort; footer + QR still apply.
    }

    if (qrImage) {
      try {
        const qrSize = Math.min(28, Math.max(16, pdfRect.width * 0.22), pdfRect.height * 0.55)
        if (!(qrSize > 0)) continue
        const qrX = pdfRect.x + pdfRect.width - qrSize - 2
        const qrY = pdfRect.y + 2
        page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })
        page.drawText('Scan or click to verify document authenticity.', {
          x: pdfRect.x + 2,
          y: Math.max(pdfRect.y - 8, 16),
          size: 5.5,
          font,
          color: rgb(0.05, 0.49, 0.51),
          maxWidth: pdfRect.width,
        })
      } catch {
        // QR/caption best-effort.
      }
    }
  }

  return { records, verifyUrl }
}
