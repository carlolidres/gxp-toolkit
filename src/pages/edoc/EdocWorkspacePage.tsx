import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Card, Input } from 'antd'
import { Check, CornerUpLeft, X } from 'lucide-react'

import { EdocEmpty, EdocError, EdocLoading, EdocPage, formatEdocDate } from '../../components/edoc/EdocComponents'
import { EdocPdfPageCanvas } from '../../components/edoc/EdocPdfPageCanvas'
import { EdocProfileCompletionGate } from '../../components/edoc/EdocProfileCompletionGate'
import { edocService } from '../../features/edoc/edocService'
import { usePdfDocument } from '../../features/edoc/usePdfDocument'
import { useEdocAudit, useEdocInbox } from '../../features/edoc/useEdocData'
import { useAuth } from '../../hooks/useAuth'
import { getEdocAccessProfileCompleteness } from '../../lib/edocAccessProfileCompleteness'
import { getSignatoryProfileCompleteness } from '../../lib/signatoryProfileCompleteness'

export function EdocWorkspacePage() {
  const { assignmentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const inbox = useEdocInbox()
  const task = useMemo(() => inbox.data?.find((candidate) => candidate.id === assignmentId) ?? null, [assignmentId, inbox.data])
  const audit = useEdocAudit(task?.documentId)
  const signatoryProfile = useMemo(() => getSignatoryProfileCompleteness(user), [user])
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [password, setPassword] = useState('')
  const [signatureMeaning, setSignatureMeaning] = useState('Reviewed and approved')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null)
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [renderedSize, setRenderedSize] = useState({ width: 640, height: 820 })
  const { document, pageCount, loading: pdfDocLoading, error: pdfDocError } = usePdfDocument(pdfBytes)

  useEffect(() => {
    let cancelled = false
    async function loadPdf() {
      if (!task?.documentId) {
        setPdfBytes(null)
        setPdfLoadError(null)
        return
      }
      setPdfLoading(true)
      setPdfLoadError(null)
      try {
        const bytes = await edocService.loadDocumentPdfBytes(task.documentId)
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
  }, [task?.documentId])

  useEffect(() => {
    if (pageCount > 0 && pageNumber > pageCount) setPageNumber(pageCount)
  }, [pageCount, pageNumber])

  if (!assignmentId) return <EdocPage title="Workspace"><EdocEmpty title="Assignment not found" description="Open a task from My Inbox." /></EdocPage>
  if (inbox.loading) return <EdocPage title="Workspace"><EdocLoading /></EdocPage>
  if (inbox.error) return <EdocPage title="Workspace"><EdocError message={inbox.error} /></EdocPage>
  if (!task) return <EdocPage title="Workspace"><EdocEmpty title="Assignment unavailable" description="This assignment may be complete or outside your authorization." /></EdocPage>

  async function submitAction(action: 'review' | 'approve' | 'acknowledge' | 'return' | 'reject') {
    if (!task) return
    const accessProfile = getEdocAccessProfileCompleteness(user)
    if (!accessProfile.complete) {
      setError(accessProfile.reminderMessage)
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
        reason,
        comment,
      })
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
    if (!task.versionSha256) return setError('The current document version hash is unavailable.')

    setSubmitting(true)
    try {
      await edocService.signAssignment({
        documentId: task.documentId,
        assignmentId: task.id,
        password,
        consent,
        signatureMeaning,
        typedSignature: signatoryProfile.fullName,
        versionSha256: task.versionSha256,
      })
      navigate('/edoc/inbox')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signing failed.')
    } finally {
      setPassword('')
      setSubmitting(false)
    }
  }

  const previewError = pdfLoadError || pdfDocError

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
      <div className="edoc-workspace">
        <Card className="panel side-panel">
          <span className="eyebrow">Assignment</span>
          <h2>{task.stepKind === 'external_auth' ? 'Authorize external send' : task.action}</h2>
          <p><strong>Due:</strong> {formatEdocDate(task.dueAt)}</p>
          <p><strong>Owner:</strong> {task.ownerName}</p>
          <label>Comment<Input.TextArea value={comment} onChange={(event) => setComment(event.target.value)} /></label>
          <label>Return/reject reason<Input.TextArea value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          {task.action === 'sign' ? (
            <form className="edoc-sign-form" onSubmit={submitSignature}>
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
                <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                  <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Applied from your profile
                  </p>
                  <p className="m-0 text-sm text-[var(--navy)]">
                    <strong>Name:</strong> {signatoryProfile.fullName}
                  </p>
                  <p className="m-0 text-sm text-[var(--navy)]">
                    <strong>Position/Title:</strong> {signatoryProfile.jobTitle}
                  </p>
                  {signatoryProfile.signatureDataUrl ? (
                    <img
                      src={signatoryProfile.signatureDataUrl}
                      alt="Saved signature from your profile"
                      className="max-h-16 max-w-full object-contain"
                    />
                  ) : null}
                </div>
              )}
              <label>Signature meaning<Input value={signatureMeaning} onChange={(event) => setSignatureMeaning(event.target.value)} disabled={!signatoryProfile.complete} /></label>
              <label>Password<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={!signatoryProfile.complete} /></label>
              <label className="edoc-inline-check">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={!signatoryProfile.complete}
                  onChange={(event) => setConsent(event.target.checked)}
                />{' '}
                I consent to apply my electronic signature to this exact version.
              </label>
              <Button
                htmlType="submit"
                type="primary"
                icon={<Check size={15} />}
                loading={submitting}
                disabled={!signatoryProfile.complete}
              >
                {submitting ? 'Signing...' : 'Sign document'}
              </Button>
            </form>
          ) : (
            <div className="decision-panel">
              <Button type="primary" icon={<Check size={15} />} loading={submitting} onClick={() => void submitAction(task.action as 'review' | 'approve' | 'acknowledge')}>
                Complete {task.action}
              </Button>
              <Button icon={<CornerUpLeft size={15} />} disabled={submitting} onClick={() => void submitAction('return')}>Return</Button>
              <Button danger icon={<X size={15} />} disabled={submitting} onClick={() => void submitAction('reject')}>Reject</Button>
            </div>
          )}
          <Link to="/edoc/inbox"><Button>Back to inbox</Button></Link>
        </Card>
        <Card className="panel pdf-panel">
          <div className="document-preview edoc-document-preview">
            {pdfLoading || pdfDocLoading ? <EdocLoading label="Loading PDF…" /> : null}
            {previewError ? <EdocError message={previewError} /> : null}
            {!pdfLoading && !pdfDocLoading && !previewError && document ? (
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
                    document={document}
                    pageNumber={pageNumber}
                    width={640}
                    onRenderedSize={setRenderedSize}
                  />
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
    </EdocProfileCompletionGate>
  )
}
