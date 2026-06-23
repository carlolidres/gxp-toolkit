import { isSupabaseConfigured } from '../lib/supabase'
import { mockUserManagementService } from './mockUserManagementService'
import { supabaseUserManagementService } from './supabaseUserManagementService'
import type { UserRole } from '../types/auth'
import type { ManagedUser, UpdateManagedUserInput, UserPermissions } from '../types/permissions'

export interface UserManagementService {
  listUsers(): Promise<ManagedUser[]>
  getPermissions(userId: string, role: UserRole): Promise<UserPermissions>
  updateUser(userId: string, input: UpdateManagedUserInput): Promise<ManagedUser>
  resetUserPassword(userId: string): Promise<void>
}

function createUserManagementService(): UserManagementService {
  return isSupabaseConfigured() ? supabaseUserManagementService : mockUserManagementService
}

export const userManagementService: UserManagementService = createUserManagementService()

export function usesLiveUserManagement(): boolean {
  return isSupabaseConfigured()
}

export { mockUserManagementService, supabaseUserManagementService }
