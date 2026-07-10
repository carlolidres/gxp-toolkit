import type { ReactNode } from 'react'
import { Button, Modal as AntModal } from 'antd'

export function Modal({
  isOpen,
  title,
  children,
  onClose,
  footer,
  className,
}: {
  isOpen: boolean
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  className?: string
}) {
  return (
    <AntModal
      open={isOpen}
      title={title}
      onCancel={onClose}
      footer={footer ?? null}
      className={className}
      destroyOnHidden
      centered
    >
      {children}
    </AntModal>
  )
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onClose,
}: {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <AntModal
      open={isOpen}
      title={title}
      onCancel={onClose}
      centered
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="confirm" danger type="primary" onClick={onConfirm}>
          Confirm
        </Button>,
      ]}
    >
      <p>{message}</p>
    </AntModal>
  )
}
