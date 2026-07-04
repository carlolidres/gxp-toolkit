import { afterEach, describe, expect, it } from 'vitest'

import { mergeDepartmentSuggestions, readDepartmentSuggestions, rememberDepartment } from './departmentSuggestions'

const STORAGE_KEY = 'apqr-department-suggestions'

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY)
})

describe('departmentSuggestions', () => {
  it('remembers and merges unique department names with recent-first ordering', () => {
    rememberDepartment('Topicals')
    rememberDepartment('Pilot Line')

    expect(readDepartmentSuggestions()).toEqual(['Pilot Line', 'Topicals'])
    expect(mergeDepartmentSuggestions(['Dry', 'Topicals'])).toEqual(['Pilot Line', 'Topicals', 'Dry'])
  })
})
