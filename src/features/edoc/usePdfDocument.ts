import { useEffect, useState } from 'react'
// Legacy build includes Map.getOrInsertComputed polyfills required by pdf.js 6
// in Chromium builds that do not yet ship that API (e.g. Cursor preview).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'

const baseUrl = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

pdfjs.GlobalWorkerOptions.workerSrc = `${baseUrl}pdf.worker.min.mjs`

export type PdfJsDocument = PDFDocumentProxy

function formatPdfLoadError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Could not render the uploaded PDF.'
  if (/fake worker|dynamically imported module|pdf\.worker/i.test(message)) {
    return 'Could not start the PDF preview engine. Try refreshing the page, or restart the dev server if this persists.'
  }
  return message
}

export function usePdfDocument(source: ArrayBuffer | Uint8Array | null) {
  const [document, setDocument] = useState<PdfJsDocument | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let loadingTask: ReturnType<typeof pdfjs.getDocument> | null = null
    let owned: PDFDocumentProxy | null = null

    async function load() {
      setDocument(null)
      setPageCount(0)
      setError(null)
      if (!source) return

      setLoading(true)
      try {
        // Copy so pdf.js can transfer the buffer to the worker without detaching React state.
        const data = source instanceof ArrayBuffer ? new Uint8Array(source.slice(0)) : new Uint8Array(source)
        loadingTask = pdfjs.getDocument({ data })
        const loaded = await loadingTask.promise
        if (cancelled) {
          void loaded.cleanup()
          return
        }
        owned = loaded
        setDocument(loaded)
        setPageCount(loaded.numPages)
      } catch (err) {
        if (!cancelled) {
          setError(formatPdfLoadError(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      void loadingTask?.destroy()
      if (owned) {
        void owned.cleanup()
        owned = null
      }
    }
  }, [source])

  return { document, pageCount, loading, error }
}
