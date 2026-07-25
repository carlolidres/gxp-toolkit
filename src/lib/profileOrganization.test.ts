import { describe, expect, it } from 'vitest'

import {
  findDuplicateOrganization,
  normalizeOrganizationValue,
  removeOrganizationOption,
  upsertOrganizationOption,
  validateOrganizationValue,
} from './profileOrganization'

describe('profileOrganization', () => {
  it('normalizes leading/trailing and internal spaces', () => {
    expect(normalizeOrganizationValue('  Acme   Pharma  ')).toBe('Acme Pharma')
  })

  it('detects case-insensitive duplicates', () => {
    expect(findDuplicateOrganization(' acme pharma ', ['Acme Pharma', 'Other'])).toBe('Acme Pharma')
    expect(findDuplicateOrganization('New Co', ['Acme Pharma'])).toBeNull()
  })

  it('upserts without creating case/whitespace duplicates', () => {
    const next = upsertOrganizationOption('  acme   pharma ', ['Other', 'Acme Pharma'])
    expect(next).toEqual(['Acme Pharma', 'Other'])
  })

  it('adds new normalized values at the front', () => {
    expect(upsertOrganizationOption('  Bio Labs ', ['Acme'])).toEqual(['Bio Labs', 'Acme'])
  })

  it('removes options case-insensitively', () => {
    expect(removeOrganizationOption('ACME', ['Acme', 'Other'])).toEqual(['Other'])
  })

  it('validates max length', () => {
    expect(validateOrganizationValue('Ok')).toBeNull()
    expect(validateOrganizationValue('x'.repeat(121))).toMatch(/120/)
  })
})
