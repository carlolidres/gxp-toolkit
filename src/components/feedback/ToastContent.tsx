import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from 'lucide-react'

import type { ToastKind } from './ToastProvider'
import { parseToastMessage } from './formatToastMessage'

const KIND_META: Record<
  ToastKind,
  { Icon: typeof Info; label: string; live: 'assertive' | 'polite' }
> = {
  error: { Icon: AlertCircle, label: 'Error', live: 'assertive' },
  warning: { Icon: TriangleAlert, label: 'Warning', live: 'assertive' },
  success: { Icon: CheckCircle2, label: 'Success', live: 'polite' },
  info: { Icon: Info, label: 'Information', live: 'polite' },
  loading: { Icon: Loader2, label: 'Loading', live: 'polite' },
}

export function ToastContent({ text, kind }: { text: string; kind: ToastKind }) {
  const model = parseToastMessage(text)
  const { Icon, label, live } = KIND_META[kind]
  const iconClass = kind === 'loading' ? 'gxp-toast__icon gxp-toast__icon--spin' : 'gxp-toast__icon'
  const message = model.variant === 'fieldList' ? model.summary : model.text
  const ariaLabel =
    model.variant === 'fieldList'
      ? `${label}: ${model.summary}. ${model.fields.join(', ')}.`
      : label

  return (
    <div
      className={`gxp-toast gxp-toast--${kind}`}
      role={kind === 'error' || kind === 'warning' ? 'alert' : 'status'}
      aria-live={live}
      aria-label={ariaLabel}
    >
      <Icon className={iconClass} aria-hidden strokeWidth={2.25} />
      <p className="gxp-toast__message">{message}</p>
    </div>
  )
}
