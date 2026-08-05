import { useEffect, useRef, useState } from 'react'

import {
  STAMP_MODE_LABEL,
  computeFieldScale,
  pickPreferredMode,
  type StampLayoutMode,
} from '../../features/edoc/pdfStampGeometry'

export type EdocSignatureStampPreviewProps = {
  signerName: string
  role?: string
  reason?: string
  email?: string
  signedAtLabel?: string
  recordId?: string
  signatureSrc?: string | null
  /** Editing chrome (signatory tint) — never used on final PDF. */
  editing?: boolean
  className?: string
}

/**
 * Live HTML preview of the professional e-signature stamp.
 * Layout modes (wide / compact / micro) follow field size via container queries
 * with a ResizeObserver fallback for browsers / PDF overlay contexts.
 */
export function EdocSignatureStampPreview({
  signerName,
  role = 'Signatory',
  reason = 'Approved this document',
  email = '',
  signedAtLabel = '—',
  recordId = '',
  signatureSrc = null,
  editing = false,
  className = '',
}: EdocSignatureStampPreviewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [mode, setMode] = useState<StampLayoutMode>('full')
  const [fieldScale, setFieldScale] = useState(1)

  useEffect(() => {
    const node = rootRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const update = () => {
      const width = node.clientWidth
      const height = node.clientHeight
      // Map CSS px ≈ PDF points at typical placement zoom (~0.75 ratio for mode pick).
      const approxPtW = width * 0.75
      const approxPtH = height * 0.75
      const next = pickPreferredMode(approxPtW, approxPtH)
      setMode(next)
      setFieldScale(computeFieldScale(approxPtW, approxPtH))
      node.dataset.layout = next
      node.style.setProperty('--field-scale', String(computeFieldScale(approxPtW, approxPtH)))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={rootRef}
      className={`esignature-stamp ${editing ? 'is-editing' : ''} ${className}`.trim()}
      data-layout={mode}
      style={{ ['--field-scale' as string]: String(fieldScale) }}
      aria-hidden
    >
      <div className="stamp-inner">
        <div className="identity">
          <div className="signature-mark">
            {signatureSrc ? (
              <img src={signatureSrc} alt="" draggable={false} />
            ) : (
              <svg viewBox="0 0 280 70" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path
                  d="M8 48 C40 10, 70 70, 102 34 S150 8, 178 40 220 62, 272 22"
                  fill="none"
                  stroke="#102a43"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
          <div className="signer">
            <p className="signer-name">{signerName}</p>
            <p className="signer-role">{role}</p>
          </div>
        </div>
        <div className="audit">
          <div className="status">Digitally Signed</div>
          <p className="reason">{reason}</p>
          <div className="metadata">
            <span className="datetime">{signedAtLabel}</span>
            {email ? <span className="email">{email}</span> : null}
            {recordId ? <span className="record-id">Record ID: {recordId}</span> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function stampLayoutLabel(mode: StampLayoutMode): string {
  return STAMP_MODE_LABEL[mode]
}
