export interface VmpQcInstrument {
  id: string
  instrumentName: string
  displayOrder: number
  isActive: boolean
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export function createEmptyQcInstrument(actor: string, displayOrder = 0): VmpQcInstrument {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    instrumentName: '',
    displayOrder,
    isActive: true,
    createdAt: now,
    createdBy: actor,
    updatedAt: now,
    updatedBy: actor,
  }
}

export function normalizeInstrumentName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function hasPopulatedInstruments(instruments: readonly VmpQcInstrument[]): boolean {
  return instruments.some((row) => normalizeInstrumentName(row.instrumentName).length > 0)
}

export function findDuplicateInstrumentName(
  name: string,
  instruments: readonly VmpQcInstrument[],
  excludeId?: string,
): string | null {
  const normalized = normalizeInstrumentName(name).toLowerCase()
  if (!normalized) return null
  const match = instruments.find(
    (row) =>
      row.isActive &&
      row.id !== excludeId &&
      normalizeInstrumentName(row.instrumentName).toLowerCase() === normalized,
  )
  return match ? match.instrumentName : null
}

export function validateQcInstruments(instruments: readonly VmpQcInstrument[]): string | null {
  const active = instruments.filter((row) => row.isActive)
  const names = active.map((row) => normalizeInstrumentName(row.instrumentName))

  if (names.length === 0 || names.every((name) => !name)) {
    return 'At least one Associated QC Instrument is required.'
  }

  for (const name of names) {
    if (!name) {
      return 'Instrument Name / Identifier cannot be blank.'
    }
  }

  const seen = new Set<string>()
  for (const name of names) {
    const key = name.toLowerCase()
    if (seen.has(key)) {
      return 'Duplicate instrument entries are not allowed.'
    }
    seen.add(key)
  }

  return null
}

export function sanitizeInstrumentsForSave(
  instruments: readonly VmpQcInstrument[],
  actor: string,
): VmpQcInstrument[] {
  const now = new Date().toISOString()
  return instruments
    .filter((row) => row.isActive && normalizeInstrumentName(row.instrumentName))
    .map((row, index) => ({
      ...row,
      instrumentName: normalizeInstrumentName(row.instrumentName),
      displayOrder: index,
      updatedAt: now,
      updatedBy: actor,
    }))
}

export function instrumentsChanged(
  before: readonly VmpQcInstrument[],
  after: readonly VmpQcInstrument[],
): boolean {
  const serialize = (rows: readonly VmpQcInstrument[]) =>
    rows
      .filter((row) => row.isActive)
      .map((row) => normalizeInstrumentName(row.instrumentName).toLowerCase())
      .sort()
      .join('|')
  return serialize(before) !== serialize(after)
}

export function formatInstrumentList(instruments: readonly VmpQcInstrument[]): string {
  return instruments
    .filter((row) => row.isActive)
    .map((row) => normalizeInstrumentName(row.instrumentName))
    .filter(Boolean)
    .join(', ')
}
