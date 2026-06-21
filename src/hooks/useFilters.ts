import { useMemo, useState } from 'react'

export function useFilters<T>(items: T[], fields: Array<keyof T>) {
  const [query, setQuery] = useState('')
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items
    return items.filter((item) => fields.some((field) => String(item[field] ?? '').toLowerCase().includes(normalized)))
  }, [fields, items, query])
  return { query, setQuery, filteredItems }
}

