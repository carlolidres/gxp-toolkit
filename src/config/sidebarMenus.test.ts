import { describe, expect, it } from 'vitest'

import type { SidebarSubmenuItem } from './sidebarMenus'
import { isSidebarItemActive, submenuNavLinkEnd } from './sidebarMenus'

const apqrItems: SidebarSubmenuItem[] = [
  { id: 'apqr-dashboard', label: 'Dashboard', path: '/apqr', hash: '' },
  { id: 'apqr-registry', label: 'Client Registry', path: '/apqr/registry', hash: '' },
  { id: 'apqr-scheduler', label: 'APQR Scheduler', path: '/apqr/scheduler', hash: '' },
]

describe('submenuNavLinkEnd', () => {
  it('requires exact match for dashboard paths with child routes', () => {
    expect(submenuNavLinkEnd(apqrItems[0], apqrItems)).toBe(true)
    expect(submenuNavLinkEnd(apqrItems[1], apqrItems)).toBe(false)
  })

  it('requires exact match for VRMS root dashboard', () => {
    const vrmsItems: SidebarSubmenuItem[] = [
      { id: 'dashboard', label: 'Dashboard', path: '/', hash: '' },
      { id: 'routing', label: 'Document Routing', path: '/routing', hash: '' },
    ]
    expect(submenuNavLinkEnd(vrmsItems[0], vrmsItems)).toBe(true)
  })
})

describe('isSidebarItemActive', () => {
  it('activates only the matching APQR submenu item', () => {
    expect(isSidebarItemActive(apqrItems[0], '/apqr', '')).toBe(true)
    expect(isSidebarItemActive(apqrItems[0], '/apqr/registry', '')).toBe(false)
    expect(isSidebarItemActive(apqrItems[1], '/apqr/registry', '')).toBe(true)
  })
})
