import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { useToast } from '../components/feedback/ToastProvider'
import { VRMS_AUTO_REFRESH_MS } from '../lib/vrmsDefaults'
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
  const refreshInProgress = useRef(false)
  const { notify } = useToast()
  const service = useMemo(() => getVrmsService(), [])
  const userEmail = resolveVrmsUserEmail()

  const refresh = useCallback(
    async (quiet = false) => {
      if (refreshInProgress.current) return
      refreshInProgress.current = true
      if (!quiet) setLoading(true)
      try {
        const data = await service.getAppData(userEmail)
        setAppData(data)
        setError(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load VRMS data.'
        setError(message)
        if (!quiet) notify(message)
      } finally {
        refreshInProgress.current = false
        if (!quiet) setLoading(false)
      }
    },
    [notify, service, userEmail],
  )

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => {
      if (document.hidden) return
      void refresh(true)
    }, VRMS_AUTO_REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [refresh])

  const saveDocument = useCallback(
    async (payload: SaveRoutingDocumentPayload) => {
      const data = await service.saveDocument(payload, userEmail)
      setAppData(data)
      notify('Document routing record saved successfully.')
      return data
    },
    [notify, service, userEmail],
  )

  const signDocumentSignatory = useCallback(
    async (tracker: string, order: number) => {
      const result = await service.signDocumentSignatory(tracker, order, userEmail)
      if (result.appData) setAppData(result.appData)
      notify(
        result.final
          ? `Routing completed — status set to ${result.status}.`
          : `Signed — forwarded to ${result.nextName || 'next signatory'}.`,
      )
      return result
    },
    [notify, service, userEmail],
  )

  const getDocumentByTracker = useCallback(
    async (tracker: string) => service.getDocumentByTracker(tracker),
    [service],
  )

  const getAuditTrail = useCallback(async () => service.getAuditTrail(), [service])

  const addRegistryValue = useCallback(
    async (type: VrmsRegistryType, value: string) => {
      const data = await service.addRegistryValue(type, value, userEmail)
      setAppData(data)
      notify('Registry value added.')
      return data
    },
    [notify, service, userEmail],
  )

  const deleteRegistryValue = useCallback(
    async (type: VrmsRegistryType, value: string) => {
      const data = await service.deleteRegistryValue(type, value, userEmail)
      setAppData(data)
      notify('Registry value removed.')
      return data
    },
    [notify, service, userEmail],
  )

  const value = useMemo(
    () => ({
      appData,
      loading,
      error,
      userEmail,
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
