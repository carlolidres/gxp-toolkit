import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, App, Button, Card, Checkbox, Input, Select } from 'antd'
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ClipboardList,
  CornerUpLeft,
  History,
  Lock,
  PenLine,
  ShieldCheck,
  UserRound,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

import { EdocEmpty, EdocError, EdocLoading, EdocPage, formatEdocDate } from '../../components/edoc/EdocComponents'
import { EdocPdfPageCanvas } from '../../components/edoc/EdocPdfPageCanvas'
import { EdocProfileCompletionGate } from '../../components/edoc/EdocProfileCompletionGate'
import { edocService } from '../../features/edoc/edocService'
import {
  assignmentRequiresElectronicSignature,
  defaultSignatureMeaningForAction,
  EDOC_SIGNATURE_REASONS,
  isEdocSignatureMeaning,
  isSignatureMeaningLocked,
  signatureReasonOptionLabel,
} from '../../features/edoc/signatureMeanings'
import {
  clampEdocPdfZoom,
  edocPdfRenderWidth,
  EDOC_PDF_ZOOM_MAX,
  EDOC_PDF_ZOOM_MIN,
  EDOC_PDF_ZOOM_STEP,
  formatEdocPdfZoomPercent,
} from '../../features/edoc/pdfPreviewZoom'
import { usePdfDocument } from '../../features/edoc/usePdfDocument'
import { sha256Hex } from '../../features/edoc/fileValidation'
import { useEdocAudit, useEdocInbox } from '../../features/edoc/useEdocData'
import type { EdocAssignableAction } from '../../features/edoc/types'
import { useAuth } from '../../hooks/useAuth'
import { getEdocAccessProfileCompleteness } from '../../lib/edocAccessProfileCompleteness'
import { getSignatoryProfileCompleteness } from '../../lib/signatoryProfileCompleteness'
import { iconSize, iconStroke } from '../../theme/iconSizes'

function assignmentHeading(task: {
  stepKind?: 'signatory' | 'external_auth'
  action: EdocAssignableAction
}): string {
  if (task.stepKind === 'external_auth') return 'Authorize external send'
  if (task.action === 'review') return 'Review and sign'
  if (task.action === 'sign') return 'Sign document'
  if (task.action === 'approve') return 'Approve and sign'
  if (task.action === 'acknowledge') return 'Acknowledge and sign'
  return task.action
}

function formatAuditEventType(eventType: string): string {
  if (eventType === 'signer_note') return 'Optional note'
  return eventType.replace(/_/g, ' ')
}

