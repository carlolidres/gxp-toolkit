import { useEffect, useMemo, useState } from 'react'
import { Button, Spin } from 'antd'
import {
  Info,
  KeyRound,
  Loader2,
  RotateCcw,
  Save,
  Shield,
  UserCheck,
  UserCog,
  Users,
  UserX,
} from 'lucide-react'

import { PermissionMatrix } from '../../components/permissions/PermissionMatrix'
import { VrmsPage } from '../../components/vrms/VrmsPage'
import { useToast } from '../../components/feedback/ToastProvider'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import { getRoleDefaultPermissions, normalizeUserPermissions, permissionsAreEqual } from '../../lib/permissions'
import { userManagementService } from '../../services/userManagementService'
import type { UserRole } from '../../types/auth'
import type { ManagedUser, UserPermissions } from '../../types/permissions'
import { iconSize, iconStroke } from '../../theme/iconSizes'
import './user-management.css'

const roleOptions: UserRole[] = ['Admin', 'Manager', 'Editor', 'Viewer']

const ROLE_BADGE: Record<UserRole, string> = {
  Admin: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800/40 dark:bg-violet-950/30 dark:text-violet-200',
  Manager: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-200',
  Editor: 'border-[color-mix(in_srgb,var(--teal)_25%,var(--border))] bg-[var(--teal-soft)] text-[var(--teal)]',
  Viewer: 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]',
}

