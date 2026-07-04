import type { SidebarSubmenuItem } from './sidebarMenus'

export const APP_NAME = 'GxP Toolkit'
export const APP_TAGLINE = 'Quality systems kit'
export const VRMS_MENU_TOOLTIP = 'Validation Routing Monitoring System'
export const VMP_MENU_TOOLTIP = 'Validation Master Plan'
export const EDOC_MENU_TOOLTIP = 'Electronic document routing and signature'
export const APQR_MENU_TOOLTIP = 'Annual Product Quality Review monitoring and scheduling'

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export'

export const PERMISSION_ACTIONS: PermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'export',
]

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  export: 'Export',
}

export interface NavMenuDefinition extends SidebarSubmenuItem {
  actions: PermissionAction[]
}

export interface NavGroupDefinition {
  id: string
  label: string
  tooltip?: string
  items: NavMenuDefinition[]
}

const MENU_ACTIONS: Record<string, PermissionAction[]> = {
  dashboard: ['view', 'export'],
  routing: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  database: ['view', 'export'],
  audit: ['view', 'export'],
  registry: ['view', 'create', 'edit', 'delete'],
  'vmp-masterlist': ['view', 'create', 'edit', 'delete', 'export'],
  'vmp-risk-assessment': ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  'vmp-timeline': ['view', 'create', 'edit', 'delete', 'export'],
  'vmp-database': ['view', 'export'],
  'vmp-audit': ['view', 'export'],
  'edoc-dashboard': ['view', 'export'],
  'edoc-inbox': ['view', 'approve'],
  'edoc-my-documents': ['view', 'create', 'edit', 'export'],
  'edoc-all-documents': ['view', 'export'],
  'edoc-create': ['view', 'create'],
  'edoc-returned': ['view', 'edit', 'export'],
  'edoc-completed': ['view', 'export'],
  'edoc-routing-templates': ['view', 'create', 'edit', 'delete'],
  'edoc-reports': ['view', 'export'],
  'edoc-audit': ['view', 'export'],
  'edoc-admin': ['view', 'create', 'edit', 'delete', 'export'],
  'apqr-dashboard': ['view', 'export'],
  'apqr-registry': ['view', 'create', 'edit', 'delete', 'export'],
  'apqr-scheduler': ['view', 'create', 'edit', 'delete', 'export'],
  'apqr-database': ['view', 'export'],
  'apqr-form': ['view', 'create', 'edit'],
  'apqr-audit': ['view', 'export'],
  'user-management': ['view', 'create', 'edit', 'delete'],
}

function menu(
  id: string,
  label: string,
  path: string,
  hash = '',
): NavMenuDefinition {
  return {
    id,
    label,
    path,
    hash,
    actions: MENU_ACTIONS[id] ?? ['view'],
  }
}

