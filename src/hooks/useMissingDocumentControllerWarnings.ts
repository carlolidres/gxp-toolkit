import { useCallback, useEffect, useState } from 'react'

import { edocService } from '../features/edoc/edocService'
import { useAuth } from './useAuth'

/** Admin-only: organizations with active profiles but no Document Controller. */
export function useMissingDocumentControllerWarnings(enabled: boolean) {
  const { user } = useAuth()
  const [labels, setLabels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled || user?.role !== 'Admin') {
      setLabels([])
      return
    }
    setLoading(true)
    try {
      const rows = await edocService.listMissingControllerWarnings()
      setLabels(rows.map((row) => row.organizationLabel))
    } catch {
      setLabels([])
    } finally {
      setLoading(false)
    }
  }, [enabled, user?.role, user?.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    labels,
    loading,
    pendingCount: labels.length,
    refresh,
  }
}
