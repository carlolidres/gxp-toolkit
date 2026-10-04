import type { CpvAlternateBatchSize, CpvBatchSizeUnit } from './types'

export type { CpvAlternateBatchSize, CpvBatchSizeUnit }
export { CPV_BATCH_SIZE_UNITS } from './types'

export function formatBatchSizeLabel(
  size: string | null | undefined,
  unit: string | null | undefined,
  alternates: CpvAlternateBatchSize[] = [],
): string {
  const commercial = [size?.trim(), unit?.trim()].filter(Boolean).join(' ')
  const extras = (alternates ?? []).map((entry) => `${entry.size} ${entry.unit}`)
  const parts = [commercial, ...extras].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

function parseEntry(size: string, unit: string): CpvAlternateBatchSize | null {
  const trimmed = size.trim()
  if (!trimmed) return null
  const amount = Number(trimmed)
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Batch size must be a number zero or greater.')
  if (unit !== 'Kg' && unit !== 'L') throw new Error('Unit must be Kg or L.')
  return { size: trimmed, unit }
}

export function normalizeBatchSizes(
  commercialSize: string,
  commercialUnit: string,
  alternates: Array<{ size: string; unit: string }>,
): { batch_size: string | null; batch_size_unit: string | null; alternate_batch_sizes: CpvAlternateBatchSize[] } {
  const commercial = parseEntry(commercialSize, commercialUnit)
  return {
    batch_size: commercial?.size ?? null,
    batch_size_unit: commercial?.unit ?? null,
    alternate_batch_sizes: alternates
      .map((entry) => parseEntry(entry.size, entry.unit))
      .filter((entry): entry is CpvAlternateBatchSize => entry != null),
  }
}