export function UserManagementPage() {
  const { user: currentUser } = useAuth()
  const { refreshPermissions } = usePermissions()
  const { notify } = useToast()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftRole, setDraftRole] = useState<UserRole>('Viewer')
  const [draftActive, setDraftActive] = useState(true)
  const [draftPermissions, setDraftPermissions] = useState<UserPermissions>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedId) ?? null,
    [selectedId, users],
  )

  const isDirty = useMemo(() => {
    if (!selectedUser) return false
    const normalized = normalizeUserPermissions(draftPermissions, draftRole)
    return (
      draftRole !== selectedUser.role ||
      draftActive !== selectedUser.active ||
      !permissionsAreEqual(normalized, selectedUser.permissions)
    )
  }, [draftActive, draftPermissions, draftRole, selectedUser])

  useEffect(() => {
    let active = true
    void userManagementService
      .listUsers()
      .then((rows) => {
        if (!active) return
        setUsers(rows)
        setSelectedId((current) => current ?? rows[0]?.id ?? null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedUser) return
    setDraftRole(selectedUser.role)
    setDraftActive(selectedUser.active)
    setDraftPermissions(structuredClone(selectedUser.permissions))
  }, [selectedUser])

  function handleRoleChange(role: UserRole) {
    setDraftRole(role)
    if (role === 'Admin') {
      setDraftPermissions(getRoleDefaultPermissions('Admin'))
      return
    }
    setDraftPermissions((current) => normalizeUserPermissions(current, role))
  }

  async function handleSave() {
    if (!selectedUser) return
    setSaving(true)
    try {
      const updated = await userManagementService.updateUser(selectedUser.id, {
        role: draftRole,
        active: draftActive,
        permissions: normalizeUserPermissions(draftPermissions, draftRole),
      })
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      if (currentUser?.profileId === updated.id || currentUser?.id === updated.id) {
        await refreshPermissions()
      }
      notify('User permissions saved.')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save user permissions.')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    if (!selectedUser) return
    setDraftRole(selectedUser.role)
    setDraftActive(selectedUser.active)
    setDraftPermissions(structuredClone(selectedUser.permissions))
  }

  async function handleResetUserPassword() {
    if (!selectedUser?.passwordResetRequestedAt) return
    setResettingPassword(true)
    try {
      await userManagementService.resetUserPassword(selectedUser.id)
      setUsers((current) =>
        current.map((item) =>
          item.id === selectedUser.id ? { ...item, passwordResetRequestedAt: null } : item,
        ),
      )
      notify(
        `Temporary password issued for ${selectedUser.email}. Check their inbox (or mock console). They must create a new password after sign-in.`,
      )
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to reset user password.')
    } finally {
      setResettingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3" role="status" aria-live="polite">
          <Spin
            tip="Loading users…"
            indicator={<Loader2 className="anticon-spin" size={iconSize.lg} strokeWidth={iconStroke} aria-hidden />}
          />
        </div>
      </div>
    )
  }

  return (
    <VrmsPage
      eyebrow="Administration"
      title="User Management"
      description="Assign sidebar menu access and action permissions. Options update automatically when navigation changes."
      actions={
        selectedUser ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              disabled={!isDirty || saving}
              onClick={handleReset}
              icon={<RotateCcw size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
            >
              Reset
            </Button>
            <Button
              type="primary"
              disabled={!isDirty || saving}
              loading={saving}
              onClick={() => void handleSave()}
              icon={!saving ? <Save size={iconSize.sm} strokeWidth={iconStroke} aria-hidden /> : undefined}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        ) : null
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] lg:items-start">
        <aside className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3.5">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-[var(--teal)]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[var(--app-text)]">Users</h2>
            </div>
            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--muted)]">
              {users.length}
            </span>
          </header>

          <ul
            className="user-mgmt-user-list-scroll m-0 flex max-h-[min(70vh,720px)] list-none flex-col gap-2 overflow-y-auto p-2"
            role="listbox"
            aria-label="Select a user"
          >
            {users.map((item) => {
              const selected = item.id === selectedId
              return (
                <li key={item.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow-ring)] ${
                      selected
                        ? 'border-[color-mix(in_srgb,var(--teal)_35%,var(--border))] bg-[var(--teal-soft)] shadow-sm'
                        : 'border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-muted)]'
                    }`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        selected
                          ? 'bg-[var(--teal)] text-[var(--on-primary)]'
                          : 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      }`}
                      aria-hidden="true"
                    >
                      {item.initials}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-semibold text-[var(--app-text)]">{item.name}</span>
                      <span className="truncate text-xs text-[var(--muted)]">{item.email}</span>
                      <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${ROLE_BADGE[item.role]}`}
                        >
                          {item.role}
                        </span>
                        {!item.active ? (
                          <span className="inline-flex items-center gap-0.5 text-[0.65rem] font-medium text-[var(--danger-text)]">
                            <UserX className="size-3" aria-hidden="true" />
                            Inactive
                          </span>
                        ) : null}
                        {item.passwordResetRequestedAt ? (
                          <span className="inline-flex items-center gap-0.5 text-[0.65rem] font-medium text-amber-700">
                            <KeyRound className="size-3" aria-hidden="true" />
                            Reset requested
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <section className="flex min-w-0 flex-col gap-4">
          {selectedUser ? (
            <>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] sm:p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--teal-soft)] text-sm font-bold text-[var(--teal)]">
                      {selectedUser.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-[var(--app-text)]">{selectedUser.name}</p>
                      <p className="truncate text-sm text-[var(--muted)]">{selectedUser.email}</p>
                    </div>
                  </div>
                  {isDirty ? (
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      Unsaved changes
                    </span>
                  ) : null}
                </div>

                <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="user-role" className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      <UserCog className="size-3.5" aria-hidden="true" />
                      Role
                    </label>
                    <select
                      id="user-role"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--app-text)] shadow-sm transition-colors focus-visible:border-[var(--teal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow-ring)]"
                      value={draftRole}
                      onChange={(event) => handleRoleChange(event.target.value as UserRole)}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {draftActive ? (
                        <UserCheck className="size-3.5" aria-hidden="true" />
                      ) : (
                        <UserX className="size-3.5" aria-hidden="true" />
                      )}
                      Account status
                    </span>
                    <label className="inline-flex min-h-[42px] cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 transition-colors hover:bg-[var(--surface-subtle)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--glow-ring)]">
                      <input
                        id="user-active"
                        type="checkbox"
                        className="user-mgmt-perm-check size-4 rounded border-[var(--border)]"
                        checked={draftActive}
                        onChange={(event) => setDraftActive(event.target.checked)}
                      />
                      <span className="text-sm font-medium text-[var(--app-text)]">
                        {draftActive ? 'Active' : 'Inactive'}
                      </span>
                    </label>
                  </div>

                  {selectedUser.passwordResetRequestedAt ? (
                    <div className="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-1">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        <KeyRound className="size-3.5" aria-hidden="true" />
                        Password reset
                      </span>
                      <button
                        type="button"
                        className="vrms-btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto"
                        disabled={resettingPassword || !selectedUser.active}
                        onClick={() => void handleResetUserPassword()}
                      >
                        {resettingPassword ? (
                          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                        ) : (
                          <KeyRound className="size-4 shrink-0" aria-hidden="true" />
                        )}
                        {resettingPassword ? 'Resetting…' : 'Reset Password'}
                      </button>
                      <p className="text-xs leading-relaxed text-[var(--muted)]">
                        Requested {new Date(selectedUser.passwordResetRequestedAt).toLocaleString()}. Approving emails a
                        random 16-character temporary password and requires a new password after sign-in.
                      </p>
                    </div>
                  ) : null}
                </div>

                <p className="mt-4 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--teal)_20%,var(--border))] bg-[var(--alert-info-bg)] px-4 pt-3.5 pb-0 text-sm text-[var(--muted)]">
                  {draftRole === 'Admin' ? (
                    <>
                      <Shield className="mt-0.5 size-4 shrink-0 text-[var(--teal)]" aria-hidden="true" />
                      <span>
                        Administrators receive full access to every menu and action defined in the navigation registry.
                      </span>
                    </>
                  ) : (
                    <>
                      <Info className="mt-0.5 size-4 shrink-0 text-[var(--teal)]" aria-hidden="true" />
                      <span>
                        Permissions below are derived from the current sidebar menus. Adding or renaming a menu updates
                        these options automatically.
                      </span>
                    </>
                  )}
                </p>
              </div>

              <PermissionMatrix
                value={draftPermissions}
                onChange={setDraftPermissions}
                readOnly={draftRole === 'Admin'}
              />
            </>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-6 py-12 text-center">
              <Users className="size-10 text-[var(--muted)] opacity-60" aria-hidden="true" />
              <p className="text-sm font-medium text-[var(--app-text)]">Select a user to manage permissions</p>
              <p className="max-w-sm text-sm text-[var(--muted)]">
                Choose a user from the list to configure their role, account status, and module permissions.
              </p>
            </div>
          )}
        </section>
      </div>
    </VrmsPage>
  )
}
