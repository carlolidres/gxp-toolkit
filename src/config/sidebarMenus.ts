export interface SidebarSubmenuItem {
  id: string
  label: string
  path: string
  hash: string
}

export function submenuHref(item: SidebarSubmenuItem): string {
  return item.hash ? `${item.path}#${item.hash}` : item.path
}

export function isSidebarItemActive(
  item: SidebarSubmenuItem,
  pathname: string,
  hash: string,
): boolean {
  if (pathname !== item.path) return false
  if (!item.hash) return true
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash
  return normalizedHash === item.hash
}

export function findSubmenuLabel(pathname: string, hash: string): string | undefined {
  void pathname
  void hash
  return undefined
}
