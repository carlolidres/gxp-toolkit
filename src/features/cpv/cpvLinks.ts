import { productProfilePath } from './productProfile'

export function cpvWorkspacePath(productId: string, section = ''): string {
  return section ? `/cpv/products/${productId}/${section}` : `/cpv/products/${productId}`
}

export function cpvWorkspaceHref(productId: string, section = ''): string {
  return `${window.location.pathname}${window.location.search}#${cpvWorkspacePath(productId, section)}`
}

/** Full address for a product profile, including the current site path and hash route. */
export function cpvProductWindowHref(productCode: string): string {
  const url = new URL(window.location.href)
  url.hash = productProfilePath(productCode)
  return url.toString()
}

function copySessionStorage(target: Window) {
  const keys: string[] = []
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index)
    if (key) keys.push(key)
  }
  for (const key of keys) {
    const value = sessionStorage.getItem(key)
    if (value != null) target.sessionStorage.setItem(key, value)
  }
}

/**
 * Opens the profile URL in a new window and copies this tab’s session into it.
 * Sign-in is stored per tab, so a plain link would land on the login page.
 */
export function openCpvProductWindow(productCode: string): boolean {
  const tab = window.open('', '_blank')
  if (!tab) return false
  try {
    copySessionStorage(tab)
  } catch {
    tab.close()
    return false
  }
  tab.location.replace(cpvProductWindowHref(productCode))
  return true
}