/** Single source of truth for sidebar menus and permission options. */
export const navigationRegistry: NavGroupDefinition[] = [
  {
    id: 'vrms',
    label: 'VRMS',
    tooltip: VRMS_MENU_TOOLTIP,
    items: [
      menu('dashboard', 'Dashboard', '/'),
      menu('routing', 'Document Routing', '/routing'),
      menu('database', 'Database', '/database'),
      menu('audit', 'Audit Trail', '/audit'),
      menu('registry', 'Registry', '/registry'),
    ],
  },
  {
    id: 'vmp',
    label: 'VMP',
    tooltip: VMP_MENU_TOOLTIP,
    items: [
      menu('vmp-masterlist', 'Masterlist Form', '/vmp/masterlist'),
      menu('vmp-risk-assessment', 'Risk Assessment', '/vmp/risk-assessment'),
      menu('vmp-timeline', 'Timeline', '/vmp/timeline'),
      menu('vmp-database', 'Database', '/vmp/database'),
      menu('vmp-audit', 'Audit Trail', '/vmp/audit'),
    ],
  },
  {
    id: 'edoc',
    label: 'eDoc',
    tooltip: EDOC_MENU_TOOLTIP,
    items: [
      menu('edoc-dashboard', 'Dashboard', '/edoc'),
      menu('edoc-inbox', 'My Inbox', '/edoc/inbox'),
      menu('edoc-my-documents', 'My Documents', '/edoc/my-documents'),
      menu('edoc-all-documents', 'All Documents', '/edoc/documents'),
      menu('edoc-create', 'Create Document', '/edoc/create'),
      menu('edoc-returned', 'Returned Documents', '/edoc/returned'),
      menu('edoc-completed', 'Completed Documents', '/edoc/completed'),
      menu('edoc-routing-templates', 'Routing Templates', '/edoc/templates'),
      menu('edoc-reports', 'Reports', '/edoc/reports'),
      menu('edoc-audit', 'Audit Trail', '/edoc/audit'),
      menu('edoc-admin', 'Administration', '/edoc/admin'),
    ],
  },
  {
    id: 'apqr',
    label: 'APQR',
    tooltip: APQR_MENU_TOOLTIP,
    items: [
      menu('apqr-dashboard', 'Dashboard', '/apqr'),
      menu('apqr-registry', 'Client Registry', '/apqr/registry'),
      menu('apqr-scheduler', 'APQR Scheduler', '/apqr/scheduler'),
      menu('apqr-database', 'APQR Database', '/apqr/database'),
      menu('apqr-form', 'APQR Form', '/apqr/form'),
      menu('apqr-audit', 'Audit Trail', '/apqr/audit'),
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [menu('user-management', 'User Management', '/admin/users')],
  },
]

export function getAllNavMenus(): NavMenuDefinition[] {
  return navigationRegistry.flatMap((group) => group.items)
}

export function getMenuById(menuId: string): NavMenuDefinition | undefined {
  return getAllNavMenus().find((item) => item.id === menuId)
}

export function getMenuByPath(pathname: string): NavMenuDefinition | undefined {
  return getAllNavMenus().find((item) => item.path === pathname)
}

export function toSidebarItems(items: NavMenuDefinition[]): SidebarSubmenuItem[] {
  return items.map(({ id, label, path, hash }) => ({ id, label, path, hash }))
}

export const vrmsSidebarMenu: SidebarSubmenuItem[] = toSidebarItems(
  navigationRegistry.find((group) => group.id === 'vrms')?.items ?? [],
)

const moduleSidebarMenus: SidebarSubmenuItem[] = navigationRegistry
  .filter((group) => group.id !== 'admin')
  .flatMap((group) => toSidebarItems(group.items))

export const vrmsRouteLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/routing': 'Document Routing',
  '/database': 'Database',
  '/audit': 'Audit Trail',
  '/registry': 'Registry',
  '/vmp/masterlist': 'Masterlist Form',
  '/vmp/risk-assessment': 'Risk Assessment',
  '/vmp/timeline': 'Timeline',
  '/vmp/database': 'Database',
  '/vmp/audit': 'Audit Trail',
  '/edoc': 'Dashboard',
  '/edoc/inbox': 'My Inbox',
  '/edoc/my-documents': 'My Documents',
  '/edoc/documents': 'All Documents',
  '/edoc/create': 'Create Document',
  '/edoc/returned': 'Returned Documents',
  '/edoc/completed': 'Completed Documents',
  '/edoc/templates': 'Routing Templates',
  '/edoc/reports': 'Reports',
  '/edoc/audit': 'Audit Trail',
  '/edoc/admin': 'Administration',
  '/apqr': 'Dashboard',
  '/apqr/registry': 'Client Registry',
  '/apqr/scheduler': 'APQR Scheduler',
  '/apqr/database': 'APQR Database',
  '/apqr/form': 'APQR Form',
  '/apqr/audit': 'Audit Trail',
  '/admin/users': 'User Management',
  '/login': 'Sign in',
  '/signup': 'Sign up',
}

export function isVrmsPath(pathname: string): boolean {
  return moduleSidebarMenus.some((item) => item.path === pathname)
}

export function resolveWorkspaceTitle(pathname: string): string {
  const page = vrmsRouteLabels[pathname]
  if (!page) return APP_NAME
  const group = navigationRegistry.find((navGroup) =>
    navGroup.items.some((item) => item.path === pathname),
  )
  if (group && group.id !== 'admin') return `${group.label} / ${page}`
  if (pathname === '/admin/users') return `Administration / ${page}`
  return page
}
