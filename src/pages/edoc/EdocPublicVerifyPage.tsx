import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Input, Upload } from 'antd'
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileDigit,
  FileSearch,
  FileText,
  Hash,
  Loader2,
  PenLine,
  ShieldAlert,
  ShieldCheck,
  Upload as UploadIcon,
  XCircle,
} from 'lucide-react'

import { GxpLogo } from '../../components/brand/GxpLogo'
import { sha256Hex } from '../../features/edoc/fileValidation'
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase'
import { iconSize, iconStroke } from '../../theme/iconSizes'
import '../login-page.css'

type VerifyTone = 'success' | 'warning' | 'danger' | 'info'

type VerifyPayload = {
  ok?: boolean
  status?: string
  tone?: VerifyTone
  message?: string
  documentTitle?: string
  documentNumber?: string
  revision?: number | null
  completedAt?: string
  pageCount?: number | null
  contentPageCount?: number | null
  signatureCount?: number
  signers?: Array<{ signerName?: string; meaning?: string; signedAt?: string }>
  certificateStatus?: string
  finalSha256Prefix?: string | null
  finalSha256?: string | null
  uploadedHashMatch?: boolean | null
}

function statusToneClass(tone?: VerifyTone): string {
  if (tone === 'success') return 'edoc-verify-status--success'
  if (tone === 'warning') return 'edoc-verify-status--warning'
  if (tone === 'danger') return 'edoc-verify-status--danger'
  return 'edoc-verify-status--info'
}

function statusBadgeLabel(tone?: VerifyTone): string {
  if (tone === 'success') return 'Verified'
  if (tone === 'warning') return 'Attention'
  if (tone === 'danger') return 'Failed'
  return 'Result'
}

function StatusGlyph({ tone }: { tone?: VerifyTone }) {
  if (tone === 'success') return <ShieldCheck size={28} strokeWidth={iconStroke} aria-hidden />
  if (tone === 'warning') return <ShieldAlert size={28} strokeWidth={iconStroke} aria-hidden />
  if (tone === 'danger') return <XCircle size={28} strokeWidth={iconStroke} aria-hidden />
  return <FileSearch size={28} strokeWidth={iconStroke} aria-hidden />
}

