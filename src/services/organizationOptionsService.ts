import {
  findDuplicateOrganization,
  normalizeOrganizationValue,
  removeOrganizationOption,
  upsertOrganizationOption,
} from '../lib/profileOrganization'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

const MOCK_STORAGE_KEY = 'gxp-profile-organization-options'

function readMockOptions(): string[] {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((value): value is string => typeof value === 'string')
      .reduce<string[]>((acc, value) => upsertOrganizationOption(value, acc), [])
  } catch {
    return []
  }
}

function writeMockOptions(options: string[]) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(options))
}

function mapOptionRows(rows: Array<{ value?: string | null }> | null | undefined): string[] {
  if (!rows?.length) return []
  return rows
    .map((row) => normalizeOrganizationValue(row.value ?? ''))
    .filter(Boolean)
    .reduce<string[]>((acc, value) => upsertOrganizationOption(value, acc), [])
    .sort((a, b) => a.localeCompare(b))
}

export const organizationOptionsService = {
  async list(): Promise<string[]> {
    if (!isSupabaseConfigured()) {
      return readMockOptions().sort((a, b) => a.localeCompare(b))
    }

    const client = getSupabaseClient()
    if (!client) return []

    const { data, error } = await client
      .from('profile_organization_options')
      .select('value')
      .order('value', { ascending: true })

    if (error) throw new Error(error.message)
    return mapOptionRows(data as Array<{ value?: string | null }>)
  },

  /** Adds a valid organization when it is new (case/whitespace insensitive). */
  async remember(value: string): Promise<string[]> {
    const normalized = normalizeOrganizationValue(value)
    if (!normalized) return this.list()

    if (!isSupabaseConfigured()) {
      const next = upsertOrganizationOption(normalized, readMockOptions())
      writeMockOptions(next)
      return next.sort((a, b) => a.localeCompare(b))
    }

    const client = getSupabaseClient()
    if (!client) throw new Error('Supabase client is not available.')

    const existing = await this.list()
    const duplicate = findDuplicateOrganization(normalized, existing)
    if (duplicate) return existing

    const { error } = await client.from('profile_organization_options').insert({
      id: `org-${crypto.randomUUID()}`,
      value: normalized,
      created_at: new Date().toISOString(),
    })

    if (error) {
      // Concurrent insert of the same CI key — treat as success and re-list.
      if (error.code === '23505') return this.list()
      throw new Error(error.message)
    }

    return this.list()
  },

  async remove(value: string): Promise<string[]> {
    const normalized = normalizeOrganizationValue(value)
    if (!normalized) return this.list()

    if (!isSupabaseConfigured()) {
      const next = removeOrganizationOption(normalized, readMockOptions())
      writeMockOptions(next)
      return next.sort((a, b) => a.localeCompare(b))
    }

    const client = getSupabaseClient()
    if (!client) throw new Error('Supabase client is not available.')

    const { data, error: listError } = await client
      .from('profile_organization_options')
      .select('id, value')

    if (listError) throw new Error(listError.message)

    const key = normalized.toLowerCase()
    const matches = (data as Array<{ id: string; value: string }> | null)?.filter(
      (row) => normalizeOrganizationValue(row.value).toLowerCase() === key,
    ) ?? []

    if (matches.length === 0) return this.list()

    const { error } = await client
      .from('profile_organization_options')
      .delete()
      .in(
        'id',
        matches.map((row) => row.id),
      )

    if (error) throw new Error(error.message)
    return this.list()
  },
}
