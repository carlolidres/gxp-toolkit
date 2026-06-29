import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { useToast } from '../components/feedback/ToastProvider'
import type { CreateUserOptionInput, VmpFieldOption } from '../lib/vmpFieldOptions'
import type { VmpMasterlistRecord } from '../lib/vmpMasterlist'
import {
  getVmpFieldOptionService,
} from '../services/vmpFieldOptionService'
import {
  getVmpMasterlistService,
  resolveVmpActorEmail,
  type SaveVmpRecordPayload,
} from '../services/vmpMasterlistService'

interface VmpAppContextValue {
  records: VmpMasterlistRecord[]
  fieldOptions: VmpFieldOption[]
  loading: boolean
  optionsLoading: boolean
  error: string | null
  isSaving: boolean
  refresh: () => Promise<void>
  refreshFieldOptions: () => Promise<void>
  getRecordById: (id: string) => VmpMasterlistRecord | undefined
  getRecordByRecordId: (recordId: string) => VmpMasterlistRecord | undefined
  saveRecord: (payload: SaveVmpRecordPayload) => Promise<VmpMasterlistRecord>
  addFieldOption: (input: CreateUserOptionInput) => Promise<VmpFieldOption>
  updateFieldOption: (
    id: string,
    patch: Partial<Pick<VmpFieldOption, 'displayValue' | 'displayOrder' | 'isActive'>>,
  ) => Promise<VmpFieldOption>
  archiveRecord: (id: string) => Promise<VmpMasterlistRecord>
  restoreRecord: (id: string) => Promise<VmpMasterlistRecord>
}

const VmpAppContext = createContext<VmpAppContextValue | null>(null)

export function VmpAppProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<VmpMasterlistRecord[]>([])
  const [fieldOptions, setFieldOptions] = useState<VmpFieldOption[]>([])
  const [loading, setLoading] = useState(true)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const { notify } = useToast()
  const service = useMemo(() => getVmpMasterlistService(), [])
  const optionService = useMemo(() => getVmpFieldOptionService(), [])
  const actor = resolveVmpActorEmail()
  const saveInFlight = useRef(false)

  const refreshFieldOptions = useCallback(async () => {
    setOptionsLoading(true)
    try {
      const next = await optionService.listOptions()
      setFieldOptions(next)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load VMP field options.'
      setError(message)
      notify(message)
    } finally {
      setOptionsLoading(false)
    }
  }, [notify, optionService])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await service.listRecords()
      setRecords(next)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load VMP masterlist records.'
      setError(message)
      notify(message)
    } finally {
      setLoading(false)
    }
  }, [notify, service])

  useEffect(() => {
    void refresh()
    void refreshFieldOptions()
  }, [refresh, refreshFieldOptions])

  const getRecordById = useCallback((id: string) => records.find((record) => record.id === id), [records])

  const getRecordByRecordId = useCallback(
    (recordId: string) => records.find((record) => record.recordId === recordId),
    [records],
  )

  const saveRecord = useCallback(
    async (payload: SaveVmpRecordPayload) => {
      if (saveInFlight.current) {
        throw new Error('Save already in progress.')
      }
      saveInFlight.current = true
      setIsSaving(true)
      try {
        const saved = await service.saveRecord(payload, actor)
        setRecords((current) => {
          const index = current.findIndex((record) => record.id === saved.id)
          if (index < 0) return [saved, ...current]
          return current.map((record) => (record.id === saved.id ? saved : record))
        })
        setError(null)
        return saved
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save record.'
        setError(message)
        throw err
      } finally {
        saveInFlight.current = false
        setIsSaving(false)
      }
    },
    [actor, service],
  )

  const archiveRecord = useCallback(
    async (id: string) => {
      const saved = await service.archiveRecord(id, actor)
      setRecords((current) => current.map((record) => (record.id === saved.id ? saved : record)))
      return saved
    },
    [actor, service],
  )

  const restoreRecord = useCallback(
    async (id: string) => {
      const saved = await service.restoreRecord(id, actor)
      setRecords((current) => current.map((record) => (record.id === saved.id ? saved : record)))
      return saved
    },
    [actor, service],
  )

  const addFieldOption = useCallback(
    async (input: CreateUserOptionInput) => {
      const saved = await optionService.addUserOption(input)
      setFieldOptions((current) => [...current, saved])
      return saved
    },
    [optionService],
  )

  const updateFieldOption = useCallback(
    async (id: string, patch: Partial<Pick<VmpFieldOption, 'displayValue' | 'displayOrder' | 'isActive'>>) => {
      const saved = await optionService.updateOption(id, patch, actor)
      setFieldOptions((current) => current.map((row) => (row.id === saved.id ? saved : row)))
      return saved
    },
    [actor, optionService],
  )

  const value = useMemo(
    () => ({
      records,
      fieldOptions,
      loading,
      optionsLoading,
      error,
      isSaving,
      refresh,
      refreshFieldOptions,
      getRecordById,
      getRecordByRecordId,
      saveRecord,
      addFieldOption,
      updateFieldOption,
      archiveRecord,
      restoreRecord,
    }),
    [
      records,
      fieldOptions,
      loading,
      optionsLoading,
      error,
      isSaving,
      refresh,
      refreshFieldOptions,
      getRecordById,
      getRecordByRecordId,
      saveRecord,
      addFieldOption,
      updateFieldOption,
      archiveRecord,
      restoreRecord,
    ],
  )

  return <VmpAppContext.Provider value={value}>{children}</VmpAppContext.Provider>
}

export function useVmpApp(): VmpAppContextValue {
  const context = useContext(VmpAppContext)
  if (!context) {
    throw new Error('useVmpApp must be used within VmpAppProvider')
  }
  return context
}
