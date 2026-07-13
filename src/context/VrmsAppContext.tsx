import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { useToast } from '../components/feedback/ToastProvider'
import { VRMS_AUTO_REFRESH_MS } from '../lib/vrmsDefaults'
import { isSupabaseTableAuthError } from '../lib/supabaseAuth'
import { authService } from '../services/authService'
import { getVrmsService, resolveVrmsUserEmail } from '../services/vrmsService'
import type {
  AuditEvent,
  RoutingDocument,
  SaveRoutingDocumentPayload,
  SignDocumentResult,
  VrmsAppData,
  VrmsRegistryType,
} from '../types/vrms'

interface VrmsAppContextValue {
  appData: VrmsAppData | null
  loading: boolean
  error: string | null
  userEmail: string
  dataRevision: number
  refresh: (quiet?: boolean) => Promise<void>
  saveDocument: (payload: SaveRoutingDocumentPayload) => Promise<VrmsAppData>
  signDocumentSignatory: (tracker: string, order: number) => Promise<SignDocumentResult>
  getDocumentByTracker: (tracker: string) => Promise<RoutingDocument>
  getAuditTrail: () => Promise<AuditEvent[]>
  addRegistryValue: (type: VrmsRegistryType, value: string) => Promise<VrmsAppData>
  deleteRegistryValue: (type: VrmsRegistryType, value: string) => Promise<VrmsAppData>
}

const VrmsAppContext = createContext<VrmsAppContextValue | null>(null)

export function VrmsAppProvider({ children }: { children: ReactNode }) {
  const [appData, setAppData] = useState<VrmsAppData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataRevision, setDataRevision] = useState(0)
  const refreshInProgress = useRef(false)
  const mutationEpoch = useRef(0)
  const authFailedRef = useRef(false)
  const { notify } = useToast()
  const service = useMemo(() => getVrmsService(), [])
  const userEmail = resolveVrmsUserEmail()

  const bumpDataRevision = useCallback(() => {
    mutationEpoch.current += 1
    setDataRevision((current) => current + 1)
  }, [])

  const refresh = useCallback(
    async (quiet = false) => {
      if (refreshInProgress.current || authFailedRef.current) return
      refreshInProgress.current = true
      const epochAtStart = mutationEpoch.current
      if (!quiet) setLoading(true)
      try {
        if (authService.usesSupabase()) {
          const sessionOk = await authService.hasSupabaseSession()
          if (!sessionOk) {
            authFailedRef.current = true
            setError('Authentication session expired. Please sign in again.')
            return
          }
        }
        const data = await service.getAppData(userEmail)
        if (epochAtStart !== mutationEpoch.current) return
        setAppData(data)
        setError(null)
        authFailedRef.current = false
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load VRMS data.'
        if (isSupabaseTableAuthError(message)) {
          authFailedRef.current = true
        }
        setError(message)
        if (!quiet && !isSupabaseTableAuthError(message)) notify(message)
      } finally {
        refreshInProgress.current = false
        if (!quiet) setLoading(false)
      }
    },
    [notify, service, userEmail],
  )

  useEffect(() => {
    authFailedRef.current = false
    void refresh()
    const interval = window.setInterval(() => {
      if (document.hidden || authFailedRef.current) return
      void refresh(true)
    }, VRMS_AUTO_REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [refresh])

  const saveDocument = useCallback(
    async (payload: SaveRoutingDocumentPayload) => {
      try {
        bumpDataRevision()
        const data = await service.saveDocument(payload, userEmail)
        setAppData(data)
        bumpDataRevision()
        return data
      } catch (err) {
        bumpDataRevision()
        const message =
          err instanceof Error
            ? err.message
            : 'Could not save the routing record. Check required fields and your connection, then try again.'
        throw new Error(message)
      }
    },
    [bumpDataRevision, service, userEmail],
  )

  const signDocumentSignatory = useCallback(
    async (tracker: string, order: number) => {
      bumpDataRevision()
      const result = await service.signDocumentSignatory(tracker, order, userEmail)
      if (result.appData) setAppData(result.appData)
      bumpDataRevision()
      notify(
        result.final
          ? `Routing completed — status set to ${result.status}.`
          : `Signed — forwarded to ${result.nextName || 'next signatory'}.`,
      )
      return result
    },
    [bumpDataRevision, notify, service, userEmail],
  )

  const getDocumentByTracker = useCallback(
    async (tracker: string) => service.getDocumentByTracker(tracker),
    [service],
  )

  const getAuditTrail = useCallback(async () => service.getAuditTrail(), [service])

  const addRegistryValue = useCallback(
    async (type: VrmsRegistryType, value: string) => {
      bumpDataRevision()
      const data = await service.addRegistryValue(type, value, userEmail)
      setAppData(data)
      bumpDataRevision()
      return data
    },
    [bumpDataRevision, service, userEmail],
  )

  const deleteRegistryValue = useCallback(
    async (type: VrmsRegistryType, value: string) => {
      bumpDataRevision()
      const data = await service.deleteRegistryValue(type, value, userEmail)
      setAppData(data)
      bumpDataRevision()
      return data
    },
    [bumpDataRevision, service, userEmail],
  )

  const value = useMemo(
    () => ({
      appData,
      loading,
      error,
      userEmail,
      dataRevision,
      refresh,
      saveDocument,
      signDocumentSignatory,
      getDocumentByTracker,
      getAuditTrail,
      addRegistryValue,
      deleteRegistryValue,
    }),
    [
      appData,
      loading,
      error,
      userEmail,
      dataRevision,
      refresh,
      saveDocument,
      signDocumentSignatory,
      getDocumentByTracker,
      getAuditTrail,
      addRegistryValue,
      deleteRegistryValue,
    ],
  )

  return <VrmsAppContext.Provider value={value}>{children}</VrmsAppContext.Provider>
}

export function useVrmsApp() {
  const context = useContext(VrmsAppContext)
  if (!context) throw new Error('useVrmsApp must be used within VrmsAppProvider')
  return context
}
