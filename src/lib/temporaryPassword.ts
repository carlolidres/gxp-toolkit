const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const DIGITS = '23456789'
const SPECIAL = '!@#$%^&*-_=+'
const ALL = UPPER + LOWER + DIGITS + SPECIAL

function pick(charset: string, random: () => number): string {
  return charset[Math.floor(random() * charset.length)]!
}

/** Cryptographically strong when `crypto.getRandomValues` is available. */
export function generateTemporaryPassword(length = 16): string {
  if (length < 4) throw new Error('Temporary password length must be at least 4.')

  const random = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const buf = new Uint32Array(1)
      crypto.getRandomValues(buf)
      return buf[0]! / 0x1_0000_0000
    }
    return Math.random()
  }

  const required = [pick(UPPER, random), pick(LOWER, random), pick(DIGITS, random), pick(SPECIAL, random)]
  const rest = Array.from({ length: length - required.length }, () => pick(ALL, random))
  const chars = [...required, ...rest]

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }

  return chars.join('')
}

export function isStrongTemporaryPassword(value: string): boolean {
  return (
    value.length >= 16 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[!@#$%^&*\-_=+]/.test(value)
  )
}
