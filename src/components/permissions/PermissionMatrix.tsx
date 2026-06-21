import {
  navigationRegistry,
  PERMISSION_ACTION_LABELS,
  PERMISSION_ACTIONS,
  type PermissionAction,
} from '../../config/navigationRegistry'
import { mergePermissionUpdate } from '../../lib/permissions'
import type { UserPermissions } from '../../types/permissions'

export function PermissionMatrix({
  value,
  onChange,
  readOnly = false,
}: {
  value: UserPermissions
  onChange: (next: UserPermissions) => void
  readOnly?: boolean
}) {
  function toggle(menuId: string, action: PermissionAction, granted: boolean) {
    if (readOnly) return
    onChange(mergePermissionUpdate(value, menuId, action, granted))
  }

  return (
    <div className="permission-matrix">
      {navigationRegistry.map((group) => (
        <section className="permission-matrix-group" key={group.id}>
          <h3>{group.label}</h3>
          <div className="permission-matrix-table-wrap">
            <table className="permission-matrix-table">
              <thead>
                <tr>
                  <th scope="col">Menu</th>
                  {PERMISSION_ACTIONS.map((action) => (
                    <th scope="col" key={action}>
                      {PERMISSION_ACTION_LABELS[action]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.items.map((menu) => (
                  <tr key={menu.id}>
                    <th scope="row">{menu.label}</th>
                    {PERMISSION_ACTIONS.map((action) => {
                      const applicable = menu.actions.includes(action)
                      const checked = Boolean(value[menu.id]?.[action])
                      return (
                        <td key={action} className={applicable ? undefined : 'is-na'}>
                          {applicable ? (
                            <label className="permission-matrix-check">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={readOnly}
                                onChange={(event) => toggle(menu.id, action, event.target.checked)}
                              />
                              <span className="sr-only">
                                {menu.label} {PERMISSION_ACTION_LABELS[action]}
                              </span>
                            </label>
                          ) : (
                            <span className="permission-matrix-na" aria-hidden="true">
                              —
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
