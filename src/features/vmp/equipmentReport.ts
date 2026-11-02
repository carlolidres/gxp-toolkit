import { displayMasterlistDate, parseMasterlistDate, type EquipmentRecord } from './equipmentMasterlist'
import type { EquipmentWorkbook } from './equipmentWorkbook'

const STORAGE_KEY = 'gxp.vmp.equipment-report.v1'

export type Rating = 1 | 2 | 3
export type Moc = 'SS304' | 'SS316' | 'SS316L'

export type OperatingParameter = {
  id: string
  name: string
  unit: string
  min: string
  max: string
}

export type ContactPart = {
  id: string
  name: string
  moc: Moc | ''
}

export type CleanPart = {
  id: string
  name: string
  moc: Moc | ''
  htc: Rating | null
  htcJustification: string
  physical: Rating | null
  disassembly: Rating | null
  visual: Rating | null
  cleaning: Rating | null
  sampling: Rating | null
}

export type EquipmentReportDetails = {
  dateInstalled: string
  loadingCapacity: string
  parameters: OperatingParameter[]
  contactParts: ContactPart[]
  surfaceArea: string
  parts: CleanPart[]
  pecsp: string
}

export const MOC_OPTIONS: Moc[] = ['SS304', 'SS316', 'SS316L']

export const HTC_CRITERIA = [
  ['1', 'Low', 'Smooth, accessible surfaces with minimal residue-retention features and demonstrated effective cleaning.'],
  ['2', 'Medium', 'Minor recesses, joints, or limited access that require additional cleaning attention.'],
  ['3', 'High', 'Complex geometry, concealed surfaces, dead spaces, or documented difficulty removing residues.'],
] as const

export const HTR_CRITERIA = [
  ['physical', 'Physical Accessibility', 'Easily reached by hand or cleaning tools', 'Requires extended or specialized tools', 'Cannot be reached directly using routine cleaning tools'],
  ['disassembly', 'Disassembly Requirement', 'No disassembly required', 'Partial disassembly required', 'Extensive disassembly or specialized intervention required'],
  ['visual', 'Visual Accessibility', 'Entire surface clearly visible', 'Partially obstructed; mirror or lighting required', 'Concealed or cannot be inspected directly'],
  ['cleaning', 'Cleaning Access / Coverage', 'Cleaning agents and mechanical action readily reach the surface', 'Cleaning access is restricted or requires special positioning', 'Cleaning coverage cannot be assured without additional measures'],
  ['sampling', 'Sampling Accessibility', 'Easily accessible for swabbing', 'Requires special swabbing tools or positioning', 'Direct swabbing is not feasible under the normal equipment configuration'],
] as const

const emptyDetails = (): EquipmentReportDetails => ({
  dateInstalled: '',
  loadingCapacity: '',
  parameters: [],
  contactParts: [],
  surfaceArea: '',
  parts: [],
  pecsp: '',
})

export function equipmentReportKey(sheet: string, record: Pick<EquipmentRecord, 'department' | 'ilTag' | 'equipment'>): string {
  return [sheet, record.department, record.ilTag, record.equipment].join('\u001f')
}

function blankPart(partial: Partial<CleanPart> = {}): CleanPart {
  return {
    id: partial.id ?? '',
    name: partial.name ?? '',
    moc: partial.moc ?? '',
    htc: partial.htc ?? null,
    htcJustification: partial.htcJustification ?? '',
    physical: partial.physical ?? null,
    disassembly: partial.disassembly ?? null,
    visual: partial.visual ?? null,
    cleaning: partial.cleaning ?? null,
    sampling: partial.sampling ?? null,
  }
}

function normalizeDetails(details: Partial<EquipmentReportDetails> | undefined): EquipmentReportDetails {
  const base = { ...emptyDetails(), ...(details ?? {}) }
  const stored = (base.parts ?? []).map((part) => blankPart(part))
  const carried = stored.length ? stored : (base.contactParts ?? []).map((part) => blankPart(part))
  return { ...base, parts: carried, contactParts: carried.map((part) => ({ id: part.id, name: part.name, moc: part.moc })) }
}

export function loadEquipmentReport(key: string): EquipmentReportDetails {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) as Record<string, EquipmentReportDetails> : {}
    const legacyKey = key.startsWith('Main Equipment\u001f')
      ? key.replace('Main Equipment\u001f', 'All Departments\u001f')
      : key.startsWith('Auxiliary\u001f')
        ? key.replace('Auxiliary\u001f', 'Auxilliary\u001f')
        : ''
    return normalizeDetails(parsed[key] ?? (legacyKey ? parsed[legacyKey] : undefined))
  } catch {
    return emptyDetails()
  }
}

export function equipmentProfileLabel(equipment: string, ilTag: string): string {
  const name = equipment.trim()
  const tag = ilTag.trim()
  return tag ? `${name} (${tag})` : name
}

