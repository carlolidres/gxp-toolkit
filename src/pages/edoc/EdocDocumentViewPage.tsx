import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Tooltip } from 'antd'
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  FileText,
  History,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserRound,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

import {
  EdocEmpty,
  EdocError,
  EdocLoading,
  EdocPage,
  EdocPriorityBadge,
  EdocStatusBadge,
  formatEdocDate,
  formatEdocEventType,
} from '../../components/edoc/EdocComponents'
import { EdocPdfPageCanvas } from '../../components/edoc/EdocPdfPageCanvas'
import { edocService } from '../../features/edoc/edocService'
import { buildPublicVerifyPath } from '../../features/edoc/pageIntegrity'
import {
  clampEdocPdfZoom,
  edocPdfRenderWidth,
  EDOC_PDF_ZOOM_MAX,
  EDOC_PDF_ZOOM_MIN,
  EDOC_PDF_ZOOM_STEP,
  formatEdocPdfZoomPercent,
} from '../../features/edoc/pdfPreviewZoom'
import type { EdocAuditEvent } from '../../features/edoc/types'
import { usePdfDocument } from '../../features/edoc/usePdfDocument'
import { useEdocAudit, useEdocDocument } from '../../features/edoc/useEdocData'
import { iconSize, iconStroke } from '../../theme/iconSizes'

function latestDisposition(events: EdocAuditEvent[] | null | undefined): {
  kind: 'rejected' | 'returned'
  reason: string
  actor: string
  at: string
} | null {
  const match = (events ?? []).find((event) => {
    if (!event.reason?.trim()) return false
    return (
      event.eventType === 'reject_completed'
      || event.eventType === 'return_completed'
      || event.eventType === 'external_auth_rejected'
    )
  })
  if (!match?.reason) return null
  const kind = match.eventType === 'return_completed' ? 'returned' : 'rejected'
  return {
    kind,
    reason: match.reason.trim(),
    actor: match.userName,
    at: match.createdAt,
  }
}

