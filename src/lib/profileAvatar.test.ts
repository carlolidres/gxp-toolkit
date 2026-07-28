import { describe, expect, it } from 'vitest'

import { isAvatarImageFile, validateAvatarImage } from './profileAvatar'

function fakeFile(name: string, type: string, size = 1024): File {
  const buffer = new Uint8Array(size)
  return new File([buffer], name, { type })
}

describe('profileAvatar', () => {
  it('accepts common image types within size limit', () => {
    expect(validateAvatarImage(fakeFile('me.jpg', 'image/jpeg'))).toBeNull()
    expect(validateAvatarImage(fakeFile('me.png', 'image/png'))).toBeNull()
    expect(validateAvatarImage(fakeFile('me.webp', 'image/webp'))).toBeNull()
    expect(isAvatarImageFile(fakeFile('me.jpeg', 'image/jpeg'))).toBe(true)
  })

  it('rejects non-images and oversized files', () => {
    expect(validateAvatarImage(fakeFile('me.gif', 'image/gif'))).toMatch(/JPG, PNG, or WebP/)
    expect(validateAvatarImage(fakeFile('me.jpg', 'image/jpeg', 2 * 1024 * 1024))).toMatch(/KB or smaller/)
    expect(validateAvatarImage(fakeFile('me.jpg', 'image/jpeg', 0))).toMatch(/empty/)
  })
})