export function equipmentProductUsers(equipment: string, ilTag: string, names = new Map<string, string>()): { productCode: string; productName: string; processes: string }[] {
  const label = equipmentProfileLabel(equipment, ilTag).toLowerCase()
  const nameOnly = equipment.trim().toLowerCase()
  if (!nameOnly) return []
  let stored: Record<string, { sheets?: { name?: string; cells?: Record<string, string> }[] }> = {}
  try {
    stored = JSON.parse(localStorage.getItem('gxp.cpv.product-profile.v1') ?? '{}') as typeof stored
  } catch {
    return []
  }
  const found: { productCode: string; productName: string; processes: string }[] = []
  for (const [key, workbook] of Object.entries(stored)) {
    if (!key.endsWith(':equipment') || !workbook?.sheets) continue
    const productCode = key.slice(0, -':equipment'.length).trim()
    const processes = new Set<string>()
    for (const sheet of workbook.sheets) {
      for (const value of Object.values(sheet.cells ?? {})) {
        const text = String(value ?? '').trim().toLowerCase()
        if (text === label || text === nameOnly) processes.add(sheet.name?.trim() || 'Equipment')
      }
    }
    if (!processes.size) continue
    found.push({
      productCode,
      productName: names.get(productCode.toUpperCase()) ?? '',
      processes: [...processes].join(', '),
    })
  }
  return found.sort((left, right) => left.productCode.localeCompare(right.productCode))
}

export function saveEquipmentReport(key: string, details: EquipmentReportDetails): void {
  const raw = localStorage.getItem(STORAGE_KEY)
  const parsed = raw ? JSON.parse(raw) as Record<string, EquipmentReportDetails> : {}
  parsed[key] = details
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
}

export function equipmentAgeYears(installed: string, now = new Date()): string {
  const parsed = parseMasterlistDate(installed)
  if (!parsed) return ''
  const [year, month, day] = parsed.iso.split('-').map(Number)
  let years = now.getFullYear() - year
  const monthDelta = now.getMonth() - (month - 1)
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < day)) years -= 1
  if (years <= 0) return 'Less than 1 year'
  return years === 1 ? '1 year' : `${years} years`
}

export function ratingLabel(rating: Rating | null): string {
  if (rating === 1) return 'Low'
  if (rating === 2) return 'Medium'
  if (rating === 3) return 'High'
  return 'Not Assessed'
}

export function htrAssessment(part: CleanPart): { score: number | null; rating: Rating | null } {
  const scores = [part.physical, part.disassembly, part.visual, part.cleaning, part.sampling]
  if (scores.some((score) => score == null)) return { score: null, rating: null }
  const score = scores.reduce((total, value) => total + (value ?? 0), 0)
  if (part.physical === 3 || part.cleaning === 3) return { score, rating: 3 }
  if (score <= 7) return { score, rating: 1 }
  if (score <= 11) return { score, rating: 2 }
  return { score, rating: 3 }
}

export function cleanabilityRating(part: CleanPart): Rating | null {
  const htr = htrAssessment(part).rating
  if (part.htc == null || !part.htcJustification.trim() || htr == null) return null
  return Math.max(part.htc, htr) as Rating
}

export function overallCleanability(parts: CleanPart[]): Rating | null {
  const ratings = parts.map(cleanabilityRating).filter((rating): rating is Rating => rating != null)
  if (!parts.length || ratings.length !== parts.length) return null
  return Math.max(...ratings) as Rating
}

export function findEquipmentRecord(workbook: EquipmentWorkbook, sheetName: string, department: string, no: string): EquipmentRecord | null {
  const sheet = workbook.sheets.find((item) => item.name === sheetName || (sheetName === 'All Departments' && item.name === 'Main Equipment') || (sheetName === 'Auxilliary' && item.name === 'Auxiliary') || (sheetName === 'Main Equipment' && item.name === 'All Departments') || (sheetName === 'Auxiliary' && item.name === 'Auxilliary'))
  if (!sheet) return null
  for (let row = 0; row < sheet.rowCount; row += 1) {
    const equipment = sheet.cells[`${row}:1`]?.trim() ?? ''
    const number = sheet.cells[`${row}:0`]?.trim() ?? ''
    if (!equipment || number !== no) continue
    let heading = ''
    for (let index = row; index >= 0; index -= 1) {
      const head = sheet.cells[`${index}:0`]?.trim() ?? ''
      const name = sheet.cells[`${index}:1`]?.trim() ?? ''
      if (head && head !== 'No.' && !name) {
        heading = head
        break
      }
    }
    if (heading !== department) continue
    return {
      department: heading,
      equipment,
      ilTag: sheet.cells[`${row}:2`] ?? '',
      section: sheet.cells[`${row}:3`] ?? '',
      protocol: sheet.cells[`${row}:4`] ?? '',
      report: sheet.cells[`${row}:5`] ?? '',
      approval: displayMasterlistDate(sheet.cells[`${row}:6`] ?? ''),
      nextReview: displayMasterlistDate(sheet.cells[`${row}:7`] ?? ''),
      sourceDepartment: heading,
      sourceNo: number,
    }
  }
  return null
}

export function newReportId(): string {
  return crypto.randomUUID()
}
