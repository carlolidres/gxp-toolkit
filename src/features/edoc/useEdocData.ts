import { useCallback, useEffect, useState } from 'react'

import { edocService } from './edocService'
import type {
  EdocAuditEvent,
  EdocDashboardMetrics,
  EdocDocumentListItem,
  EdocInboxTask,
} from './types'

export function useEdocDashboard() {
  return useAsyncData(() => edocService.getDashboard(), [])
}

export function useEdocDocuments(scope: 'my' | 'all' | 'returned' | 'completed' = 'all') {
  return useAsyncData(() => edocService.listDocuments(scope), [scope])
}

export function useEdocInbox() {
  return useAsyncData(() => edocService.listInboxTasks(), [])
}

export function useEdocAudit(documentId?: string) {
  return useAsyncData(() => edocService.listAuditEvents(documentId), [documentId ?? ''])
}

export function useEdocProfiles() {
  return useAsyncData(() => edocService.listProfiles(), [])
}

function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[],
): {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
} {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await loader())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load eDoc data.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}

export type { EdocAuditEvent, EdocDashboardMetrics, EdocDocumentListItem, EdocInboxTask }

