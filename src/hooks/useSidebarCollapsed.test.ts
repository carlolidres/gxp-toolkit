import { beforeEach, describe, expect, it } from 'vitest'

import {
  readSidebarCollapsed,
  SIDEBAR_COLLAPSED_KEY,
  writeSidebarCollapsed,
} from './useSidebarCollapsed'

describe('sidebar collapsed persistence', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('defaults to expanded when unset', () => {
    expect(readSidebarCollapsed()).toBe(false)
  })

  it('round-trips collapsed flag through sessionStorage', () => {
    writeSidebarCollapsed(true)
    expect(sessionStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('1')
    expect(readSidebarCollapsed()).toBe(true)

    writeSidebarCollapsed(false)
    expect(sessionStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('0')
    expect(readSidebarCollapsed()).toBe(false)
  })
})
