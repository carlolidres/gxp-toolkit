/**
 * C15: HashRouter return URLs. Put the billing flag in the query *before* the hash
 * so Paddle can append `_ptxn` without swallowing the route.
 */

export type BillingReturnKind = 'success' | 'cancelled'

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', 'carlolidres.github.io'])

export function buildBillingReturnUrl(
  origin: string,
  basePath: string,
  kind: BillingReturnKind,
): string {
  const originClean = origin.trim().replace(/\/+$/, '')
  let base = basePath.trim() || '/'
  if (!base.startsWith('/')) base = `/${base}`
  if (!base.endsWith('/')) base = `${base}/`
  const path = kind === 'success' ? 'success' : 'cancelled'
  return `${originClean}${base}?billing=${path}#/billing/${path}`
}

export function isAllowedBillingReturnUrl(value: string, kind: BillingReturnKind): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return false
    if (url.protocol === 'https:' && url.hostname !== 'carlolidres.github.io') return false
    if (!ALLOWED_HOSTS.has(url.hostname)) return false
    const expectedHash = kind === 'success' ? '#/billing/success' : '#/billing/cancelled'
    if (url.hash !== expectedHash) return false
    if (url.searchParams.get('billing') !== (kind === 'success' ? 'success' : 'cancelled')) return false
    return true
  } catch {
    return false
  }
}

/** C4: the browser success/cancel page must never activate a plan. */
export function shouldActivateFromCheckoutReturn(): false {
  return false
}
