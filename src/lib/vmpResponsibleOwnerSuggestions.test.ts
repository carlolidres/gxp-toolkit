import { afterEach, describe, expect, it } from 'vitest'

import {
  forgetResponsibleOwner,
  mergeResponsibleOwnerSuggestions,
  readResponsibleOwnerSuggestions,
  rememberResponsibleOwner,
} from './vmpResponsibleOwnerSuggestions'

describe('vmpResponsibleOwnerSuggestions', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('remembers and merges unique suggestions', () => {
    rememberResponsibleOwner('Validation Team')
    rememberResponsibleOwner('IT Quality')
    const merged = mergeResponsibleOwnerSuggestions(['Engineering Validation', 'Validation Team'])
    expect(merged).toEqual(['IT Quality', 'Validation Team', 'Engineering Validation'])
  })

  it('forgets saved suggestions', () => {
    rememberResponsibleOwner('Validation Team')
    forgetResponsibleOwner('Validation Team')
    expect(readResponsibleOwnerSuggestions()).toEqual([])
    expect(mergeResponsibleOwnerSuggestions()).toEqual([])
  })
})
