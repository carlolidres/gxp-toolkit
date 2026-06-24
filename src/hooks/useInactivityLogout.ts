import { useEffect } from 'react'

import { touchSessionActivity, isInactiveBeyond } from '../lib/authSessionStore'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const
const ACTIVITY_THROTTLE_MS = 30_000
const EXPIRY_CHECK_MS = 60_000

export function useInactivityLogout(
  isAuthenticated: boolean,
  logout: (reason?: 'manual' | 'inactivity') => Promise<void>,
) {
  useEffect(() => {
    if (!isAuthenticated) return

    let lastTouch = 0

    function recordActivity() {
      const now = Date.now()
      if (now - lastTouch < ACTIVITY_THROTTLE_MS) return
      lastTouch = now
      touchSessionActivity(now)
    }

    function checkExpiry() {
      if (isInactiveBeyond()) {
        void logout('inactivity')
      }
    }

    checkExpiry()
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true })
    })
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkExpiry()
    }
    window.addEventListener('focus', checkExpiry)
    document.addEventListener('visibilitychange', onVisible)
    const intervalId = window.setInterval(checkExpiry, EXPIRY_CHECK_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity)
      })
      window.removeEventListener('focus', checkExpiry)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(intervalId)
    }
  }, [isAuthenticated, logout])
}
