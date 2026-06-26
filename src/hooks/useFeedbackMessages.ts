import { useCallback, useEffect, useRef, useState } from 'react'

import { useToast } from '../components/feedback/ToastProvider'
import { useAuth } from './useAuth'
import { feedbackService } from '../services/feedbackService'
import type { FeedbackMessage } from '../types/feedback'

const POLL_MS = 30_000

export function useFeedbackMessages() {
  const { user, hasRole } = useAuth()
  const { notify } = useToast()
  const isAdmin = hasRole(['Admin'])
  const [messages, setMessages] = useState<FeedbackMessage[]>([])
  const [loading, setLoading] = useState(false)
  const previousUnreadRef = useRef(0)
  const initializedRef = useRef(false)

  const unreadCount = isAdmin ? messages.filter((message) => message.status === 'unread').length : 0

  const refresh = useCallback(async () => {
    if (!user) {
      setMessages([])
      previousUnreadRef.current = 0
      return
    }

    setLoading(true)
    try {
      const next = await feedbackService.listMessages(user, isAdmin)
      if (isAdmin) {
        const nextUnread = next.filter((message) => message.status === 'unread').length
        if (initializedRef.current && nextUnread > previousUnreadRef.current) {
          notify('New feedback message received.')
        }
        previousUnreadRef.current = nextUnread
        initializedRef.current = true
      }
      setMessages(next)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not load messages.')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, notify, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!user || !isAdmin) return
    const timer = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(timer)
  }, [isAdmin, refresh, user])

  const acknowledgeUnread = useCallback(async () => {
    if (!user || !isAdmin || unreadCount === 0) return
    try {
      await feedbackService.acknowledgeUnread(user)
      previousUnreadRef.current = 0
      await refresh()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not acknowledge messages.')
    }
  }, [isAdmin, notify, refresh, unreadCount, user])

  return {
    messages,
    loading,
    unreadCount,
    isAdmin,
    refresh,
    acknowledgeUnread,
  }
}
