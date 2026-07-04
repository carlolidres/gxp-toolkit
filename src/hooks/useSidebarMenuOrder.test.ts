import { describe, expect, it } from 'vitest'

import { mergeMenuOrder, reorderIds } from './useSidebarMenuOrder'

describe('useSidebarMenuOrder helpers', () => {
  it('reorders ids by moving source before target index', () => {
    expect(reorderIds(['vrms', 'vmp', 'edoc', 'admin'], 'admin', 'vmp')).toEqual([
      'vrms',
      'admin',
      'vmp',
      'edoc',
    ])
  })

  it('merges saved order with newly visible groups', () => {
    expect(mergeMenuOrder(['edoc', 'vrms'], ['vrms', 'vmp', 'edoc'])).toEqual([
      'edoc',
      'vrms',
      'vmp',
    ])
  })
})
