/** Max PNG size for profile signature uploads (transparent backgrounds allowed). */
export const PROFILE_SIGNATURE_MAX_BYTES = 512 * 1024

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
