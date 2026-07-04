import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { EdocEmpty, EdocError, EdocLoading, EdocPage, formatEdocDate } from '../../components/edoc/EdocComponents'
import { edocService } from '../../features/edoc/edocService'
import { useEdocAudit, useEdocInbox } from '../../features/edoc/useEdocData'

export function EdocWorkspacePage() {
  const { assignmentId } = useParams()
  const navigate = useNavigate()
  const inbox = useEdocInbox()
  const task = useMemo(() => inbox.data?.find((candidate) => candidate.id === assignmentId) ?? null, [assignmentId, inbox.data])
  const audit = useEdocAudit(task?.documentId)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [password, setPassword] = useState('')
  const [typedSignature, setTypedSignature] = useState('')
  const [signatureMeaning, setSignatureMeaning] = useState('Reviewed and approved')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!assignmentId) return <EdocPage title="Workspace"><EdocEmpty title="Assignment not found" description="Open a task from My Inbox." /></EdocPage>
  if (inbox.loading) return <EdocPage title="Workspace"><EdocLoading /></EdocPage>
  if (inbox.error) return <EdocPage title="Workspace"><EdocError message={inbox.error} /></EdocPage>
  if (!task) return <EdocPage title="Workspace"><EdocEmpty title="Assignment unavailable" description="This assignment may be complete or outside your authorization." /></EdocPage>

  async function submitAction(action: 'review' | 'approve' | 'acknowledge' | 'return' | 'reject') {
    if (!task) return
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
    if (!consent) return setError('Explicit consent is required before signing.')
    if (!typedSignature.trim()) return setError('Typed signature is required.')
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
        typedSignature,
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

  return (
    <EdocPage title="Signing Workspace" description={`${task.documentNumber} · ${task.documentTitle}`}>
      {error ? <EdocError message={error} /> : null}
      <div className="edoc-workspace">
        <aside className="panel side-panel">
          <span className="eyebrow">Assignment</span>
          <h2>{task.action}</h2>
          <p><strong>Due:</strong> {formatEdocDate(task.dueAt)}</p>
          <p><strong>Owner:</strong> {task.ownerName}</p>
          <label>Comment<textarea value={comment} onChange={(event) => setComment(event.target.value)} /></label>
          <label>Return/reject reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          {task.action === 'sign' ? (
            <form className="edoc-sign-form" onSubmit={submitSignature}>
              <label>Signature meaning<input value={signatureMeaning} onChange={(event) => setSignatureMeaning(event.target.value)} /></label>
              <label>Typed signature<input value={typedSignature} onChange={(event) => setTypedSignature(event.target.value)} /></label>
              <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <label className="edoc-inline-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I consent to apply my electronic signature to this exact version.</label>
              <button className="button primary" type="submit" disabled={submitting}>{submitting ? 'Signing...' : 'Sign document'}</button>
            </form>
          ) : (
            <div className="decision-panel">
              <button className="button primary" type="button" disabled={submitting} onClick={() => void submitAction(task.action as 'review' | 'approve' | 'acknowledge')}>
                Complete {task.action}
              </button>
              <button className="button warning" type="button" disabled={submitting} onClick={() => void submitAction('return')}>Return</button>
              <button className="button danger" type="button" disabled={submitting} onClick={() => void submitAction('reject')}>Reject</button>
            </div>
          )}
          <Link className="button secondary" to="/edoc/inbox">Back to inbox</Link>
        </aside>
        <section className="panel pdf-panel">
          <div className="document-preview edoc-document-preview">
            <div className="document-page">
              <div className="document-mark">eDoc</div>
              <h2>{task.documentTitle}</h2>
              <p>{task.documentNumber}</p>
              <hr />
              <h3>Secure PDF Preview</h3>
              <p>Live deployments request short-lived private Supabase Storage URLs through `edoc-file-access`.</p>
              <span className="page-number">1 / 1</span>
            </div>
          </div>
        </section>
        <section className="panel side-panel">
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
        </section>
      </div>
    </EdocPage>
  )
}
