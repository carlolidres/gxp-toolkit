/** Max PNG size for profile signature uploads (transparent backgrounds required). */
export const PROFILE_SIGNATURE_MAX_BYTES = 512 * 1024

/** Near-white pixels at/above this channel value become transparent. */
const WHITE_CUTOFF = 245

export function isPngFile(file: File): boolean {
  const nameOk = file.name.toLowerCase().endsWith('.png')
  const typeOk = !file.type || file.type === 'image/png'
  return nameOk && typeOk
}

export function validateSignaturePng(file: File): string | null {
  if (!isPngFile(file)) return 'Signature must be a PNG file.'
  if (file.size <= 0) return 'The selected file is empty.'
  if (file.size > PROFILE_SIGNATURE_MAX_BYTES) {
    return `Signature PNG must be ${Math.round(PROFILE_SIGNATURE_MAX_BYTES / 1024)} KB or smaller.`
  }
  return null
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string' || !result.startsWith('data:image/png')) {
        reject(new Error('Could not read the PNG signature.'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error('Could not read the PNG signature.'))
    reader.readAsDataURL(file)
  })
}

/**
 * Force near-white / opaque paper backgrounds to transparent so stamped ink
 * has no plate behind it. Already-transparent pixels are left alone.
 */
export async function stripSignatureBackground(dataUrl: string): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return dataUrl

  const image = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  if (canvas.width <= 0 || canvas.height <= 0) {
    throw new Error('Signature image has no usable dimensions.')
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return dataUrl

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = imageData
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a === 0) continue
    if (r >= WHITE_CUTOFF && g >= WHITE_CUTOFF && b >= WHITE_CUTOFF) {
      data[i + 3] = 0
    }
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

export async function prepareSignaturePngDataUrl(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file)
  return stripSignatureBackground(dataUrl)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not decode the PNG signature.'))
    image.src = src
  })
}
