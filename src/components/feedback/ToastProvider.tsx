import { App, message as staticMessage } from 'antd'
import { createContext, useContext, useMemo, type ReactNode } from 'react'

interface ToastContextValue {
  notify: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function ToastBridge({ children }: { children: ReactNode }) {
  const { message } = App.useApp()

  const value = useMemo<ToastContextValue>(
    () => ({
      notify(text: string) {
        void message.info(text)
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
    // Fallback for rare cases outside provider during tests.
    return {
      notify(text: string) {
        void staticMessage.info(text)
      },
    }
  }
  return context
}
