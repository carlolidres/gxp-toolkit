import { describe, expect, it } from 'vitest'

import { PROFILE_SIGNATURE_MAX_BYTES, validateSignaturePng } from './profileSignature'

function fakeFile(name: string, type: string, size: number): File {
  const blob = new Blob([new Uint8Array(size)], { type })
  return new File([blob], name, { type })
}

describe('validateSignaturePng', () => {
  it('accepts a small PNG', () => {
    expect(validateSignaturePng(fakeFile('sig.png', 'image/png', 1200))).toBeNull()
  })

  it('rejects non-PNG extensions', () => {
    expect(validateSignaturePng(fakeFile('sig.jpg', 'image/jpeg', 1200))).toBe(
      'Signature must be a PNG file.',
    )
  })

  it('rejects oversized PNGs', () => {
    expect(
      validateSignaturePng(fakeFile('sig.png', 'image/png', PROFILE_SIGNATURE_MAX_BYTES + 1)),
    ).toMatch(/KB or smaller/)
  })
})
