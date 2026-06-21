import { useEffect, useMemo, useState } from 'react'

import { PermissionMatrix } from '../../components/permissions/PermissionMatrix'
import { VrmsPage } from '../../components/vrms/VrmsPage'
import { useToast } from '../../components/feedback/ToastProvider'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import { getRoleDefaultPermissions, normalizeUserPermissions, permissionsAreEqual } from '../../lib/permissions'
import { userManagementService } from '../../services/userManagementService'
import type { UserRole } from '../../types/auth'
import type { ManagedUser, UserPermissions } from '../../types/permissions'

const roleOptions: UserRole[] = ['Admin', 'Manager', 'Editor', 'Viewer']

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

  if (loading) {
    return (
      <div className="page">
        <div className="vrms-loading">Loading users…</div>
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
          <div className="user-mgmt-actions">
            <button type="button" className="vrms-btn-secondary" disabled={!isDirty || saving} onClick={handleReset}>
              Reset
            </button>
            <button type="button" className="vrms-btn-primary" disabled={!isDirty || saving} onClick={() => void handleSave()}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        ) : null
      }
    >
      <div className="user-mgmt-layout">
        <aside className="user-mgmt-list vrms-panel">
          <h2>Users</h2>
          <ul className="user-mgmt-user-list">
            {users.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === selectedId ? 'user-mgmt-user active' : 'user-mgmt-user'}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="user-mgmt-user-avatar">{item.initials}</span>
                  <span className="user-mgmt-user-meta">
                    <strong>{item.name}</strong>
                    <span>{item.email}</span>
                    <span>
                      {item.role}
                      {!item.active ? ' · Inactive' : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="user-mgmt-editor">
          {selectedUser ? (
            <>
              <div className="vrms-panel user-mgmt-summary">
                <div className="user-mgmt-summary-grid">
                  <div>
                    <label htmlFor="user-role">Role</label>
                    <select
                      id="user-role"
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
                  <div className="user-mgmt-active">
                    <label htmlFor="user-active">Account status</label>
                    <label className="permission-matrix-check user-mgmt-active-toggle">
                      <input
                        id="user-active"
                        type="checkbox"
                        checked={draftActive}
                        onChange={(event) => setDraftActive(event.target.checked)}
                      />
                      <span>{draftActive ? 'Active' : 'Inactive'}</span>
                    </label>
                  </div>
                </div>
                {draftRole === 'Admin' ? (
                  <p className="user-mgmt-note">
                    Administrators receive full access to every menu and action defined in the navigation registry.
                  </p>
                ) : (
                  <p className="user-mgmt-note">
                    Permissions below are derived from the current sidebar menus. Adding or renaming a menu updates these options automatically.
                  </p>
                )}
              </div>

              <PermissionMatrix
                value={draftPermissions}
                onChange={setDraftPermissions}
                readOnly={draftRole === 'Admin'}
              />
            </>
          ) : (
            <div className="vrms-panel">
              <p className="vrms-muted">Select a user to manage permissions.</p>
            </div>
          )}
        </section>
      </div>
    </VrmsPage>
  )
}
