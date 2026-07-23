import { useEffect, useState } from 'react'
// Legacy build includes Map.getOrInsertComputed polyfills required by pdf.js 6
// in Chromium builds that do not yet ship that API (e.g. Cursor preview).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

export type PdfJsDocument = PDFDocumentProxy

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
          setError(err instanceof Error ? err.message : 'Could not render the uploaded PDF.')
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