export function EdocWorkspacePage() {
  const { assignmentId } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { user } = useAuth()
  const inbox = useEdocInbox()
  const task = useMemo(() => inbox.data?.find((candidate) => candidate.id === assignmentId) ?? null, [assignmentId, inbox.data])
  const audit = useEdocAudit(task?.documentId)
  const signatoryProfile = useMemo(() => getSignatoryProfileCompleteness(user), [user])
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [signatureMeaning, setSignatureMeaning] = useState<string>('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null)
  const [pdfContentSha256, setPdfContentSha256] = useState<string | null>(null)
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfReloadKey, setPdfReloadKey] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [renderedSize, setRenderedSize] = useState({ width: 640, height: 820 })
  const { document, pageCount, loading: pdfDocLoading, error: pdfDocError } = usePdfDocument(pdfBytes)

  const usesElectronicSignature = task
    ? assignmentRequiresElectronicSignature(task.action, task.stepKind)
    : false
  const meaningLocked = task ? isSignatureMeaningLocked(task.action) : false

  useEffect(() => {
    if (!task) return
    setSignatureMeaning(defaultSignatureMeaningForAction(task.action))
  }, [task?.id, task?.action])

  useEffect(() => {
    let cancelled = false
    async function loadPdf() {
      if (!task?.documentId) {
        setPdfBytes(null)
        setPdfContentSha256(null)
        setPdfLoadError(null)
        return
      }
      setPdfLoading(true)
      setPdfLoadError(null)
      try {
        const bytes = await edocService.loadDocumentPdfBytes(task.documentId, { forSigning: true })
        // Hash a copy so pdf.js can safely transfer/detach the preview buffer.
        const hash = await sha256Hex(new Blob([bytes.slice(0)], { type: 'application/pdf' }))
        if (!cancelled) {
          setPdfBytes(bytes)
          setPdfContentSha256(hash)
        }
      } catch (err) {
        if (!cancelled) {
          setPdfBytes(null)
          setPdfContentSha256(null)
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
  }, [task?.documentId, pdfReloadKey])

  useEffect(() => {
    if (pageCount > 0 && pageNumber > pageCount) setPageNumber(pageCount)
  }, [pageCount, pageNumber])

  if (!assignmentId) return <EdocPage title="Workspace"><EdocEmpty title="Assignment not found" description="Open a task from My Inbox." /></EdocPage>
  if (inbox.loading) return <EdocPage title="Workspace"><EdocLoading /></EdocPage>
  if (inbox.error) return <EdocPage title="Workspace"><EdocError message={inbox.error} /></EdocPage>
  if (!task) return <EdocPage title="Workspace"><EdocEmpty title="Assignment unavailable" description="This assignment may be complete or outside your authorization." /></EdocPage>

  async function submitAction(action: 'approve' | 'acknowledge' | 'return' | 'reject') {
    if (!task) return
    const accessProfile = getEdocAccessProfileCompleteness(user)
    if (!accessProfile.complete) {
      setError(accessProfile.reminderMessage)
      return
    }
    // Signatory approve/acknowledge must use e-sign (password + PDF stamp).
    if (
      (action === 'approve' || action === 'acknowledge')
      && assignmentRequiresElectronicSignature(task.action, task.stepKind)
    ) {
      setError('This assignment requires an electronic signature. Use Sign document.')
      return
    }
    setError(null)
    if ((action === 'return' || action === 'reject') && !reason.trim()) {
      setError('A reason is required for return or rejection.')
      return
    }
    setSubmitting(true)
    try {
      await edocService.completeAssignment({
        routeId: task.routeId,
        assignmentId: task.id,
        action,
        reason: reason.trim() || undefined,
      })
      if (action === 'reject' || action === 'return') {
        message.success({
          content: action === 'reject'
            ? `Rejection recorded: ${reason.trim()}`
            : `Return recorded: ${reason.trim()}`,
          duration: 5,
        })
      }
      navigate('/edoc/inbox')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete the assignment.')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitSignature(event: FormEvent) {
    event.preventDefault()
    if (!task) return
    setError(null)
    const accessProfile = getEdocAccessProfileCompleteness(user)
    if (!accessProfile.complete) {
      return setError(accessProfile.reminderMessage)
    }
    if (!signatoryProfile.complete) {
      return setError(signatoryProfile.reminderMessage)
    }
    if (!consent) return setError('Explicit consent is required before signing.')
    if (!password) return setError('Re-authentication password is required.')
    if (!pdfBytes || !pdfContentSha256) {
      return setError('Wait for the PDF preview to finish loading, then try again.')
    }
    const resolvedMeaning = meaningLocked
      ? defaultSignatureMeaningForAction(task.action)
      : signatureMeaning.trim()
    if (!resolvedMeaning || !isEdocSignatureMeaning(resolvedMeaning)) {
      return setError('Select a Reason for Signing before completing the electronic signature.')
    }

    setSubmitting(true)
    try {
      const result = await edocService.signAssignment({
        documentId: task.documentId,
        assignmentId: task.id,
        password,
        consent,
        signatureMeaning: resolvedMeaning,
        typedSignature: signatoryProfile.fullName,
        versionSha256: pdfContentSha256,
      })
      if (result.fieldLayout?.adjusted && result.fieldLayout.message) {
        message.info({
          content: result.fieldLayout.message,
          duration: 5,
        })
      }
      navigate('/edoc/inbox')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signing failed.')
    } finally {
      setPassword('')
      setSubmitting(false)
    }
  }

  const previewError = pdfLoadError || pdfDocError
  const heading = assignmentHeading(task)

  return (
    <EdocProfileCompletionGate title="Complete your profile to sign or approve">
    <EdocPage
      title={task.stepKind === 'external_auth' ? 'External authorization' : 'Signing Workspace'}
      description={`${task.documentNumber} · ${task.documentTitle}`}
    >
      {error ? <EdocError message={error} /> : null}
      {task.stepKind === 'external_auth' ? (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          message="External document authorization"
          description="A recipient organization differs from the creator’s. Approve to allow external transmission, or reject with a mandatory reason. The first valid decision closes this request for all Document Controllers."
        />
      ) : null}
      <div className="edoc-workspace edoc-workspace--signing">
        <Card className="panel pdf-panel">
          <div className="document-preview edoc-document-preview">
            {pdfLoading || pdfDocLoading ? <EdocLoading label="Loading PDF…" /> : null}
            {previewError ? (
              <div className="space-y-3">
                <EdocError message={previewError} />
                <Button
                  type="default"
                  onClick={() => {
                    setPdfBytes(null)
                    setPdfReloadKey((n) => n + 1)
                  }}
                >
                  Retry PDF load
                </Button>
              </div>
            ) : null}
            {!pdfLoading && !pdfDocLoading && !previewError && document ? (
              <div className="edoc-doc-preview-stage">
                <div className="edoc-doc-preview-toolbar" role="toolbar" aria-label="PDF page controls">
                  <div className="edoc-doc-preview-toolbar-copy">
                    <span className="edoc-doc-preview-page">
                      Page {pageNumber} / {Math.max(pageCount, 1)}
                    </span>
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
                      <Button size="small" disabled={pageNumber <= 1} onClick={() => setPageNumber((n) => Math.max(1, n - 1))}>
                        Previous
                      </Button>
                      <Button size="small" disabled={pageNumber >= pageCount} onClick={() => setPageNumber((n) => Math.min(pageCount, n + 1))}>
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="edoc-doc-preview-scroll">
                  <div
                    className="edoc-doc-preview-frame"
                    style={{ width: edocPdfRenderWidth(zoom), height: renderedSize.height }}
                  >
                    <EdocPdfPageCanvas
                      document={document}
                      pageNumber={pageNumber}
                      width={edocPdfRenderWidth(zoom)}
                      onRenderedSize={setRenderedSize}
                    />
                  </div>
                </div>
              </div>
            ) : null}
            {!pdfLoading && !pdfDocLoading && !previewError && !document ? (
              <div className="document-page">
                <div className="document-mark">eDoc</div>
                <h2>{task.documentTitle}</h2>
                <p>{task.documentNumber}</p>
                <hr />
                <h3>Secure PDF Preview</h3>
                <p>The PDF will appear here after the original file is available through private storage access.</p>
              </div>
            ) : null}
          </div>
        </Card>

        <aside className="edoc-workspace-side-stack" aria-label="Assignment and audit">
          <Card className="panel side-panel edoc-workspace-assign-panel">
            <header className="edoc-ws-panel-header">
              <div className="edoc-ws-panel-title-row">
                <span className="edoc-ws-icon-badge" aria-hidden>
                  <ClipboardList size={iconSize.sm} strokeWidth={iconStroke} />
                </span>
                <div className="min-w-0">
                  <p className="edoc-ws-eyebrow">Assignment</p>
                  <h2 className="edoc-ws-title">{heading}</h2>
                </div>
              </div>
              <dl className="edoc-ws-meta">
                <div>
                  <dt>
                    <CalendarClock size={14} strokeWidth={iconStroke} aria-hidden />
                    Due
                  </dt>
                  <dd>{formatEdocDate(task.dueAt)}</dd>
                </div>
                <div>
                  <dt>
                    <UserRound size={14} strokeWidth={iconStroke} aria-hidden />
                    Owner
                  </dt>
                  <dd>{task.ownerName}</dd>
                </div>
              </dl>
            </header>

            <section className="edoc-ws-section" aria-labelledby="edoc-ws-disposition-heading">
              <h3 id="edoc-ws-disposition-heading" className="edoc-ws-section-title">Return / reject</h3>
              <label className="edoc-ws-field" htmlFor="edoc-ws-reason">
                <span>Return / reject reason</span>
                <Input.TextArea
                  id="edoc-ws-reason"
                  value={reason}
                  rows={2}
                  placeholder="Required only when returning or rejecting"
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
            </section>

            {usesElectronicSignature ? (
              <form className="edoc-sign-form edoc-ws-sign-form" onSubmit={submitSignature}>
                {task.action === 'review' ? (
                  <Alert
                    type="info"
                    showIcon
                    message="Electronic signature completes this review"
                    description={`Signing confirms you reviewed this document. Reason for Signing is set to “${signatureReasonOptionLabel(defaultSignatureMeaningForAction('review'))}”.`}
                  />
                ) : null}
                {task.action === 'approve' ? (
                  <Alert
                    type="info"
                    showIcon
                    message="Electronic signature completes this approval"
                    description={`Signing confirms you approve this document. Reason for Signing is set to “${signatureReasonOptionLabel(defaultSignatureMeaningForAction('approve'))}”. Re-authentication is required.`}
                  />
                ) : null}
                {task.action === 'acknowledge' ? (
                  <Alert
                    type="info"
                    showIcon
                    message="Electronic signature completes this acknowledgement"
                    description={`Signing confirms acknowledgement. Reason for Signing is set to “${signatureReasonOptionLabel(defaultSignatureMeaningForAction('acknowledge'))}”. Re-authentication is required.`}
                  />
                ) : null}

                {!signatoryProfile.complete ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="Complete your user profile first"
                    description={
                      <span>
                        Name, Position/Title, and Signature fields use your Account Settings profile.
                        Missing: {signatoryProfile.missingLabels.join(', ')}.{' '}
                        <Link to="/account">Open Account Settings</Link>
                      </span>
                    }
                  />
                ) : (
                  <section className="edoc-ws-profile-card" aria-label="Profile signature details">
                    <div className="edoc-ws-profile-card-head">
                      <PenLine size={14} strokeWidth={iconStroke} className="text-[var(--teal)]" aria-hidden />
                      <span>Applied from your profile</span>
                    </div>
                    <dl className="edoc-ws-profile-details">
                      <div>
                        <dt>Name</dt>
                        <dd>{signatoryProfile.fullName}</dd>
                      </div>
                      <div>
                        <dt>Position / Title</dt>
                        <dd>{signatoryProfile.jobTitle}</dd>
                      </div>
                    </dl>
                    {signatoryProfile.signatureDataUrl ? (
                      <div className="edoc-ws-signature-preview">
                        <img
                          src={signatoryProfile.signatureDataUrl}
                          alt="Saved signature from your profile"
                        />
                      </div>
                    ) : null}
                  </section>
                )}

                <label className="edoc-ws-field" htmlFor="edoc-ws-meaning">
                  <span>Reason for Signing</span>
                  <Select
                    id="edoc-ws-meaning"
                    className="w-full"
                    value={signatureMeaning || undefined}
                    placeholder="Select a reason"
                    options={EDOC_SIGNATURE_REASONS.map((reason) => ({
                      value: reason.statement,
                      label: `${reason.label} — ${reason.statement}`,
                    }))}
                    onChange={(value) => setSignatureMeaning(value)}
                    disabled={!signatoryProfile.complete || meaningLocked}
                    aria-required
                    aria-readonly={meaningLocked || undefined}
                  />
                </label>

                <label className="edoc-ws-field" htmlFor="edoc-ws-password">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock size={14} strokeWidth={iconStroke} aria-hidden />
                    Password
                  </span>
                  <Input.Password
                    id="edoc-ws-password"
                    value={password}
                    autoComplete="current-password"
                    placeholder="Re-authenticate to sign"
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={!signatoryProfile.complete}
                  />
                </label>

                <Checkbox
                  className="edoc-ws-consent"
                  checked={consent}
                  disabled={!signatoryProfile.complete}
                  onChange={(event) => setConsent(event.target.checked)}
                >
                  I consent to apply my electronic signature to this exact version.
                </Checkbox>

                <div className="edoc-ws-actions">
                  <Button
                    htmlType="submit"
                    type="primary"
                    block
                    icon={<Check size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                    loading={submitting}
                    disabled={!signatoryProfile.complete || pdfLoading || !pdfContentSha256}
                  >
                    {submitting ? 'Signing…' : 'Sign document'}
                  </Button>
                  <div className="edoc-ws-actions-secondary">
                    <Button
                      icon={<CornerUpLeft size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                      disabled={submitting}
                      onClick={() => void submitAction('return')}
                    >
                      Return
                    </Button>
                    <Button
                      danger
                      icon={<X size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                      disabled={submitting}
                      onClick={() => void submitAction('reject')}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="edoc-ws-actions">
                <Button
                  type="primary"
                  block
                  icon={<ShieldCheck size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                  loading={submitting}
                  onClick={() => void submitAction(task.action as 'approve' | 'acknowledge')}
                >
                  {task.stepKind === 'external_auth' ? 'Approve transmission' : `Complete ${task.action}`}
                </Button>
                <div className="edoc-ws-actions-secondary">
                  <Button
                    icon={<CornerUpLeft size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                    disabled={submitting}
                    onClick={() => void submitAction('return')}
                  >
                    Return
                  </Button>
                  <Button
                    danger
                    icon={<X size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
                    disabled={submitting}
                    onClick={() => void submitAction('reject')}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )}

            <Link to="/edoc/inbox" className="edoc-ws-back-link">
              <Button
                type="text"
                block
                icon={<ArrowLeft size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
              >
                Back to inbox
              </Button>
            </Link>
          </Card>

          <Card className="panel side-panel edoc-workspace-audit-panel">
            <header className="edoc-ws-panel-header edoc-ws-panel-header--compact">
              <div className="edoc-ws-panel-title-row">
                <span className="edoc-ws-icon-badge" aria-hidden>
                  <History size={iconSize.sm} strokeWidth={iconStroke} />
                </span>
                <div className="min-w-0">
                  <p className="edoc-ws-eyebrow">Audit activity</p>
                  <h2 className="edoc-ws-title edoc-ws-title--sm">Document timeline</h2>
                </div>
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
                    <strong className="edoc-ws-audit-type">{formatAuditEventType(event.eventType)}</strong>
                    {event.reason ? <p className="edoc-ws-audit-reason">{event.reason}</p> : null}
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
        </aside>
      </div>
    </EdocPage>
    </EdocProfileCompletionGate>
  )
}
