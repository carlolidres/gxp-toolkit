import { useEffect, useState } from 'react'
// Legacy build includes Map.getOrInsertComputed polyfills required by pdf.js 6
// in Chromium builds that do not yet ship that API (e.g. Cursor preview).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'
// Vite resolves this to a hashed URL — more reliable than public/ under BASE_URL.
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

const baseUrl = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl || `${baseUrl}pdf.worker.min.mjs`

export type PdfJsDocument = PDFDocumentProxy

const PDF_PARSE_TIMEOUT_MS = 45_000

function formatPdfLoadError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Could not render the uploaded PDF.'
  if (/timeout|timed out/i.test(message)) {
    return 'PDF preview timed out. Check your connection and try again.'
  }
  if (/fake worker|dynamically imported module|pdf\.worker|Failed to fetch dynamically imported module/i.test(message)) {
    return 'Could not start the PDF preview engine. Try a hard refresh (Ctrl+Shift+R), or restart the dev server.'
  }
  if (/Invalid PDF|Missing PDF|FormatError/i.test(message)) {
    return 'The downloaded file is not a valid PDF (or it is corrupted).'
  }
  return message
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        window.clearTimeout(timer)
        reject(err)
      },
    )
  })
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
        const data = source instanceof ArrayBuffer
          ? new Uint8Array(source.slice(0))
          : new Uint8Array(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength))

        if (data.byteLength < 5) {
          throw new Error('The downloaded PDF is empty.')
        }
        const header = new TextDecoder().decode(data.subarray(0, 5))
        if (header !== '%PDF-') {
          throw new Error('The downloaded file is not a valid PDF (or it is corrupted).')
        }

        loadingTask = pdfjs.getDocument({ data, useSystemFonts: true })
        const loaded = await withTimeout(loadingTask.promise, PDF_PARSE_TIMEOUT_MS, 'PDF parse')
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
      void loadingTask?.destroy().catch(() => {
        /* destroy during Strict Mode remount is expected */
      })
      if (owned) {
        void owned.cleanup()
        owned = null
      }
    }
  }, [source])

  return { document, pageCount, loading, error }
}
