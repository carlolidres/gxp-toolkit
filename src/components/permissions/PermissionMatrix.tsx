import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  Eye,
  FileSignature,
  FileText,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  Minus,
  Pencil,
  Plus,
  Route,
  ScrollText,
  Settings,
  Shield,
  Trash2,
  Users,
} from 'lucide-react'

import {
  navigationRegistry,
  PERMISSION_ACTION_LABELS,
  PERMISSION_ACTIONS,
  type PermissionAction,
} from '../../config/navigationRegistry'
import { mergePermissionUpdate } from '../../lib/permissions'
import type { UserPermissions } from '../../types/permissions'

const ACTION_ICONS: Record<PermissionAction, LucideIcon> = {
  view: Eye,
  create: Plus,
  edit: Pencil,
  delete: Trash2,
  approve: CheckCircle2,
  export: Download,
}

const GROUP_ICONS: Record<string, LucideIcon> = {
  vrms: Route,
  vmp: ClipboardList,
  edoc: FileSignature,
  apqr: BarChart3,
  admin: Settings,
}

function menuIcon(menuId: string): LucideIcon {
  if (menuId.includes('dashboard')) return LayoutDashboard
  if (menuId.includes('routing') || menuId.includes('inbox')) return Inbox
  if (menuId.includes('database')) return Database
  if (menuId.includes('audit')) return ScrollText
  if (menuId.includes('registry')) return Users
  if (menuId.includes('form')) return FileText
  if (menuId.includes('scheduler')) return ClipboardList
  if (menuId.includes('admin') || menuId.includes('user-management')) return Shield
  if (menuId.includes('template')) return FolderOpen
  return FileText
}

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
    <div className="flex flex-col gap-4">
      {navigationRegistry.map((group) => {
        const GroupIcon = GROUP_ICONS[group.id] ?? Settings
        return (
          <section
            className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
            key={group.id}
            aria-labelledby={`perm-group-${group.id}`}
          >
            <header className="flex items-center gap-2.5 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 sm:px-5">
              <span
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--teal-soft)] text-[var(--teal)]"
                aria-hidden="true"
              >
                <GroupIcon className="size-4" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h3 id={`perm-group-${group.id}`} className="text-sm font-semibold text-[var(--app-text)]">
                  {group.label}
                </h3>
                {group.tooltip ? (
                  <p className="truncate text-xs text-[var(--muted)]">{group.tooltip}</p>
                ) : null}
              </div>
            </header>

            <div className="user-mgmt-perm-table-wrap overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                    <th
                      scope="col"
                      className="sticky left-0 z-[1] bg-[var(--table-header-bg)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)] sm:px-5"
                    >
                      Menu
                    </th>
                    {PERMISSION_ACTIONS.map((action) => {
                      const ActionIcon = ACTION_ICONS[action]
                      return (
                        <th
                          scope="col"
                          key={action}
                          className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)] sm:px-3"
                        >
                          <span className="inline-flex flex-col items-center gap-1">
                            <ActionIcon className="size-3.5" strokeWidth={2} aria-hidden="true" />
                            <span className="hidden sm:inline">{PERMISSION_ACTION_LABELS[action]}</span>
                            <span className="sr-only sm:hidden">{PERMISSION_ACTION_LABELS[action]}</span>
                          </span>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((menu) => {
                    const MenuIcon = menuIcon(menu.id)
                    return (
                      <tr
                        key={menu.id}
                        className="border-b border-[var(--border)] last:border-b-0 transition-colors hover:bg-[var(--table-row-hover)]"
                      >
                        <th
                          scope="row"
                          className="sticky left-0 z-[1] bg-[var(--surface)] px-4 py-3 text-left font-medium text-[var(--app-text)] group-hover:bg-[var(--table-row-hover)] sm:px-5"
                        >
                          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                            <span
                              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-muted)] text-[var(--muted)]"
                              aria-hidden="true"
                            >
                              <MenuIcon className="size-3.5" strokeWidth={2} />
                            </span>
                            <span>{menu.label}</span>
                          </span>
                        </th>
                        {PERMISSION_ACTIONS.map((action) => {
                          const applicable = menu.actions.includes(action)
                          const checked = Boolean(value[menu.id]?.[action])
                          return (
                            <td
                              key={action}
                              className={`px-2 py-3 text-center sm:px-3 ${
                                applicable ? '' : 'bg-[var(--surface-muted)]'
                              }`}
                            >
                              {applicable ? (
                                <label className="inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors hover:bg-[var(--surface-muted)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--glow-ring)]">
                                  <input
                                    type="checkbox"
                                    className="user-mgmt-perm-check size-4 rounded border-[var(--border)]"
                                    checked={checked}
                                    disabled={readOnly}
                                    onChange={(event) => toggle(menu.id, action, event.target.checked)}
                                  />
                                  <span className="sr-only">
                                    {menu.label} {PERMISSION_ACTION_LABELS[action]}
                                  </span>
                                </label>
                              ) : (
                                <span
                                  className="inline-flex items-center justify-center text-[var(--muted)]"
                                  aria-hidden="true"
                                >
                                  <Minus className="size-3.5 opacity-50" strokeWidth={2} />
                                </span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
