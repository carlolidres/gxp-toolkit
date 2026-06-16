import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function useScrollToHash(offset = 88) {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    const id = hash.replace('#', '')
    const element = document.getElementById(id)
    if (!element) return

    const top = element.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: 'smooth' })
  }, [pathname, hash, offset])
}
