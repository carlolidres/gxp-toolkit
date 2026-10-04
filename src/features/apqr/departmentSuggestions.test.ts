import { afterEach, describe, expect, it } from 'vitest'

import {
  forgetDepartment,
  mergeDepartmentSuggestions,
  readDepartmentSuggestions,
  rememberDepartment,
} from './departmentSuggestions'

const STORAGE_KEY = 'apqr-department-suggestions'
const HIDDEN_KEY = 'apqr-department-hidden'

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(HIDDEN_KEY)
})

describe('departmentSuggestions', () => {
  it('remembers and merges unique department names with recent-first ordering', () => {
    rememberDepartment('Topicals')
    rememberDepartment('Pilot Line')

    expect(readDepartmentSuggestions()).toEqual(['Pilot Line', 'Topicals'])
    expect(mergeDepartmentSuggestions(['Dry', 'Topicals'])).toEqual(['Pilot Line', 'Topicals', 'Dry'])
  })

  it('keeps a forgotten department out of the menu even when a record still has it', () => {
    rememberDepartment('Pilot Line')
    forgetDepartment('Pilot Line')

    expect(mergeDepartmentSuggestions(['Pilot Line', 'Dry'])).toEqual(['Dry'])

    rememberDepartment('Pilot Line')
    expect(mergeDepartmentSuggestions(['Pilot Line'])).toEqual(['Pilot Line'])
  })
})
