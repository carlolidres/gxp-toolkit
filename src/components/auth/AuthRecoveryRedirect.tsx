import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'

/** Sends users to the reset-password route when Supabase activates a recovery session. */
export function AuthRecoveryRedirect() {
  const { passwordRecoveryActive, authReady } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authReady || !passwordRecoveryActive) return
    navigate('/reset-password', { replace: true })
  }, [authReady, navigate, passwordRecoveryActive])

  return null
}
