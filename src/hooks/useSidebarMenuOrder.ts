import { useEffect, useMemo, useState } from 'react'

import type { NavGroupDefinition } from '../config/appNavigation'

const STORAGE_KEY = 'gxp-sidebar-menu-order'

export function reorderIds(order: string[], sourceId: string, targetId: string): string[] {
  const from = order.indexOf(sourceId)
  const to = order.indexOf(targetId)
  if (from === -1 || to === -1 || from === to) return order
  const next = [...order]
  next.splice(from, 1)
  next.splice(to, 0, sourceId)
  return next
}

export function mergeMenuOrder(saved: string[], currentIds: string[]): string[] {
  const filtered = saved.filter((id) => currentIds.includes(id))
  const missing = currentIds.filter((id) => !filtered.includes(id))
  return [...filtered, ...missing]
}

function loadOrder(currentIds: string[]): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return currentIds
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) return currentIds
    return mergeMenuOrder(parsed, currentIds)
  } catch {
    return currentIds
  }
}

function sortGroups(groups: NavGroupDefinition[], order: string[]): NavGroupDefinition[] {
  const byId = new Map(groups.map((group) => [group.id, group]))
  return order.map((id) => byId.get(id)).filter((group): group is NavGroupDefinition => group !== undefined)
}

export function useSidebarMenuOrder(groups: NavGroupDefinition[]) {
  const groupIds = useMemo(() => groups.map((group) => group.id), [groups])
  const [order, setOrder] = useState<string[]>(() => loadOrder(groupIds))

  useEffect(() => {
    setOrder((prev) => mergeMenuOrder(prev, groupIds))
  }, [groupIds])

  const orderedGroups = useMemo(() => sortGroups(groups, order), [groups, order])

  function moveGroup(sourceId: string, targetId: string) {
    setOrder((prev) => {
      const next = reorderIds(prev, sourceId, targetId)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return { orderedGroups, moveGroup }
}
