import { useCallback, useState } from 'react'

export const SIDEBAR_COLLAPSED_KEY = 'gxp-sidebar-collapsed'

export function readSidebarCollapsed(): boolean {
  try {
    return sessionStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  try {
    sessionStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    // ponytail: private mode / quota — in-memory state still works
  }
}

/** Desktop-only collapse persistence (sessionStorage + in-memory). */
export function useSidebarCollapsed() {
  const [isCollapsed, setCollapsedState] = useState(readSidebarCollapsed)

  const setIsCollapsed = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      writeSidebarCollapsed(value)
      return value
    })
  }, [])

  return { isCollapsed, setIsCollapsed }
}
