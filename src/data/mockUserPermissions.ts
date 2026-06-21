import { mockUsers } from './mockAuth'
import { getRoleDefaultPermissions } from '../lib/permissions'
import type { UserPermissions } from '../types/permissions'

const PERMISSIONS_KEY = 'gxp-toolkit-managed-permissions'

type StoredPermissions = Record<string, UserPermissions>

function readStore(): StoredPermissions {
  const raw = localStorage.getItem(PERMISSIONS_KEY)
  return raw ? (JSON.parse(raw) as StoredPermissions) : {}
}

function writeStore(store: StoredPermissions) {
  localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(store))
}

export function seedMockUserPermissions(): StoredPermissions {
  const store: StoredPermissions = {}
  for (const user of mockUsers) {
    store[user.id] = getRoleDefaultPermissions(user.role)
  }
  writeStore(store)
  return store
}

export function getMockPermissionStore(): StoredPermissions {
  const store = readStore()
  if (!Object.keys(store).length) return seedMockUserPermissions()
  return store
}

export function saveMockPermissionStore(store: StoredPermissions) {
  writeStore(store)
}

export function clearMockPermissionStore() {
  localStorage.removeItem(PERMISSIONS_KEY)
}