export function EdocPublicVerifyPage() {
  const { code = '' } = useParams()
  const uploadId = useId()
  const codeFieldId = useId()
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VerifyPayload | null>(null)
  const [manualCode, setManualCode] = useState(code)

  async function runVerify(verificationCode: string, uploadedSha256?: string) {
    if (!isSupabaseConfigured()) {
      setError('Verification service is not configured in this environment.')
      setResult(null)
      return
    }
    const client = getSupabaseClient()
    if (!client) {
      setError('Verification service is unavailable.')
      return
    }
    const { data, error: rpcError } = await client.rpc('edoc_public_verify_certificate', {
      p_verification_code: verificationCode,
      p_uploaded_sha256: uploadedSha256 ?? null,
    })
    if (rpcError) {
      setError(rpcError.message)
      setResult(null)
      return
    }
    setError(null)
    setResult((data ?? null) as VerifyPayload)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      if (!code.trim()) {
        setLoading(false)
        setResult(null)
        return
      }
      await runVerify(code.trim())
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [code])

  async function handleUpload(file: File) {
    if (!code.trim()) {
      setError('Open a verification link that includes the opaque verification identifier.')
      return false
    }
    setComparing(true)
    try {
      const digest = await sha256Hex(file)
      await runVerify(code.trim(), digest)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not hash the uploaded file.')
    } finally {
      setComparing(false)
    }
    return false
  }

  async function handleManualSubmit(event: FormEvent) {
    event.preventDefault()
    const next = manualCode.trim()
    if (!next) return
    window.location.hash = `#/verify/${encodeURIComponent(next)}`
  }

  return (
    <div className="edoc-verify-page">
      <div className="edoc-verify-shell">
        <header className="edoc-verify-top">
          <GxpLogo variant="lockup" showTagline className="edoc-verify-brand" />
          <Link to="/login" className="edoc-verify-back">
            <ArrowLeft size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
            Return to Login
          </Link>
        </header>

        <article className="edoc-verify-card" aria-labelledby="verify-title">
          <div className="edoc-verify-hero">
            <span className="edoc-verify-eyebrow">
              <ShieldCheck size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
              Document verification
            </span>
            <h1 id="verify-title" className="edoc-verify-title">
              Verify electronic signature record
            </h1>
            <p className="edoc-verify-lead">
              This read-only page confirms whether a finalized eDocuSign record matches the opaque verification
              identifier. It does not grant access to document contents or the full audit trail.
            </p>
          </div>

          {!code.trim() ? (
            <form onSubmit={handleManualSubmit} className="edoc-verify-lookup" aria-label="Lookup by verification identifier">
              <label className="edoc-verify-label" htmlFor={codeFieldId}>
                Verification identifier
              </label>
              <div className="edoc-verify-lookup-row">
                <Input
                  id={codeFieldId}
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value)}
                  placeholder="Paste the opaque verification code"
                  aria-label="Verification identifier"
                  size="large"
                />
                <Button type="primary" htmlType="submit" size="large" icon={<FileSearch size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}>
                  Look up
                </Button>
              </div>
            </form>
          ) : null}

          {loading ? (
            <div className="edoc-verify-loading" role="status" aria-live="polite">
              <Loader2 className="edoc-verify-spinner" size={iconSize.md} strokeWidth={iconStroke} aria-hidden />
              <span>Checking verification record…</span>
            </div>
          ) : null}

          {error ? (
            <div className="edoc-verify-banner edoc-verify-banner--danger" role="alert">
              <XCircle size={iconSize.md} strokeWidth={iconStroke} aria-hidden />
              <div>
                <p className="edoc-verify-banner-title">Verification request failed</p>
                <p className="edoc-verify-banner-copy">{error}</p>
              </div>
            </div>
          ) : null}

          {result ? (
            <section className="edoc-verify-result" aria-live="polite">
              <div
                className={`edoc-verify-status ${statusToneClass(result.tone)}`}
                role="status"
                aria-label={`Verification status: ${result.status ?? 'Unknown'}`}
              >
                <div className="edoc-verify-status-main">
                  <span className="edoc-verify-status-icon" aria-hidden>
                    <StatusGlyph tone={result.tone} />
                  </span>
                  <div className="edoc-verify-status-copy min-w-0">
                    <div className="edoc-verify-status-topline">
                      <p className="edoc-verify-status-label">Verification status</p>
                      <span className="edoc-verify-status-badge">{statusBadgeLabel(result.tone)}</span>
                    </div>
                    <h2 className="edoc-verify-status-title">{result.status ?? 'Unknown'}</h2>
                    {result.message ? <p className="edoc-verify-status-message">{result.message}</p> : null}
                  </div>
                </div>
                {result.tone === 'success' ? (
                  <p className="edoc-verify-status-footnote">
                    <CheckCircle2 size={14} strokeWidth={iconStroke} aria-hidden />
                    Signature record located · final digest comparison available below
                  </p>
                ) : null}
              </div>

              <dl className="edoc-verify-meta">
                <div>
                  <dt>
                    <FileText size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
                    Document
                  </dt>
                  <dd>{result.documentTitle ?? '—'}</dd>
                </div>
                <div>
                  <dt>
                    <FileDigit size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
                    Document number
                  </dt>
                  <dd>{result.documentNumber ?? '—'}</dd>
                </div>
                <div>
                  <dt>Revision</dt>
                  <dd>{result.revision ?? '—'}</dd>
                </div>
                <div>
                  <dt>
                    <CalendarClock size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
                    Completed
                  </dt>
                  <dd>{result.completedAt ? new Date(result.completedAt).toLocaleString() : '—'}</dd>
                </div>
                <div>
                  <dt>Pages</dt>
                  <dd>{result.pageCount ?? '—'}</dd>
                </div>
                <div>
                  <dt>
                    <PenLine size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
                    Signatures
                  </dt>
                  <dd>{result.signatureCount ?? 0}</dd>
                </div>
                <div className="edoc-verify-meta--wide">
                  <dt>
                    <Hash size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
                    Final SHA-256 (stored record)
                  </dt>
                  <dd className="edoc-verify-hash">{result.finalSha256Prefix ?? '—'}</dd>
                </div>
              </dl>

              {result.uploadedHashMatch === true ? (
                <div className="edoc-verify-banner edoc-verify-banner--success" role="status">
                  <CheckCircle2 size={iconSize.md} strokeWidth={iconStroke} aria-hidden />
                  <div>
                    <p className="edoc-verify-banner-title">File digest verified</p>
                    <p className="edoc-verify-banner-copy">
                      The uploaded PDF matches the stored final SHA-256 of the finalized system record.
                    </p>
                  </div>
                </div>
              ) : null}

              {result.uploadedHashMatch === false ? (
                <div className="edoc-verify-banner edoc-verify-banner--danger" role="alert">
                  <XCircle size={iconSize.md} strokeWidth={iconStroke} aria-hidden />
                  <div>
                    <p className="edoc-verify-banner-title">Integrity verification failed</p>
                    <p className="edoc-verify-banner-copy">
                      The uploaded PDF digest does not match the finalized system record.
                    </p>
                  </div>
                </div>
              ) : null}

              {(result.signers ?? []).length > 0 ? (
                <section className="edoc-verify-signers" aria-label="Completed signatures">
                  <h2 className="edoc-verify-section-title">Completed signatures</h2>
                  <ol className="edoc-verify-signer-list">
                    {(result.signers ?? []).map((signer, index) => (
                      <li key={`${signer.signerName}-${index}`} className="edoc-verify-signer-item">
                        <span className="edoc-verify-signer-dot" aria-hidden />
                        <div>
                          <p className="edoc-verify-signer-name">{signer.signerName ?? 'Signer'}</p>
                          <p className="edoc-verify-signer-meta">
                            {signer.meaning ?? 'Signed'}
                            {signer.signedAt ? (
                              <>
                                <span aria-hidden> · </span>
                                <time dateTime={signer.signedAt}>{new Date(signer.signedAt).toLocaleString()}</time>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </section>
          ) : null}

          {code.trim() ? (
            <section className="edoc-verify-upload" aria-labelledby={uploadId}>
              <h2 id={uploadId} className="edoc-verify-section-title">
                Confirm downloaded file
              </h2>
              <p className="edoc-verify-section-copy">
                Upload the exact PDF you downloaded. The browser computes SHA-256 locally and compares it to the stored
                final digest. Page Integrity Codes on each page are separate from this final-file hash.
              </p>
              <Upload beforeUpload={handleUpload} maxCount={1} accept="application/pdf,.pdf" showUploadList={false}>
                <button type="button" className="edoc-verify-dropzone" disabled={comparing} aria-busy={comparing}>
                  <span className="edoc-verify-dropzone-icon" aria-hidden>
                    {comparing ? (
                      <Loader2 className="edoc-verify-spinner" size={iconSize.md} strokeWidth={iconStroke} />
                    ) : (
                      <UploadIcon size={iconSize.md} strokeWidth={iconStroke} />
                    )}
                  </span>
                  <span className="edoc-verify-dropzone-title">
                    {comparing ? 'Hashing PDF…' : 'Upload PDF to compare hash'}
                  </span>
                  <span className="edoc-verify-dropzone-hint">PDF only · hash computed in your browser</span>
                </button>
              </Upload>
            </section>
          ) : null}

          <footer className="edoc-verify-footer">
            <p>
              This verification view does not claim FDA approval or certification. Full signing history and document
              contents require authenticated access inside the application.
            </p>
          </footer>
        </article>
      </div>
    </div>
  )
}
