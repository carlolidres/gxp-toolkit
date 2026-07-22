import { useEffect, useState } from 'react'

const DESKTOP_QUERY = '(min-width: 961px)'

function getIsDesktop(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia(DESKTOP_QUERY).matches
}

/** True when the desktop hover-collapse sidebar chrome is active (≥961px). */
export function useDesktopNav(): boolean {
  const [isDesktop, setIsDesktop] = useState(getIsDesktop)

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY)
    const sync = () => setIsDesktop(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return isDesktop
}
