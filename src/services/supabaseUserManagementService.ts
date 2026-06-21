import { getSupabaseClient } from '../lib/supabase'
import { initialsFromName, mapUserRoleToProfileRole, mapVrmsRoleToUserRole } from '../lib/authMapping'
import { normalizeUserPermissions } from '../lib/permissions'
import { rowsToUserPermissions, userPermissionsToRows } from '../lib/permissionStorage'
import type { UserRole } from '../types/auth'
import type { ManagedUser, UpdateManagedUserInput, UserPermissions } from '../types/permissions'

interface ProfileRow {
  id: string
  email: string
  display_name: string
  role: string
  active: boolean
  auth_user_id: string | null
}

function requireClient() {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
  return client
}

function toManagedUser(profile: ProfileRow, permissions: UserPermissions): ManagedUser {
  const role = mapVrmsRoleToUserRole(profile.role)
  return {
    id: profile.id,
    name: profile.display_name,
    email: profile.email,
    role,
    initials: initialsFromName(profile.display_name, profile.email),
    active: profile.active,
    permissions: normalizeUserPermissions(permissions, role),
  }
}

async function resolveProfileId(userRef: string): Promise<string> {
  if (userRef.startsWith('p-')) return userRef

  const client = requireClient()
  const { data: profileId, error: rpcError } = await client.rpc('current_profile_id')
  if (!rpcError && profileId) return profileId as string

  const { data, error } = await client
    .from('profiles')
    .select('id')
    .or(`auth_user_id.eq.${userRef},id.eq.${userRef}`)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data?.id) throw new Error('Profile not found.')
  return data.id
}

async function loadPermissionRows(profileId: string) {
  const client = requireClient()
  const { data, error } = await client
    .from('user_menu_permissions')
    .select('menu_id, permissions')
    .eq('user_id', profileId)

  if (error) throw new Error(error.message)
  return data ?? []
}

async function loadProfile(profileId: string): Promise<ProfileRow> {
  const client = requireClient()
  const { data, error } = await client.rpc('get_profile_by_id', { target_id: profileId })

  if (!error && data) {
    const row = Array.isArray(data) ? data[0] : data
    if (row) return row as ProfileRow
  }

  const { data: fallback, error: fallbackError } = await client
    .from('profiles')
    .select('id, email, display_name, role, active, auth_user_id')
    .eq('id', profileId)
    .maybeSingle()

  if (fallbackError) throw new Error(fallbackError.message)
  if (!fallback) throw new Error('Profile not found.')
  return fallback as ProfileRow
}

export const supabaseUserManagementService = {
  async listUsers(): Promise<ManagedUser[]> {
    const client = requireClient()
    const { data: profiles, error } = await client
      .from('profiles')
      .select('id, email, display_name, role, active, auth_user_id')
      .order('display_name', { ascending: true })

    if (error) throw new Error(error.message)

    const rows = (profiles ?? []) as ProfileRow[]
    if (!rows.length) return []

    const profileIds = rows.map((row) => row.id)
    const { data: permissionRows, error: permissionError } = await client
      .from('user_menu_permissions')
      .select('user_id, menu_id, permissions')
      .in('user_id', profileIds)

    if (permissionError) throw new Error(permissionError.message)

    const permissionsByUser = new Map<string, UserPermissions>()
    for (const row of permissionRows ?? []) {
      const current = permissionsByUser.get(row.user_id) ?? {}
      current[row.menu_id] = (row.permissions ?? {}) as UserPermissions[string]
      permissionsByUser.set(row.user_id, current)
    }

    return rows.map((profile) =>
      toManagedUser(profile, permissionsByUser.get(profile.id) ?? {}),
    )
  },

  async getPermissions(userRef: string, role: UserRole): Promise<UserPermissions> {
    const profileId = await resolveProfileId(userRef)
    const profile = await loadProfile(profileId)
    if (!profile.active) {
      return normalizeUserPermissions({}, role)
    }

    const rows = await loadPermissionRows(profileId)
    const stored = rowsToUserPermissions(rows)
    return normalizeUserPermissions(stored, role)
  },

  async updateUser(userRef: string, input: UpdateManagedUserInput): Promise<ManagedUser> {
    const profileId = await resolveProfileId(userRef)
    const client = requireClient()
    const current = await loadProfile(profileId)

    const nextRole = input.role ?? mapVrmsRoleToUserRole(current.role)
    const nextActive = input.active ?? current.active
    const profileRole = mapUserRoleToProfileRole(nextRole)

    const { error: profileError } = await client
      .from('profiles')
      .update({
        role: profileRole,
        active: nextActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)

    if (profileError) throw new Error(profileError.message)

    if (input.permissions) {
      const normalized = normalizeUserPermissions(input.permissions, nextRole)
      const rows = userPermissionsToRows(profileId, normalized)
      const { error: permissionError } = await client
        .from('user_menu_permissions')
        .upsert(rows, { onConflict: 'user_id,menu_id' })

      if (permissionError) throw new Error(permissionError.message)
    }

    const updatedProfile: ProfileRow = {
      ...current,
      role: profileRole,
      active: nextActive,
    }

    const rows = await loadPermissionRows(profileId)
    return toManagedUser(updatedProfile, rowsToUserPermissions(rows))
  },
}
