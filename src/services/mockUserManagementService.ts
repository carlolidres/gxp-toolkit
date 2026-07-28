import { mockUsers } from '../data/mockAuth'
import {
  getMockPermissionStore,
  saveMockPermissionStore,
  seedMockUserPermissions,
} from '../data/mockUserPermissions'
import {
  getEdocAccessProfileCompleteness,
  hasAnyEdocMenuAccess,
} from '../lib/edocAccessProfileCompleteness'
import { normalizeUserPermissions } from '../lib/permissions'
import { generateTemporaryPassword } from '../lib/temporaryPassword'
import {
  getMockPasswordResetRequestedAt,
  setMockMustChangePassword,
  setMockPasswordResetRequested,
} from './authService'
import type { UserRole } from '../types/auth'
import type { ManagedUser, UpdateManagedUserInput, UserPermissions } from '../types/permissions'

const MOCK_LAST_TEMP_PASSWORD_KEY = 'gxp-toolkit-last-temp-password'

function toManagedUser(
  user: (typeof mockUsers)[number],
  permissions: UserPermissions,
  active = true,
  documentController = false,
): ManagedUser {
  const normalized = normalizeUserPermissions(permissions, user.role)
  const completeness = getEdocAccessProfileCompleteness({
    organization: user.organization,
    signatureDataUrl: user.signatureDataUrl,
  })
  const hasEdocAccess = hasAnyEdocMenuAccess(normalized)
  return {
    ...user,
    active,
    organization: user.organization?.trim() || null,
    hasSignature: completeness.hasSignature,
    profileComplete: completeness.complete,
    hasEdocAccess,
    edocProfileIncomplete: hasEdocAccess && !completeness.complete,
    passwordResetRequestedAt: getMockPasswordResetRequestedAt(user.email),
    documentController,
    permissions: normalized,
  }
}

export const mockUserManagementService = {
  async listUsers(): Promise<ManagedUser[]> {
    await delay()
    const store = getMockPermissionStore()
    const activeStore = getActiveStore()
    const controllerStore = getControllerStore()
    return mockUsers.map((user) =>
      toManagedUser(
        { ...user, role: activeStore[user.id]?.role ?? user.role },
        normalizeUserPermissions(store[user.id], activeStore[user.id]?.role ?? user.role),
        activeStore[user.id]?.active ?? true,
        Boolean(controllerStore[user.id]),
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
    const controllerStore = getControllerStore()
    const nextRole = input.role ?? activeStore[userId]?.role ?? user.role
    const nextActive = input.active ?? activeStore[userId]?.active ?? true
    const nextController =
      typeof input.documentController === 'boolean'
        ? input.documentController
        : Boolean(controllerStore[userId])

    if (input.permissions) {
      permissionStore[userId] = input.permissions
      saveMockPermissionStore(permissionStore)
    }

    activeStore[userId] = { role: nextRole, active: nextActive }
    saveActiveStore(activeStore)
    controllerStore[userId] = nextController
    saveControllerStore(controllerStore)

    return toManagedUser(
      { ...user, role: nextRole },
      normalizeUserPermissions(permissionStore[userId], nextRole),
      nextActive,
      nextController,
    )
  },

  async resetUserPassword(userId: string): Promise<void> {
    await delay()
    const user = mockUsers.find((candidate) => candidate.id === userId)
    if (!user) throw new Error('User not found.')
    if (!getMockPasswordResetRequestedAt(user.email)) {
      throw new Error('No pending password reset request for this user.')
    }

    const temporaryPassword = generateTemporaryPassword(16)
    // Mock mode: no outbound email — store for local verification / console.
    localStorage.setItem(
      MOCK_LAST_TEMP_PASSWORD_KEY,
      JSON.stringify({ email: user.email, temporaryPassword, at: new Date().toISOString() }),
    )
    console.info(`[mock] Temporary password for ${user.email}: ${temporaryPassword}`)

    setMockMustChangePassword(user.email, true)
    setMockPasswordResetRequested(user.email, null)
  },

  resetStore() {
    seedMockUserPermissions()
    saveActiveStore({})
    saveControllerStore({})
  },
}

const ACTIVE_KEY = 'gxp-toolkit-managed-users'
const CONTROLLER_KEY = 'gxp-toolkit-edoc-document-controllers'

type ActiveRecord = Record<string, { role: UserRole; active: boolean }>
type ControllerRecord = Record<string, boolean>

function getActiveStore(): ActiveRecord {
  const raw = localStorage.getItem(ACTIVE_KEY)
  return raw ? (JSON.parse(raw) as ActiveRecord) : {}
}

function saveActiveStore(store: ActiveRecord) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(store))
}

function getControllerStore(): ControllerRecord {
  const raw = localStorage.getItem(CONTROLLER_KEY)
  return raw ? (JSON.parse(raw) as ControllerRecord) : {}
}

function saveControllerStore(store: ControllerRecord) {
  localStorage.setItem(CONTROLLER_KEY, JSON.stringify(store))
}

function delay(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
