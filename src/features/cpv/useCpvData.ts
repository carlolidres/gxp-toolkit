import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../../hooks/useAuth'
import { setCpvSessionActor } from './cpvService'

export function useCpvActorSync() {
  const { user } = useAuth()
  useEffect(() => {
    if (!user) return
    setCpvSessionActor({
      id: user.profileId ?? user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
  }, [user])
}

export function useCpvLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await loader())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CPV data')
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}
