import { mockUsers } from '../data/mockAuth'
import {
  getMockPermissionStore,
  saveMockPermissionStore,
  seedMockUserPermissions,
} from '../data/mockUserPermissions'
import { normalizeUserPermissions } from '../lib/permissions'
import { setMockMustChangePassword } from './authService'
import type { UserRole } from '../types/auth'
import type { ManagedUser, UpdateManagedUserInput, UserPermissions } from '../types/permissions'

function toManagedUser(
  user: (typeof mockUsers)[number],
  permissions: UserPermissions,
  active = true,
): ManagedUser {
  return {
    ...user,
    active,
    permissions,
  }
}

export const mockUserManagementService = {
  async listUsers(): Promise<ManagedUser[]> {
    await delay()
    const store = getMockPermissionStore()
    const activeStore = getActiveStore()
    return mockUsers.map((user) =>
      toManagedUser(
        { ...user, role: activeStore[user.id]?.role ?? user.role },
        normalizeUserPermissions(store[user.id], activeStore[user.id]?.role ?? user.role),
        activeStore[user.id]?.active ?? true,
      ),
    )
  },

  async getPermissions(userId: string, role: UserRole): Promise<UserPermissions> {
    await delay()
    const store = getMockPermissionStore()
    return normalizeUserPermissions(store[userId], role)
  },

  async updateUser(userId: string, input: UpdateManagedUserInput): Promise<ManagedUser> {
    await delay()
    const user = mockUsers.find((candidate) => candidate.id === userId)
    if (!user) throw new Error('User not found.')

    const permissionStore = getMockPermissionStore()
    const activeStore = getActiveStore()
    const nextRole = input.role ?? activeStore[userId]?.role ?? user.role
    const nextActive = input.active ?? activeStore[userId]?.active ?? true

    if (input.permissions) {
      permissionStore[userId] = input.permissions
      saveMockPermissionStore(permissionStore)
    }

    activeStore[userId] = { role: nextRole, active: nextActive }
    saveActiveStore(activeStore)

    return toManagedUser(
      { ...user, role: nextRole },
      normalizeUserPermissions(permissionStore[userId], nextRole),
      nextActive,
    )
  },

  async resetUserPassword(userId: string): Promise<void> {
    await delay()
    const user = mockUsers.find((candidate) => candidate.id === userId)
    if (!user) throw new Error('User not found.')
    setMockMustChangePassword(user.email, true)
  },

  resetStore() {
    seedMockUserPermissions()
    saveActiveStore({})
  },
}

const ACTIVE_KEY = 'gxp-toolkit-managed-users'

type ActiveRecord = Record<string, { role: UserRole; active: boolean }>

function getActiveStore(): ActiveRecord {
  const raw = localStorage.getItem(ACTIVE_KEY)
  return raw ? (JSON.parse(raw) as ActiveRecord) : {}
}

function saveActiveStore(store: ActiveRecord) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(store))
}

function delay(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
