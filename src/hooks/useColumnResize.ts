import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'

const DEFAULT_MIN_WIDTH = 56

function readStoredWidths<T extends string>(storageKey: string): Partial<Record<T, number>> {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Partial<Record<T, number>>
  } catch {
    return {}
  }
}

type ResizeSession<T extends string> = {
  key: T
  startX: number
  startWidth: number
}

export function useColumnResize<T extends string>(storageKey?: string, minWidth = DEFAULT_MIN_WIDTH) {
  const [columnWidths, setColumnWidths] = useState<Partial<Record<T, number>>>(() =>
    storageKey ? readStoredWidths<T>(storageKey) : {},
  )
  const columnWidthsRef = useRef(columnWidths)
  const resizingRef = useRef<ResizeSession<T> | null>(null)

  columnWidthsRef.current = columnWidths

  const getColumnStyle = useCallback(
    (key: T): CSSProperties | undefined => {
      const width = columnWidths[key]
      if (width == null) return undefined
      return { width, minWidth: width, maxWidth: width }
    },
    [columnWidths],
  )

  const onResizeHandleMouseDown = useCallback((key: T, event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const th = event.currentTarget.closest('th')
    if (!th) return
    resizingRef.current = {
      key,
      startX: event.clientX,
      startWidth: th.getBoundingClientRect().width,
    }
    document.body.classList.add('is-col-resizing')
  }, [])

  useEffect(() => {
    const onMouseMove = (event: globalThis.MouseEvent) => {
      const session = resizingRef.current
      if (!session) return
      const delta = event.clientX - session.startX
      const nextWidth = Math.max(minWidth, Math.round(session.startWidth + delta))
      setColumnWidths((current) => ({ ...current, [session.key]: nextWidth }))
    }

    const onMouseUp = () => {
      if (!resizingRef.current) return
      resizingRef.current = null
      document.body.classList.remove('is-col-resizing')
      if (!storageKey) return
      try {
        localStorage.setItem(storageKey, JSON.stringify(columnWidthsRef.current))
      } catch {
        // ponytail: ignore quota / private-mode write failures
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.classList.remove('is-col-resizing')
    }
  }, [minWidth, storageKey])

  return { columnWidths, getColumnStyle, onResizeHandleMouseDown }
}
