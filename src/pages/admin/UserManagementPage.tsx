import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Modal, Spin } from 'antd'
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

import { OrganizationManagePanel } from '../../components/admin/OrganizationManagePanel'
import { UserSelectModal } from '../../components/admin/UserSelectModal'
import { PermissionMatrix } from '../../components/permissions/PermissionMatrix'
import { VrmsPage } from '../../components/vrms/VrmsPage'
import { useToast } from '../../components/feedback/ToastProvider'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import {
  applyDocumentControllerPermissions,
  clearDocumentControllerPermissions,
  getRoleDefaultPermissions,
  normalizeUserPermissions,
  permissionsAreEqual,
} from '../../lib/permissions'
import { hasAnyEdocMenuAccess as hasEdocAccessFromPerms } from '../../lib/edocAccessProfileCompleteness'
import { organizationOptionsService } from '../../services/organizationOptionsService'
import { userManagementService } from '../../services/userManagementService'
import { edocService } from '../../features/edoc/edocService'
import type { UserRole } from '../../types/auth'
import type { ManagedUser, UserPermissions } from '../../types/permissions'
import { iconSize, iconStroke } from '../../theme/iconSizes'
import './user-management.css'

const roleOptions: UserRole[] = ['Admin', 'Manager', 'Editor', 'Viewer']

