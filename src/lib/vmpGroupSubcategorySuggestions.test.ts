import { afterEach, describe, expect, it } from 'vitest'

import {
  buildGroupSuggestionScopeKey,
  forgetGroupSubcategory,
  mergeGroupSubcategorySuggestions,
  readGroupSubcategorySuggestions,
  rememberGroupSubcategory,
} from './vmpGroupSubcategorySuggestions'

describe('vmpGroupSubcategorySuggestions', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('scopes equipment suggestions by department', () => {
    const scopeA = { validationArea: 'Equipment', department: 'QC Plant 1' }
    const scopeB = { validationArea: 'Equipment', department: 'QC Plant 2' }

    rememberGroupSubcategory(scopeA, 'HPLC Systems')
    rememberGroupSubcategory(scopeB, 'GC Systems')

    expect(readGroupSubcategorySuggestions(scopeA)).toEqual(['HPLC Systems'])
    expect(readGroupSubcategorySuggestions(scopeB)).toEqual(['GC Systems'])
    expect(buildGroupSuggestionScopeKey(scopeA)).toBe('Equipment::QC Plant 1')
  })

  it('remembers and merges unique suggestions for a validation area', () => {
    const scope = { validationArea: 'Utilities' }
    rememberGroupSubcategory(scope, 'WFI System')
    rememberGroupSubcategory(scope, 'Purified Water System')

    const merged = mergeGroupSubcategorySuggestions(scope, ['Purified Water System'], ['Clean Steam'])
    expect(merged).toEqual(['Purified Water System', 'WFI System', 'Clean Steam'])
  })

  it('forgets saved suggestions without affecting built-in values', () => {
    const scope = { validationArea: 'Utilities' }
    rememberGroupSubcategory(scope, 'WFI System')
    forgetGroupSubcategory(scope, 'WFI System')

    expect(readGroupSubcategorySuggestions(scope)).toEqual([])
    expect(mergeGroupSubcategorySuggestions(scope, ['Purified Water System'])).toEqual(['Purified Water System'])
  })
})
