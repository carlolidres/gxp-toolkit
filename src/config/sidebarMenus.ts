export interface SidebarSubmenuItem {
  id: string
  label: string
  path: string
  hash: string
}

export const multiformComponentMenu: SidebarSubmenuItem[] = [
  { id: 'forms', label: 'Form controls', path: '/components', hash: 'forms' },
  { id: 'tables', label: 'Data tables', path: '/components', hash: 'tables' },
  { id: 'feedback', label: 'Feedback states', path: '/components', hash: 'feedback' },
  { id: 'modals', label: 'Modals & dialogs', path: '/components', hash: 'modals' },
]

export const multiTabFormsMenu: SidebarSubmenuItem[] = [
  { id: 'project-entry', label: 'New project', path: '/multiforms', hash: 'project-entry' },
  { id: 'tab-am', label: 'AM/BM/PL', path: '/multiforms', hash: 'tab-am' },
  { id: 'tab-pp', label: 'PP', path: '/multiforms', hash: 'tab-pp' },
  { id: 'tab-tsd', label: 'TSD', path: '/multiforms', hash: 'tab-tsd' },
  { id: 'tab-val', label: 'VAL', path: '/multiforms', hash: 'tab-val' },
  { id: 'tab-qc', label: 'QC', path: '/multiforms', hash: 'tab-qc' },
]

export const appModuleMenu: SidebarSubmenuItem[] = [
  { id: 'capability', label: 'Capability / Six Sigma', path: '/statistics', hash: 'capability' },
  { id: 'basic-charts', label: 'Basic charts', path: '/statistics', hash: 'basic-charts' },
  { id: 'distribution-charts', label: 'Distribution charts', path: '/statistics', hash: 'distribution-charts' },
  { id: 'relationship-charts', label: 'Relationship charts', path: '/statistics', hash: 'relationship-charts' },
  { id: 'control-charts', label: 'Control charts', path: '/statistics', hash: 'control-charts' },
]

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
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash
  const match = [...multiformComponentMenu, ...multiTabFormsMenu, ...appModuleMenu].find(
    (item) => item.path === pathname && item.hash === normalizedHash,
  )
  return match?.label
}
