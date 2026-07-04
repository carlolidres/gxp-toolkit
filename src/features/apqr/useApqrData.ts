import { useCallback, useEffect, useState } from 'react'

import {
  getDashboardMetrics,
  getRecordByApqrId,
  listClients,
  listDatabaseRows,
  listSchedulerForClient,
} from './apqrService'
import type { ApqrClient, ApqrDashboardMetrics, ApqrDatabaseRow, ApqrRecord, ApqrSchedulerEntry } from './types'

export function useApqrLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await loader())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load APQR data')
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}

export function useApqrClients() {
  return useApqrLoad<ApqrClient[]>(() => listClients())
}

export function useApqrDatabase() {
  return useApqrLoad<ApqrDatabaseRow[]>(() => listDatabaseRows())
}

export function useApqrDashboard() {
  return useApqrLoad<ApqrDashboardMetrics>(() => getDashboardMetrics())
}

export function useApqrScheduler(clientId: string | null) {
  return useApqrLoad<ApqrSchedulerEntry[]>(
    () => (clientId ? listSchedulerForClient(clientId) : Promise.resolve([])),
    [clientId],
  )
}

export function useApqrRecord(apqrId: string | null) {
  return useApqrLoad<{
    sched: ApqrSchedulerEntry
    client: ApqrClient | undefined
    record: ApqrRecord | null | undefined
  } | null>(() => (apqrId ? getRecordByApqrId(apqrId) : Promise.resolve(null)), [apqrId])
}
