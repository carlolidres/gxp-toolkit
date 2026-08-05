/**
 * eDoc page-integrity canonicalization (edoc-page-integrity-v1).
 * Shared pure helpers — mirrored conceptually in edge `_shared/edocPageIntegrity.ts`.
 */

export const PAGE_INTEGRITY_ALGORITHM = 'edoc-page-integrity-v1' as const

/** Visible truncated code length (hex chars). Never label this as the full PDF file hash. */
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
  if (!/^[a-f0-9]+$/.test(hex)) throw new Error('Page integrity digest must be hex.')
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

export function buildPublicVerifyPath(verificationCode: string): string {
  const code = verificationCode.trim()
  if (!code) throw new Error('verificationCode is required')
  return `#/verify/${encodeURIComponent(code)}`
}

export function buildPublicVerifyUrl(baseUrl: string, verificationCode: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  const path = buildPublicVerifyPath(verificationCode)
  // HashRouter: origin+basePath + #/verify/...
  if (base.includes('#')) return `${base.replace(/#.*$/, '')}${path}`
  return `${base}/${path}`.replace(/([^:]\/)\/+/g, '$1')
}

/** True when page-integrity rows match the certificate content page count. */
export function isEdocIntegrityPackageComplete(
  integrityCount: number,
  contentPageCount: number | null | undefined,
): boolean {
  if (integrityCount <= 0) return false
  if (contentPageCount == null || contentPageCount <= 0) return false
  return integrityCount === contentPageCount
}
