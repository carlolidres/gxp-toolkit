import { describe, expect, it } from 'vitest'

import {
  buildPageIntegrityMaterial,
  buildPublicVerifyUrl,
  formatIntegrityFooterLine,
  isEdocIntegrityPackageComplete,
  PAGE_INTEGRITY_ALGORITHM,
  truncatePageIntegrityCode,
} from './pageIntegrity'

describe('pageIntegrity', () => {
  it('builds stable canonical material for page codes', () => {
    const material = buildPageIntegrityMaterial({
      documentId: 'doc-1',
      revision: 2,
      pageNumber: 3,
      pageContentSha256: 'ABC',
    })
    expect(material).toBe(`${PAGE_INTEGRITY_ALGORITHM}|doc-1|2|3|abc`)
  })

  it('truncates display codes without claiming full-file hash', () => {
    const full = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    expect(truncatePageIntegrityCode(full)).toBe('0123456789abcdef')
  })

  it('formats footer line with required fields', () => {
    expect(
      formatIntegrityFooterLine({
        documentId: 'DOC-9',
        revision: 1,
        pageNumber: 2,
        pageCount: 5,
        pageIntegrityCode: 'aabbccdd',
      }),
    ).toContain('Page Integrity Code: AABBCCDD')
  })

  it('builds hash-router verify URLs without embedding secrets', () => {
    expect(buildPublicVerifyUrl('https://example.com/gxp-toolkit/', 'opaque-id')).toBe(
      'https://example.com/gxp-toolkit/#/verify/opaque-id',
    )
  })

  it('requires integrity row count to match content page count', () => {
    expect(isEdocIntegrityPackageComplete(0, 3)).toBe(false)
    expect(isEdocIntegrityPackageComplete(2, 3)).toBe(false)
    expect(isEdocIntegrityPackageComplete(3, null)).toBe(false)
    expect(isEdocIntegrityPackageComplete(3, 3)).toBe(true)
  })
})