export function EdocDocumentViewPage() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const documentQuery = useEdocDocument(documentId)
  const document = documentQuery.data
  const audit = useEdocAudit(document?.id)
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null)
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfReloadKey, setPdfReloadKey] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [renderedSize, setRenderedSize] = useState({ width: 640, height: 820 })
  const [showDocumentPanel, setShowDocumentPanel] = useState(false)
  const [showAuditPanel, setShowAuditPanel] = useState(false)
  const [downloadLabel, setDownloadLabel] = useState('Download PDF')
  const [preferredFileRole, setPreferredFileRole] = useState<string | null>(null)
  const [contentPageCount, setContentPageCount] = useState<number | null>(null)
  const [verificationCode, setVerificationCode] = useState<string | null>(null)
  const [hasPageIntegrity, setHasPageIntegrity] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const autoFinalizeDocIdRef = useRef<string | null>(null)
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
  }, [document?.id, pdfReloadKey])

  useEffect(() => {
    if (pageCount > 0 && pageNumber > pageCount) setPageNumber(pageCount)
  }, [pageCount, pageNumber])

  useEffect(() => {
    let active = true
    if (!document?.id) return
    void (async () => {
      try {
        const cert = await edocService.getCompletionCertificateMeta(document.id)
        if (!active) return
        const code = cert?.verificationCode ?? null
        const integrity = Boolean(cert?.hasPageIntegrity)
        setContentPageCount(cert?.contentPageCount ?? null)
        setVerificationCode(code)
        setHasPageIntegrity(integrity)

        const file = await edocService.getPreferredDocumentFile(document.id, {
          preferSha256: cert?.finalPdfSha256,
          preferObjectKey: cert?.objectKey,
        })
        if (!active) return
        if (file) {
          const digestOk = !cert?.finalPdfSha256
            || !file.sha256
            || file.sha256.toLowerCase() === cert.finalPdfSha256.toLowerCase()
          setPreferredFileRole(file.fileRole)
          setDownloadLabel(
            cert?.hasPageIntegrity && digestOk && file.fileRole === 'certificate'
              ? 'Final Signed PDF'
              : file.label === 'Final Signed PDF'
                ? 'Final Signed PDF'
                : `Download ${file.label}`,
          )
        }

        if (
          document.status === 'completed'
          && !(code && integrity)
          && autoFinalizeDocIdRef.current !== document.id
        ) {
          autoFinalizeDocIdRef.current = document.id
          setFinalizing(true)
          setFinalizeError(null)
          setDownloadLabel('Preparing Final Signed PDF…')
          try {
            const result = await edocService.finalizeCompletedDocument(document.id)
            if (!active) return
            if (!result.ok) throw new Error(result.error || 'Final PDF generation failed.')
            const nextCert = await edocService.getCompletionCertificateMeta(document.id)
            if (!active) return
            if (!nextCert?.hasPageIntegrity) {
              throw new Error('Final Signed PDF integrity package is still incomplete.')
            }
            const nextFile = await edocService.getPreferredDocumentFile(document.id, {
              preferSha256: nextCert.finalPdfSha256,
              preferObjectKey: nextCert.objectKey,
            })
            if (!active) return
            setContentPageCount(nextCert.contentPageCount ?? null)
            setVerificationCode(nextCert.verificationCode ?? result.verificationCode ?? null)
            setHasPageIntegrity(Boolean(nextCert.hasPageIntegrity))
            if (nextFile) {
              setPreferredFileRole(nextFile.fileRole)
              setDownloadLabel('Final Signed PDF')
            }
            setPdfReloadKey((n) => n + 1)
          } catch (err) {
            if (!active) return
            autoFinalizeDocIdRef.current = null
            setFinalizeError(err instanceof Error ? err.message : 'Final PDF generation failed.')
            setDownloadLabel('Final Signed PDF')
          } finally {
            if (active) setFinalizing(false)
          }
        }
      } catch (err) {
        if (!active) return
        setFinalizeError(err instanceof Error ? err.message : 'Could not load document file metadata.')
      }
    })()
    return () => {
      active = false
    }
  }, [document?.id, document?.status])

  const historyStartPage =
    preferredFileRole === 'certificate' && contentPageCount != null && contentPageCount > 0
      ? contentPageCount + 1
      : null
  const openHistoryPage =
    historyStartPage != null
      ? Math.min(historyStartPage, Math.max(pageCount, 1))
      : Math.max(pageCount, 1)
  const onHistoryPage =
    historyStartPage != null
      ? pageNumber >= historyStartPage
      : preferredFileRole === 'certificate' && pageCount > 1 && pageNumber > 1
  const showHistoryCue =
    document?.status === 'completed'
    && preferredFileRole === 'certificate'
    && pageCount > 1

  async function ensureFinalSignedPdfReady(): Promise<boolean> {
    if (!document?.id) return false
    if (document.status !== 'completed') return true

    const current = await edocService.getCompletionCertificateMeta(document.id)
    if (current?.hasPageIntegrity && current.verificationCode && current.finalPdfSha256) {
      const bound = await edocService.getPreferredDocumentFile(document.id, {
        preferSha256: current.finalPdfSha256,
        preferObjectKey: current.objectKey,
      })
      if (
        bound
        && bound.sha256
        && bound.sha256.toLowerCase() === current.finalPdfSha256.toLowerCase()
      ) {
        setPreferredFileRole(bound.fileRole)
        setDownloadLabel('Final Signed PDF')
        setContentPageCount(current.contentPageCount ?? null)
        setVerificationCode(current.verificationCode)
        setHasPageIntegrity(true)
        return true
      }
    }

    setFinalizing(true)
    setFinalizeError(null)
    try {
      const result = await edocService.finalizeCompletedDocument(document.id)
      if (!result.ok) throw new Error(result.error || 'Final PDF generation failed.')
      const cert = await edocService.getCompletionCertificateMeta(document.id)
      if (!cert?.hasPageIntegrity || !cert.finalPdfSha256) {
        throw new Error('Final Signed PDF integrity package is still incomplete.')
      }
      const file = await edocService.getPreferredDocumentFile(document.id, {
        preferSha256: cert.finalPdfSha256,
        preferObjectKey: cert.objectKey,
      })
      if (!file?.sha256 || file.sha256.toLowerCase() !== cert.finalPdfSha256.toLowerCase()) {
        throw new Error('Downloaded file digest does not match the completion certificate.')
      }
      setPreferredFileRole(file.fileRole)
      setDownloadLabel('Final Signed PDF')
      setContentPageCount(cert.contentPageCount ?? null)
      setVerificationCode(cert.verificationCode ?? result.verificationCode ?? null)
      setHasPageIntegrity(true)
      setPdfReloadKey((n) => n + 1)
      return true
    } catch (err) {
      autoFinalizeDocIdRef.current = null
      setFinalizeError(err instanceof Error ? err.message : 'Final PDF generation failed.')
      return false
    } finally {
      setFinalizing(false)
    }
  }

  async function downloadPreferredPdf() {
    if (!document?.id) return
    setDownloading(true)
    try {
      if (document.status === 'completed') {
        const ready = await ensureFinalSignedPdfReady()
        if (!ready) throw new Error('Final Signed PDF is not ready yet. Retry generation, then download again.')
      }
      const cert = document.status === 'completed'
        ? await edocService.getCompletionCertificateMeta(document.id)
        : null
      const file = await edocService.getPreferredDocumentFile(document.id, {
        preferSha256: cert?.finalPdfSha256,
        preferObjectKey: cert?.objectKey,
      })
      if (!file) throw new Error('No downloadable PDF is available.')
      if (
        document.status === 'completed'
        && cert?.finalPdfSha256
        && (!file.sha256 || file.sha256.toLowerCase() !== cert.finalPdfSha256.toLowerCase())
      ) {
        throw new Error('Preferred file digest does not match the completion certificate hash.')
      }
      const access = await edocService.requestFileAccess(file.id, 'download')
      const anchor = window.document.createElement('a')
      anchor.href = access.signedUrl
      anchor.download = file.fileName || `${document.documentNumber}.pdf`
      anchor.rel = 'noopener'
      anchor.target = '_blank'
      anchor.click()
    } catch (err) {
      setPdfLoadError(err instanceof Error ? err.message : 'Download failed.')
    } finally {
      setDownloading(false)
    }
  }

  async function retryFinalSignedPdf() {
    autoFinalizeDocIdRef.current = null
    await ensureFinalSignedPdfReady()
  }

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
  const disposition = latestDisposition(audit.data)
  const renderWidth = edocPdfRenderWidth(zoom)
  const showDispositionShell =
    document.status === 'rejected'
    || document.status === 'returned'
    || Boolean(disposition)
  const workspaceClass = [
    'edoc-workspace',
    'edoc-workspace--pdf-focus',
    showDocumentPanel ? 'edoc-workspace--document-open' : '',
    showAuditPanel ? 'edoc-workspace--audit-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <EdocPage
      title={document.title}
      description={`${document.documentNumber} · v${document.versionNumber}`}
      action={
        <div className="edoc-doc-view-actions">
          <Button
            type="primary"
            icon={<Download size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
            loading={downloading || finalizing}
            disabled={document.status === 'completed' && finalizing}
            onClick={() => void downloadPreferredPdf()}
          >
            {document.status === 'completed' && finalizing
              ? 'Preparing Final Signed PDF…'
              : document.status === 'completed'
                ? 'Final Signed PDF'
                : downloadLabel}
          </Button>
          <Button
            icon={<ArrowLeft size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        </div>
      }
    >
      {showDispositionShell ? (
        <section
          className={[
            'edoc-doc-disposition',
            disposition?.kind === 'returned' || (!disposition && document.status === 'returned')
              ? 'edoc-doc-disposition--returned'
              : 'edoc-doc-disposition--rejected',
          ].join(' ')}
          aria-live="polite"
        >
          <span className="edoc-doc-disposition-icon" aria-hidden>
            {disposition?.kind === 'returned' || (!disposition && document.status === 'returned') ? (
              <RotateCcw size={iconSize.md} strokeWidth={iconStroke} />
            ) : (
              <CircleAlert size={iconSize.md} strokeWidth={iconStroke} />
            )}
          </span>
          <div className="edoc-doc-disposition-body">
            <p className="edoc-doc-disposition-eyebrow">
              {disposition?.kind === 'returned' || (!disposition && document.status === 'returned')
                ? 'Returned'
                : 'Rejected'}
            </p>
            <h2 className="edoc-doc-disposition-title">
              {disposition?.kind === 'returned' || (!disposition && document.status === 'returned')
                ? 'Document returned for revision'
                : 'Document rejected'}
            </h2>
            {disposition ? (
              <>
                <p className="edoc-doc-disposition-reason">
                  <span className="edoc-doc-disposition-reason-label">Reason</span>
                  {disposition.reason}
                </p>
                <p className="edoc-doc-disposition-meta">
                  <UserRound size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
                  <span>{disposition.actor}</span>
                  <span aria-hidden>·</span>
                  <time dateTime={disposition.at}>{formatEdocDate(disposition.at)}</time>
                </p>
              </>
            ) : !audit.loading ? (
              <p className="edoc-doc-disposition-reason edoc-doc-disposition-reason--muted">
                No disposition reason was found in the audit trail for this document.
              </p>
            ) : (
              <p className="edoc-doc-disposition-reason edoc-doc-disposition-reason--muted">
                Loading disposition details…
              </p>
            )}
          </div>
          {(document.status === 'rejected' || document.status === 'returned') ? (
            <div className="edoc-doc-disposition-status">
              <EdocStatusBadge status={document.status} />
            </div>
          ) : null}
        </section>
      ) : null}

      <div className={workspaceClass}>
        {showDocumentPanel ? (
          <Card className="panel side-panel edoc-workspace-document-panel">
            <header className="edoc-ws-panel-header edoc-ws-panel-header--compact">
              <div className="edoc-ws-panel-title-row">
                <span className="edoc-ws-icon-badge" aria-hidden>
                  <FileText size={iconSize.sm} strokeWidth={iconStroke} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="edoc-ws-eyebrow">Document</p>
                  <h2 className="edoc-ws-title edoc-ws-title--sm">{document.documentNumber}</h2>
                </div>
                <Button
                  type="text"
                  size="small"
                  className="edoc-workspace-panel-close"
                  aria-label="Hide document details"
                  icon={<X size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                  onClick={() => setShowDocumentPanel(false)}
                />
              </div>
            </header>

            <dl className="edoc-ws-meta edoc-doc-view-meta">
              <div>
                <dt>Status</dt>
                <dd><EdocStatusBadge status={document.status} /></dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd><EdocPriorityBadge priority={document.priority} /></dd>
              </div>
              <div>
                <dt>
                  <UserRound size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
                  Owner
                </dt>
                <dd>{document.ownerName}</dd>
              </div>
              <div>
                <dt>
                  <Building2 size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
                  Department
                </dt>
                <dd>{document.department || '—'}</dd>
              </div>
              <div>
                <dt>
                  <CalendarClock size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
                  Due
                </dt>
                <dd>{formatEdocDate(document.dueAt)}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatEdocDate(document.updatedAt)}</dd>
              </div>
            </dl>

            {verificationCode ? (
              <Link
                to={buildPublicVerifyPath(verificationCode).replace(/^#/, '')}
                className="edoc-doc-verify-link"
              >
                <ShieldCheck size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
                Open public verify page
              </Link>
            ) : null}

            <Link to="/edoc/documents" className="edoc-ws-back-link">
              <Button type="text" block icon={<FileText size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}>
                All documents
              </Button>
            </Link>
          </Card>
        ) : null}

        <div className="edoc-workspace-pdf-stage">
          <Card className="panel pdf-panel">
            <div className="document-preview edoc-document-preview">
              {showHistoryCue ? (
                <section className="edoc-doc-history-cue" aria-live="polite">
                  <span className="edoc-doc-history-cue-icon" aria-hidden>
                    <History size={iconSize.sm} strokeWidth={iconStroke} />
                  </span>
                  <div className="edoc-doc-history-cue-body">
                    <p className="edoc-doc-history-cue-title">Completion history is attached</p>
                    <p className="edoc-doc-history-cue-copy">
                      {onHistoryPage
                        ? 'You are viewing the GxP Toolkit Final Audit Report appended after routing completed.'
                        : 'The Final Signed PDF includes a Final Audit Report after the signed document pages. Use Next or Open history to review it.'}
                    </p>
                  </div>
                  {!onHistoryPage ? (
                    <Button size="small" type="primary" onClick={() => setPageNumber(openHistoryPage)}>
                      Open history
                    </Button>
                  ) : null}
                </section>
              ) : null}

              {pdfLoading || pdfDocLoading ? <EdocLoading label="Loading PDF…" /> : null}

              {previewError ? (
                <div className="edoc-doc-preview-error">
                  <EdocError message={previewError} />
                  <Button
                    type="default"
                    icon={<RefreshCw size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                    onClick={() => {
                      setPdfBytes(null)
                      setPdfReloadKey((n) => n + 1)
                    }}
                  >
                    Retry PDF load
                  </Button>
                </div>
              ) : null}

              {!pdfLoading && !pdfDocLoading && !previewError && pdfDocument ? (
                <div className="edoc-doc-preview-stage">
                  <div className="edoc-doc-preview-toolbar" role="toolbar" aria-label="PDF page controls">
                    <div className="edoc-doc-preview-toolbar-copy">
                      <span className="edoc-doc-preview-section">
                        {onHistoryPage ? 'History' : 'Document'}
                      </span>
                      <span className="edoc-doc-preview-page">
                        Page {pageNumber} / {Math.max(pageCount, 1)}
                      </span>
                      {preferredFileRole === 'certificate' ? (
                        <span className="edoc-doc-preview-chip">Final Signed PDF</span>
                      ) : null}
                    </div>
                    <div className="edoc-doc-preview-controls">
                      <div className="edoc-doc-preview-zoom" role="group" aria-label="Zoom">
                        <Button
                          size="small"
                          aria-label="Zoom out"
                          disabled={zoom <= EDOC_PDF_ZOOM_MIN}
                          icon={<ZoomOut size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                          onClick={() => setZoom((current) => clampEdocPdfZoom(current - EDOC_PDF_ZOOM_STEP))}
                        />
                        <button
                          type="button"
                          className="edoc-doc-preview-zoom-label"
                          aria-label={`Zoom ${formatEdocPdfZoomPercent(zoom)}. Click to reset to 100%.`}
                          onClick={() => setZoom(1)}
                        >
                          {formatEdocPdfZoomPercent(zoom)}
                        </button>
                        <Button
                          size="small"
                          aria-label="Zoom in"
                          disabled={zoom >= EDOC_PDF_ZOOM_MAX}
                          icon={<ZoomIn size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                          onClick={() => setZoom((current) => clampEdocPdfZoom(current + EDOC_PDF_ZOOM_STEP))}
                        />
                      </div>
                      <div className="edoc-doc-preview-pager">
                        <Button
                          size="small"
                          aria-label="Previous page"
                          disabled={pageNumber <= 1}
                          icon={<ChevronLeft size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                          onClick={() => setPageNumber((n) => Math.max(1, n - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          size="small"
                          aria-label="Next page"
                          disabled={pageNumber >= pageCount}
                          icon={<ChevronRight size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                          iconPosition="end"
                          onClick={() => setPageNumber((n) => Math.min(pageCount, n + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>

                  {document.status === 'completed' && verificationCode && hasPageIntegrity ? (
                    <p className="edoc-doc-preview-integrity-hint">
                      <ShieldCheck size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
                      <span>
                        Finalized PDF includes per-page integrity footers and signature verify links.
                      </span>
                      <Link to={buildPublicVerifyPath(verificationCode).replace(/^#/, '')}>
                        Open verify page
                      </Link>
                    </p>
                  ) : null}

                  {document.status === 'completed' && !(verificationCode && hasPageIntegrity) ? (
                    <p className="edoc-doc-preview-integrity-hint edoc-doc-preview-integrity-hint--warn">
                      <CircleAlert size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
                      <span>
                        {finalizing
                          ? 'Preparing Final Signed PDF with integrity footers…'
                          : finalizeError
                            ? `Final Signed PDF generation failed (${finalizeError}).`
                            : 'Final Signed PDF with integrity footers is not ready yet.'}
                      </span>
                      {!finalizing && finalizeError ? (
                        <Button size="small" type="primary" onClick={() => void retryFinalSignedPdf()}>
                          Retry
                        </Button>
                      ) : null}
                    </p>
                  ) : null}

                  <div className="edoc-doc-preview-scroll">
                    <div
                      className="edoc-doc-preview-frame"
                      style={{ width: renderWidth, height: renderedSize.height }}
                    >
                      <EdocPdfPageCanvas
                        document={pdfDocument}
                        pageNumber={pageNumber}
                        width={renderWidth}
                        onRenderedSize={setRenderedSize}
                      />
                    </div>
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

          <aside className="edoc-workspace-rail" aria-label="Document panels">
            <Tooltip title={showDocumentPanel ? 'Hide document details' : 'Show document details'} placement="left">
              <Button
                type={showDocumentPanel ? 'primary' : 'default'}
                className="edoc-workspace-rail-btn"
                aria-pressed={showDocumentPanel}
                aria-label={showDocumentPanel ? 'Hide document details' : 'Show document details'}
                icon={<FileText size={iconSize.md} strokeWidth={iconStroke} aria-hidden />}
                onClick={() => setShowDocumentPanel((open) => !open)}
              />
            </Tooltip>
            <Tooltip title={showAuditPanel ? 'Hide audit activity' : 'Show audit activity'} placement="left">
              <Button
                type={showAuditPanel ? 'primary' : 'default'}
                className="edoc-workspace-rail-btn"
                aria-pressed={showAuditPanel}
                aria-label={showAuditPanel ? 'Hide audit activity' : 'Show audit activity'}
                icon={<History size={iconSize.md} strokeWidth={iconStroke} aria-hidden />}
                onClick={() => setShowAuditPanel((open) => !open)}
              />
            </Tooltip>
          </aside>
        </div>

        {showAuditPanel ? (
          <Card className="panel side-panel edoc-workspace-audit-panel">
            <header className="edoc-ws-panel-header edoc-ws-panel-header--compact">
              <div className="edoc-ws-panel-title-row">
                <span className="edoc-ws-icon-badge" aria-hidden>
                  <History size={iconSize.sm} strokeWidth={iconStroke} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="edoc-ws-eyebrow">Audit activity</p>
                  <h2 className="edoc-ws-title edoc-ws-title--sm">Document timeline</h2>
                </div>
                <Button
                  type="text"
                  size="small"
                  className="edoc-workspace-panel-close"
                  aria-label="Hide audit activity"
                  icon={<X size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                  onClick={() => setShowAuditPanel(false)}
                />
              </div>
            </header>

            {audit.loading ? <EdocLoading label="Loading audit…" /> : null}
            {audit.error ? <EdocError message={audit.error} /> : null}
            {!audit.loading && !audit.error && (audit.data ?? []).length === 0 ? (
              <p className="edoc-ws-empty-hint">No audit events recorded for this document yet.</p>
            ) : null}
            <ol className="edoc-ws-audit-list">
              {(audit.data ?? []).map((event) => (
                <li key={event.id} className="edoc-ws-audit-item">
                  <span className="edoc-ws-audit-dot" aria-hidden />
                  <div className="edoc-ws-audit-body">
                    <strong className="edoc-ws-audit-type">{formatEdocEventType(event.eventType)}</strong>
                    {event.reason?.trim() ? (
                      <p className="edoc-ws-audit-reason">{event.reason}</p>
                    ) : null}
                    <p className="edoc-ws-audit-meta">
                      {event.userName}
                      <span aria-hidden> · </span>
                      <time dateTime={event.createdAt}>{formatEdocDate(event.createdAt)}</time>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        ) : null}
      </div>
    </EdocPage>
  )
}
