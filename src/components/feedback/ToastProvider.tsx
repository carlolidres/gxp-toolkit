import { App, message as staticMessage } from 'antd'
import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { ToastContent } from './ToastContent'
import './toast.css'

export type ToastKind = 'info' | 'success' | 'error' | 'warning' | 'loading'

interface ToastContextValue {
  notify: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

type MessageApi = {
  open: (config: {
    type?: ToastKind
    content: ReactNode
    icon?: null
    className?: string
    duration?: number
  }) => void
}

function toastDuration(kind: ToastKind): number {
  if (kind === 'loading') return 0
  if (kind === 'error') return 8
  return 4
}

function showToast(api: MessageApi, text: string, kind: ToastKind = 'info') {
  void api.open({
    type: kind,
    content: <ToastContent text={text} kind={kind} />,
    icon: null,
    className: `gxp-toast-notice gxp-toast-notice--${kind}`,
    duration: toastDuration(kind),
  })
}

function ToastBridge({ children }: { children: ReactNode }) {
  const { message } = App.useApp()

  const value = useMemo<ToastContextValue>(
    () => ({
      notify(text: string, kind: ToastKind = 'info') {
        showToast(message, text, kind)
      },
    }),
    [message],
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

/** Toast provider backed by Ant Design App message API. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return <ToastBridge>{children}</ToastBridge>
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    return {
      notify(text: string, kind: ToastKind = 'info') {
        showToast(staticMessage, text, kind)
      },
    }
  }
  return context
}
