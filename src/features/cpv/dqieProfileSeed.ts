import seed from '../../data/dqieProfileSeed.json'

const STORAGE_KEY = 'gxp.cpv.product-profile.v1'

/** Copies the saved DQIE profile sheets into this browser when those sheets are not already stored. */
export function installDqieProfileSeed(): void {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const current = raw ? JSON.parse(raw) as Record<string, unknown> : {}
    if (!current || typeof current !== 'object' || Array.isArray(current)) return
    let changed = false
    for (const [key, value] of Object.entries(seed)) {
      if (!key.startsWith('DQIE:') || current[key]) continue
      current[key] = value
      changed = true
    }
    if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Leave the visitor's storage unchanged when it cannot be read or written.
  }
}
