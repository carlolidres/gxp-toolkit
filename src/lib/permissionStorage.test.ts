import { describe, expect, it } from 'vitest'

import { rowsToUserPermissions, userPermissionsToRows } from '../lib/permissionStorage'

describe('permissionStorage', () => {
  it('round-trips permission rows for registry menus', () => {
    const permissions = {
      routing: { view: true, create: true, edit: false, delete: false, approve: true, export: false },
      audit: { view: true, export: true },
    }

    const rows = userPermissionsToRows('p-1', permissions)
    expect(rows.some((row) => row.menu_id === 'routing' && row.permissions.create)).toBe(true)
    expect(rows.find((row) => row.menu_id === 'audit')?.permissions.export).toBe(true)

    const restored = rowsToUserPermissions(rows)
    expect(restored.routing?.approve).toBe(true)
    expect(restored.audit?.view).toBe(true)
  })
})
