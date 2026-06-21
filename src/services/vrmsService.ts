import { isSupabaseConfigured } from '../lib/supabase'
import { authService } from './authService'
import { mockVrmsService } from './mockVrmsService'
import { supabaseVrmsService } from './supabaseVrmsService'
import type { VrmsRepository } from './vrmsRepository'

export function getVrmsService(): VrmsRepository {
  return isSupabaseConfigured() ? supabaseVrmsService : mockVrmsService
}

/** Email for VRMS audit fields — falls back to demo user in mock-only mode. */
export function resolveVrmsUserEmail(): string {
  return authService.getCurrentUser()?.email ?? 'carlolidres@gmail.com'
}

export { mockVrmsService, supabaseVrmsService }
export type { VrmsRepository } from './vrmsRepository'
