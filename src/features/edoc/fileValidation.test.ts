import { describe, expect, it } from 'vitest'

import { EDOC_MAX_PDF_BYTES, hasPdfSignature, sha256Hex, validateEdocPdfFile } from './fileValidation'

describe('eDoc file validation', () => {
  it('accepts a normal PDF metadata shape', () => {
    expect(validateEdocPdfFile({ name: 'test.pdf', type: 'application/pdf', size: 1024 }).ok).toBe(true)
  })

  it('rejects unsupported files and oversized PDFs', () => {
    expect(validateEdocPdfFile({ name: 'test.txt', type: 'text/plain', size: 1024 }).ok).toBe(false)
    expect(validateEdocPdfFile({ name: 'test.pdf', type: 'application/pdf', size: EDOC_MAX_PDF_BYTES + 1 }).ok).toBe(false)
  })

  it('checks PDF magic bytes and computes SHA-256', async () => {
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'a.pdf', { type: 'application/pdf' })
    expect(await hasPdfSignature(file)).toBe(true)
    expect(await sha256Hex(file)).toMatch(/^[a-f0-9]{64}$/)
  })
})

