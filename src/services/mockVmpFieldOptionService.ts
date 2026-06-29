import {
  buildUserFieldOption,
  type CreateUserOptionInput,
  type VmpFieldOption,
} from '../lib/vmpFieldOptions'

let store: VmpFieldOption[] = []

export interface VmpFieldOptionRepository {
  listOptions(): Promise<VmpFieldOption[]>
  addUserOption(input: CreateUserOptionInput): Promise<VmpFieldOption>
  updateOption(
    id: string,
    patch: Partial<Pick<VmpFieldOption, 'displayValue' | 'displayOrder' | 'isActive'>>,
    actor: string,
  ): Promise<VmpFieldOption>
}

export const mockVmpFieldOptionService: VmpFieldOptionRepository = {
  async listOptions() {
    return structuredClone(store)
  },

  async addUserOption(input) {
    const existing = await this.listOptions()
    const created = buildUserFieldOption(input, existing)
    store = [...store, created]
    return structuredClone(created)
  },

  async updateOption(id, patch, actor) {
    const index = store.findIndex((row) => row.id === id)
    if (index < 0) throw new Error('Option not found.')
    const now = new Date().toISOString()
    const updated: VmpFieldOption = {
      ...store[index],
      ...patch,
      displayValue: patch.displayValue?.trim() ?? store[index].displayValue,
      normalizedValue: patch.displayValue
        ? patch.displayValue.trim().toLowerCase().replace(/\s+/g, ' ')
        : store[index].normalizedValue,
      updatedAt: now,
      updatedBy: actor,
    }
    store[index] = updated
    return structuredClone(updated)
  },
}

export function resetMockVmpFieldOptionStore(options: VmpFieldOption[] = []) {
  store = structuredClone(options)
}
