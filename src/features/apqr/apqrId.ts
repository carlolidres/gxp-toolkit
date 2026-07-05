const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const ALPHANUM = UPPER + LOWER + DIGITS

/** Current APQR ID: 4 alphanumeric chars with upper and lower case. */
export const APQR_ID_PATTERN = /^[A-Za-z0-9]{4}$/

export function hasMixedApqrIdCase(id: string): boolean {
  return /[A-Z]/.test(id) && /[a-z]/.test(id)
}

export function isValidApqrId(id: string): boolean {
  return APQR_ID_PATTERN.test(id) && hasMixedApqrIdCase(id)
}

function randomChar(pool: string): string {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return pool[bytes[0]! % pool.length]!
}

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const bytes = new Uint32Array(1)
    crypto.getRandomValues(bytes)
    const j = bytes[0]! % (i + 1)
    ;[items[i], items[j]] = [items[j]!, items[i]!]
  }
}

export function generateApqrId(): string {
  const chars = [randomChar(UPPER), randomChar(LOWER), randomChar(ALPHANUM), randomChar(ALPHANUM)]
  shuffleInPlace(chars)
  return chars.join('')
}

export function generateUniqueApqrId(taken: Iterable<string>, maxAttempts = 100): string {
  const used = new Set(taken)
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const id = generateApqrId()
    if (!used.has(id)) return id
  }
  throw new Error('Failed to generate unique APQR ID')
}
