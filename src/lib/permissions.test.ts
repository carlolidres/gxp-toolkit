import { describe, expect, it } from 'vitest'

import { normalizeUserPermissions, getRoleDefaultPermissions, hasPermission, canViewMenu, filterNavigationGroups, mergePermissionUpdate } from '../lib/permissions'
import type { UserPermissions } from '../types/permissions'

describe('permissions', () => {
  it('grants admins every action on every menu', () => {
    const permissions = normalizeUserPermissions({}, 'Admin')
    expect(canViewMenu(permissions, 'routing')).toBe(true)
    expect(hasPermission(permissions, 'routing', 'approve')).toBe(true)
    expect(hasPermission(permissions, 'user-management', 'delete')).toBe(true)
  })

  it('limits viewers to view actions', () => {
    const permissions = normalizeUserPermissions({}, 'Viewer')
    expect(hasPermission(permissions, 'routing', 'view')).toBe(true)
    expect(hasPermission(permissions, 'routing', 'create')).toBe(false)
    expect(hasPermission(permissions, 'user-management', 'view')).toBe(false)
  })

  it('filters navigation groups by view permission', () => {
    const permissions = getRoleDefaultPermissions('Viewer')
    const groups = filterNavigationGroups(permissions)
    expect(groups.some((group) => group.id === 'admin')).toBe(false)
    expect(groups.find((group) => group.id === 'vrms')?.items.length).toBeGreaterThan(0)
    expect(groups.find((group) => group.id === 'vmp')?.items.map((item) => item.id)).toEqual([
      'vmp-masterlist',
      'vmp-risk-assessment',
      'vmp-timeline',
      'vmp-database',
      'vmp-audit',
    ])
  })

  it('auto-enables view when granting a non-view action', () => {
    const base: UserPermissions = { routing: { view: false, create: false } }
    const next = mergePermissionUpdate(base, 'routing', 'create', true)
    expect(next.routing?.view).toBe(true)
    expect(next.routing?.create).toBe(true)
  })

  it('clears non-view actions when view is revoked', () => {
    const base: UserPermissions = {
      routing: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
    }
    const next = mergePermissionUpdate(base, 'routing', 'view', false)
    expect(next.routing?.create).toBe(false)
    expect(next.routing?.approve).toBe(false)
  })
})
