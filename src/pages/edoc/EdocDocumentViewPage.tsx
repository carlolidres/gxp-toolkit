import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Card } from 'antd'
import { ArrowLeft } from 'lucide-react'

import {
  EdocEmpty,
  EdocError,
  EdocLoading,
  EdocPage,
  EdocPriorityBadge,
  EdocStatusBadge,
  formatEdocDate,
} from '../../components/edoc/EdocComponents'
import { EdocPdfPageCanvas } from '../../components/edoc/EdocPdfPageCanvas'
import { edocService } from '../../features/edoc/edocService'
import { usePdfDocument } from '../../features/edoc/usePdfDocument'
import { useEdocAudit, useEdocDocument } from '../../features/edoc/useEdocData'

export function EdocDocumentViewPage() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const documentQuery = useEdocDocument(documentId)
  const document = documentQuery.data
  const audit = useEdocAudit(document?.id)
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null)
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [renderedSize, setRenderedSize] = useState({ width: 640, height: 820 })
  const { document: pdfDocument, pageCount, loading: pdfDocLoading, error: pdfDocError } = usePdfDocument(pdfBytes)

  useEffect(() => {
    let cancelled = false
    async function loadPdf() {
      if (!document?.id) {
        setPdfBytes(null)
        setPdfLoadError(null)
        return
      }
      setPdfLoading(true)
      setPdfLoadError(null)
      try {
        const bytes = await edocService.loadDocumentPdfBytes(document.id)
        if (!cancelled) setPdfBytes(bytes)
      } catch (err) {
        if (!cancelled) {
          setPdfBytes(null)
          setPdfLoadError(err instanceof Error ? err.message : 'Could not load the PDF.')
        }
      } finally {
        if (!cancelled) setPdfLoading(false)
      }
    }
    void loadPdf()
    return () => {
      cancelled = true
    }
  }, [document?.id])

  useEffect(() => {
    if (pageCount > 0 && pageNumber > pageCount) setPageNumber(pageCount)
  }, [pageCount, pageNumber])

  if (!documentId) {
    return (
      <EdocPage title="Document">
        <EdocEmpty title="Document not found" description="Open a document from the documents list." />
      </EdocPage>
    )
  }
  if (documentQuery.loading) {
    return (
      <EdocPage title="Document">
        <EdocLoading />
      </EdocPage>
    )
  }
  if (documentQuery.error) {
    return (
      <EdocPage title="Document">
        <EdocError message={documentQuery.error} />
      </EdocPage>
    )
  }
  if (!document) {
    return (
      <EdocPage title="Document">
        <EdocEmpty title="Document unavailable" description="This document may not exist or is outside your authorization." />
      </EdocPage>
    )
  }

  const previewError = pdfLoadError || pdfDocError

  return (
    <EdocPage
      title={document.title}
      description={`${document.documentNumber} · v${document.versionNumber}`}
      action={
        <Button icon={<ArrowLeft size={15} />} onClick={() => navigate(-1)}>
          Back
        </Button>
      }
    >
      <div className="edoc-workspace">
        <Card className="panel side-panel">
          <span className="eyebrow">Document</span>
          <h2>{document.documentNumber}</h2>
          <p><strong>Status:</strong> <EdocStatusBadge status={document.status} /></p>
          <p><strong>Priority:</strong> <EdocPriorityBadge priority={document.priority} /></p>
          <p><strong>Owner:</strong> {document.ownerName}</p>
          <p><strong>Department:</strong> {document.department || '—'}</p>
          <p><strong>Due:</strong> {formatEdocDate(document.dueAt)}</p>
          <p><strong>Updated:</strong> {formatEdocDate(document.updatedAt)}</p>
          <Link to="/edoc/documents">
            <Button>All Documents</Button>
          </Link>
        </Card>

        <Card className="panel pdf-panel">
          <div className="document-preview edoc-document-preview">
            {pdfLoading || pdfDocLoading ? <EdocLoading label="Loading PDF…" /> : null}
            {previewError ? <EdocError message={previewError} /> : null}
            {!pdfLoading && !pdfDocLoading && !previewError && pdfDocument ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 text-xs font-semibold text-[var(--muted)]">
                    Page {pageNumber} / {Math.max(pageCount, 1)}
                  </p>
                  <div className="flex gap-2">
                    <Button size="small" disabled={pageNumber <= 1} onClick={() => setPageNumber((n) => Math.max(1, n - 1))}>
                      Previous
                    </Button>
                    <Button size="small" disabled={pageNumber >= pageCount} onClick={() => setPageNumber((n) => Math.min(pageCount, n + 1))}>
                      Next
                    </Button>
                  </div>
                </div>
                <div
                  className="mx-auto overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow)]"
                  style={{ width: 640, height: renderedSize.height }}
                >
                  <EdocPdfPageCanvas
                    document={pdfDocument}
                    pageNumber={pageNumber}
                    width={640}
                    onRenderedSize={setRenderedSize}
                  />
                </div>
              </div>
            ) : null}
            {!pdfLoading && !pdfDocLoading && !previewError && !pdfDocument ? (
              <div className="document-page">
                <div className="document-mark">eDocuSign</div>
                <h2>{document.title}</h2>
                <p>{document.documentNumber}</p>
                <hr />
                <h3>Secure PDF Preview</h3>
                <p>The PDF will appear here after the original file is available through private storage access.</p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="panel side-panel">
          <span className="eyebrow">Audit activity</span>
          {audit.loading ? <EdocLoading label="Loading audit..." /> : null}
          {audit.error ? <EdocError message={audit.error} /> : null}
          <div className="task-list">
            {(audit.data ?? []).map((event) => (
              <article key={event.id}>
                <div>
                  <strong>{event.eventType}</strong>
                  <p>{event.userName} · {formatEdocDate(event.createdAt)}</p>
                </div>
              </article>
            ))}
          </div>
        </Card>
      </div>
    </EdocPage>
  )
}
