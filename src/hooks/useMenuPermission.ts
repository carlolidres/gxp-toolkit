import { useMemo } from 'react'

import { usePermissions } from './usePermissions'

export function useMenuPermission(menuId: string) {
  const { can, canViewMenu } = usePermissions()

  return useMemo(
    () => ({
      canView: canViewMenu(menuId),
      canCreate: can('create', menuId),
      canEdit: can('edit', menuId),
      canDelete: can('delete', menuId),
      canApprove: can('approve', menuId),
      canExport: can('export', menuId),
    }),
    [can, canViewMenu, menuId],
  )
}
