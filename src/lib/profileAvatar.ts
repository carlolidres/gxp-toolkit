/** Profile picture uploads for Account Settings / app chrome avatars. */

export const PROFILE_AVATAR_MAX_BYTES = 1024 * 1024
export const PROFILE_AVATAR_MAX_EDGE = 256

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp']

export function isAvatarImageFile(file: File): boolean {
  const name = file.name.toLowerCase()
  const extOk = ALLOWED_EXT.some((ext) => name.endsWith(ext))
  const typeOk = !file.type || ALLOWED_TYPES.has(file.type)
  return extOk && typeOk
}

export function validateAvatarImage(file: File): string | null {
  if (!isAvatarImageFile(file)) return 'Profile picture must be a JPG, PNG, or WebP image.'
  if (file.size <= 0) return 'The selected file is empty.'
  if (file.size > PROFILE_AVATAR_MAX_BYTES) {
    return `Profile picture must be ${Math.round(PROFILE_AVATAR_MAX_BYTES / 1024)} KB or smaller.`
  }
  return null
}

/** Reads an image file and returns a compressed square-ish JPEG/PNG data URL. */
export async function readAvatarAsDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const edge = Math.min(PROFILE_AVATAR_MAX_EDGE, Math.max(image.naturalWidth, image.naturalHeight))
    const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight, 1))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process the profile picture.')
    ctx.drawImage(image, 0, 0, width, height)
    // Prefer JPEG for photos; keep PNG when the source had transparency intent.
    if (file.type === 'image/png') {
      return canvas.toDataURL('image/png')
    }
    return canvas.toDataURL('image/jpeg', 0.88)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not read the profile picture.'))
    image.src = src
  })
}
