import { describe, expect, it } from 'vitest'

import { normalizeUserPermissions, getRoleDefaultPermissions, hasPermission, canViewMenu, filterNavigationGroups, mergePermissionUpdate, applyDocumentControllerPermissions, clearDocumentControllerPermissions, hasDocumentControllerEdocAccess } from '../lib/permissions'
import type { UserPermissions } from '../types/permissions'

describe('permissions', () => {
  it('grants admins every action on every menu', () => {
    const permissions = normalizeUserPermissions({}, 'Admin')
    expect(canViewMenu(permissions, 'routing')).toBe(true)
    expect(hasPermission(permissions, 'routing', 'approve')).toBe(true)
    expect(hasPermission(permissions, 'user-management', 'delete')).toBe(true)
    expect(hasPermission(permissions, 'edoc-all-documents', 'delete')).toBe(true)
  })

  it('limits viewers to view actions', () => {
    const permissions = normalizeUserPermissions({}, 'Viewer')
    expect(hasPermission(permissions, 'routing', 'view')).toBe(true)
    expect(hasPermission(permissions, 'routing', 'create')).toBe(false)
    expect(hasPermission(permissions, 'user-management', 'view')).toBe(false)
    expect(hasPermission(permissions, 'edoc-all-documents', 'view')).toBe(false)
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
    expect(groups.find((group) => group.id === 'edoc')?.items.map((item) => item.id)).toEqual([
      'edoc-dashboard',
      'edoc-inbox',
      'edoc-create',
      'edoc-my-documents',
      'edoc-audit',
    ])
    expect(groups.find((group) => group.id === 'apqr')?.items.map((item) => item.id)).toEqual([
      'apqr-dashboard',
      'apqr-database',
      'apqr-scheduler',
      'apqr-registry',
      'apqr-audit',
    ])
  })

  it('keeps all-documents assignable but hidden from the default sidebar', () => {
    const viewer = getRoleDefaultPermissions('Viewer')
    expect(canViewMenu(viewer, 'edoc-all-documents')).toBe(false)
    const withGrant = mergePermissionUpdate(viewer, 'edoc-all-documents', 'view', true)
    expect(filterNavigationGroups(withGrant).find((group) => group.id === 'edoc')?.items.map((item) => item.id)).toContain(
      'edoc-all-documents',
    )
  })

  it('auto-enables view when granting a non-view action', () => {
    const base: UserPermissions = { routing: { view: false, create: false } }
    const next = mergePermissionUpdate(base, 'routing', 'create', true)
    expect(next.routing?.view).toBe(true)
    expect(next.routing?.create).toBe(true)
  })

  it('applies and clears Document Controller eDoc presets', () => {
    const viewer = getRoleDefaultPermissions('Viewer')
    expect(hasDocumentControllerEdocAccess(viewer)).toBe(false)
    const nominated = applyDocumentControllerPermissions(viewer)
    expect(hasDocumentControllerEdocAccess(nominated)).toBe(true)
    expect(hasPermission(nominated, 'edoc-all-documents', 'view')).toBe(true)
    expect(hasPermission(nominated, 'edoc-all-documents', 'delete')).toBe(false)
    expect(hasPermission(nominated, 'edoc-admin', 'edit')).toBe(true)
    expect(hasPermission(nominated, 'routing', 'view')).toBe(true)
    const cleared = clearDocumentControllerPermissions(nominated, 'Viewer')
    expect(hasDocumentControllerEdocAccess(cleared)).toBe(false)
    expect(hasPermission(cleared, 'edoc-all-documents', 'view')).toBe(false)
  })
})
