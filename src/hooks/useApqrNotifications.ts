import { useCallback, useEffect, useState } from 'react'

import { buildAnnualSchedulingReminders, type ApqrSchedulingReminderSummary } from '../features/apqr/apqrSchedulingReminders'
import { listClients, listDatabaseRows } from '../features/apqr/apqrService'
import { useAuth } from './useAuth'

const POLL_MS = 60_000

const EMPTY_SUMMARY: ApqrSchedulingReminderSummary = {
  active: false,
  cycleYear: new Date().getFullYear() + 1,
  cycleLabel: '',
  items: [],
  pendingCount: 0,
}

export function useApqrNotifications(enabled: boolean) {
  const { user, hasRole } = useAuth()
  const isAdmin = hasRole(['Admin'])
  const [summary, setSummary] = useState<ApqrSchedulingReminderSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled || !user) {
      setSummary(EMPTY_SUMMARY)
      return
    }

    setLoading(true)
    try {
      const [clients, rows] = await Promise.all([listClients(), listDatabaseRows()])
      setSummary(buildAnnualSchedulingReminders(rows, clients, user.name, isAdmin))
    } catch {
      setSummary(EMPTY_SUMMARY)
    } finally {
      setLoading(false)
    }
  }, [enabled, isAdmin, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!enabled || !user) return
    const timer = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(timer)
  }, [enabled, refresh, user])

  return {
    summary,
    loading,
    pendingCount: summary.pendingCount,
    refresh,
  }
}
