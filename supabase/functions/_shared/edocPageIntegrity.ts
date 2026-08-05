/**
 * Edge copy of page-integrity helpers (keep in sync with src/features/edoc/pageIntegrity.ts).
 */
export const PAGE_INTEGRITY_ALGORITHM = 'edoc-page-integrity-v1' as const
export const PAGE_INTEGRITY_DISPLAY_LENGTH = 16

export function buildPageIntegrityMaterial(input: {
  documentId: string
  revision: string | number
  pageNumber: number
  pageContentSha256: string
}): string {
  return [
    PAGE_INTEGRITY_ALGORITHM,
    input.documentId.trim(),
    String(input.revision).trim(),
    String(input.pageNumber),
    input.pageContentSha256.trim().toLowerCase(),
  ].join('|')
}

export function truncatePageIntegrityCode(fullHex: string, length = PAGE_INTEGRITY_DISPLAY_LENGTH): string {
  const hex = fullHex.trim().toLowerCase()
  return hex.slice(0, Math.max(8, length))
}

export function formatIntegrityFooterLine(input: {
  documentId: string
  revision: string | number
  pageNumber: number
  pageCount: number
  pageIntegrityCode: string
}): string {
  const doc = input.documentId.trim()
  const rev = String(input.revision).trim()
  const code = input.pageIntegrityCode.trim().toUpperCase()
  return `Document ID: ${doc} | Revision: ${rev} | Page ${input.pageNumber} of ${input.pageCount} | Page Integrity Code: ${code}`
}

export function buildPublicVerifyUrl(baseUrl: string, verificationCode: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  const code = encodeURIComponent(verificationCode.trim())
  if (base.includes('#')) return `${base.replace(/#.*$/, '')}#/verify/${code}`
  return `${base}/#/verify/${code}`.replace(/([^:]\/)\/+/g, '$1')
}

export async function sha256HexText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
