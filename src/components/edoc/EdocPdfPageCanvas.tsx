import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

export function EdocPdfPageCanvas({
  document,
  pageNumber,
  width,
  className,
  onRenderedSize,
}: {
  document: PDFDocumentProxy
  pageNumber: number
  width: number
  className?: string
  onRenderedSize?: (size: { width: number; height: number }) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const onRenderedSizeRef = useRef(onRenderedSize)
  onRenderedSizeRef.current = onRenderedSize

  useEffect(() => {
    let cancelled = false
    let renderTask: RenderTask | null = null

    async function render() {
      setError(null)
      const canvas = canvasRef.current
      if (!canvas || width <= 0) return

      try {
        const page = await document.getPage(pageNumber)
        if (cancelled) return

        const unscaled = page.getViewport({ scale: 1 })
        const scale = width / unscaled.width
        const viewport = page.getViewport({ scale })
        const context = canvas.getContext('2d', { alpha: false })
        if (!context) return

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        })
        await renderTask.promise
        if (!cancelled) {
          onRenderedSizeRef.current?.({ width: viewport.width, height: viewport.height })
        }
      } catch (err) {
        if (!cancelled && !(err && typeof err === 'object' && 'name' in err && err.name === 'RenderingCancelledException')) {
          setError(err instanceof Error ? err.message : 'Could not render this PDF page.')
        }
      }
    }

    void render()
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [document, pageNumber, width])

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="block max-w-full bg-white" aria-label={`PDF page ${pageNumber}`} />
      {error ? <p className="m-0 mt-2 text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  )
}
