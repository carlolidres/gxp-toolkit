import { useMemo, useState } from 'react'

export function usePagination<T>(items: T[], pageSize = 5) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageItems = useMemo(() => items.slice((safePage - 1) * pageSize, safePage * pageSize), [items, pageSize, safePage])
  return { page: safePage, setPage, pageCount, pageItems }
}