export function UserManagementPage() {
  const { user: currentUser } = useAuth()
  const { refreshPermissions } = usePermissions()
  const { notify } = useToast()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(true)
  const [orgOptions, setOrgOptions] = useState<string[]>([])
  const [draftRole, setDraftRole] = useState<UserRole>('Viewer')
  const [draftActive, setDraftActive] = useState(true)
  const [draftDocumentController, setDraftDocumentController] = useState(false)
  const [draftPermissions, setDraftPermissions] = useState<UserPermissions>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [missingDcWarnings, setMissingDcWarnings] = useState<
    Array<{ organizationLabel: string; memberCount: number }>
  >([])

  const isAdmin = currentUser?.role === 'Admin'
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
      draftDocumentController !== Boolean(selectedUser.documentController) ||
      !permissionsAreEqual(normalized, selectedUser.permissions)
    )
  }, [draftActive, draftDocumentController, draftPermissions, draftRole, selectedUser])

  const handleOrgOptionsChange = useCallback((options: string[]) => {
    setOrgOptions(options)
  }, [])

  useEffect(() => {
    let active = true
    void userManagementService
      .listUsers()
      .then((rows) => {
        if (!active) return
        setUsers(rows)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    void organizationOptionsService
      .list()
      .then((rows) => {
        if (!active) return
        setOrgOptions(rows)
      })
      .catch(() => {
        /* modal filter can still use empty org list */
      })

    if (currentUser?.role === 'Admin') {
      void edocService
        .listMissingControllerWarnings()
        .then((rows) => {
          if (!active) return
          setMissingDcWarnings(rows)
        })
        .catch(() => {
          if (!active) return
          setMissingDcWarnings([])
        })
    }

    return () => {
      active = false
    }
  }, [currentUser?.role])

  useEffect(() => {
    if (!selectedUser) return
    setDraftRole(selectedUser.role)
    setDraftActive(selectedUser.active)
    setDraftDocumentController(Boolean(selectedUser.documentController))
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

  function handleDocumentControllerChange(next: boolean) {
    setDraftDocumentController(next)
    setDraftPermissions((current) =>
      next
        ? applyDocumentControllerPermissions(current)
        : clearDocumentControllerPermissions(current, draftRole),
    )
  }

  function handleSelectUser(userId: string) {
    setSelectedId(userId)
    setPickerOpen(false)
  }

  async function persistSave() {
    if (!selectedUser) return
    setSaving(true)
    try {
      const permissions = normalizeUserPermissions(draftPermissions, draftRole)
      const grantingEdoc =
        hasEdocAccessFromPerms(permissions) && !hasEdocAccessFromPerms(selectedUser.permissions)
      const updated = await userManagementService.updateUser(selectedUser.id, {
        role: draftRole,
        active: draftActive,
        documentController: draftDocumentController,
        permissions,
      })
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      if (currentUser?.profileId === updated.id || currentUser?.id === updated.id) {
        await refreshPermissions()
      }

      if (grantingEdoc && updated.edocProfileIncomplete) {
        notify(
          'eDocuSign access saved. Profile marked incomplete — organization and/or e-signature still missing.',
        )
      } else if (draftDocumentController) {
        notify('User saved as Document Controller.')
      } else {
        notify('User permissions saved.')
      }

      if (isAdmin) {
        try {
          setMissingDcWarnings(await edocService.listMissingControllerWarnings())
        } catch {
          /* keep prior warnings */
        }
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save user permissions.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!selectedUser) return
    const isSelf =
      selectedUser.id === currentUser?.profileId || selectedUser.id === currentUser?.id
    const enablingSelfDc =
      isSelf && draftDocumentController && !selectedUser.documentController

    if (enablingSelfDc) {
      Modal.confirm({
        title: 'Assign yourself as Document Controller?',
        content:
          'Administrators are not Document Controllers by default. Confirm to assign yourself as Document Controller for your own organization. This change is recorded in the audit trail.',
        okText: 'Confirm self-assignment',
        cancelText: 'Cancel',
        onOk: () => persistSave(),
      })
      return
    }

    await persistSave()
  }

  function handleReset() {
    if (!selectedUser) return
    setDraftRole(selectedUser.role)
    setDraftActive(selectedUser.active)
    setDraftDocumentController(Boolean(selectedUser.documentController))
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
      description="Select a user to open their authorization matrix. Options update automatically when navigation changes."
      actions={
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => setPickerOpen(true)}
            icon={<Users size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
          >
            Select user
          </Button>
          {selectedUser ? (
            <>
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
            </>
          ) : null}
        </div>
      }
    >
      <UserSelectModal
        open={pickerOpen}
        users={users}
        selectedId={selectedId}
        organizations={orgOptions}
        onSelect={handleSelectUser}
        onClose={() => setPickerOpen(false)}
      />

      <div className="flex flex-col gap-5">
        {isAdmin && missingDcWarnings.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            message="Document Controller required"
            description={
              <ul className="m-0 list-disc pl-4">
                {missingDcWarnings.map((row) => (
                  <li key={row.organizationLabel}>
                    Assign at least one Document Controller for <strong>{row.organizationLabel}</strong>{' '}
                    ({row.memberCount} active profile{row.memberCount === 1 ? '' : 's'}). External document
                    submission stays blocked until resolved.
                  </li>
                ))}
              </ul>
            }
          />
        ) : null}
        {isAdmin ? <OrganizationManagePanel onOptionsChange={handleOrgOptionsChange} /> : null}

        {selectedUser ? (
          <section className="flex min-w-0 flex-col gap-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] sm:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--teal-soft)] text-sm font-bold text-[var(--teal)]">
                    {selectedUser.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[var(--app-text)]">{selectedUser.name}</p>
                    <p className="truncate text-sm text-[var(--muted)]">{selectedUser.email}</p>
                    <p className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                      <span>{selectedUser.organization?.trim() || 'No organization'}</span>
                      <span>·</span>
                      <span>{selectedUser.hasSignature ? 'E-signature configured' : 'E-signature missing'}</span>
                      {selectedUser.edocProfileIncomplete ? (
                        <>
                          <span>·</span>
                          <span className="font-semibold text-amber-700">eDoc profile incomplete</span>
                        </>
                      ) : null}
                    </p>
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
                      Granting eDocuSign access without organization or e-signature is allowed; the profile is marked
                      incomplete until Account Settings is completed.
                    </span>
                  </>
                )}
              </p>
            </div>

            <PermissionMatrix
              value={draftPermissions}
              onChange={setDraftPermissions}
              readOnly={draftRole === 'Admin'}
              documentController={draftDocumentController}
              onDocumentControllerChange={handleDocumentControllerChange}
            />
          </section>
        ) : (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-6 py-12 text-center">
            <Users className="size-10 text-[var(--muted)] opacity-60" aria-hidden="true" />
            <p className="text-sm font-medium text-[var(--app-text)]">No user selected</p>
            <p className="max-w-sm text-sm text-[var(--muted)]">
              Open the user picker to choose an account. The authorization matrix loads only after a selection.
            </p>
            <Button type="primary" onClick={() => setPickerOpen(true)}>
              Select user
            </Button>
          </div>
        )}
      </div>
    </VrmsPage>
  )
}
