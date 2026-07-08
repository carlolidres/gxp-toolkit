import { useEffect, type ReactNode } from 'react'

export function Modal({ isOpen, title, children, onClose, footer, className }: { isOpen: boolean; title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; className?: string }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  if (!isOpen) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={className ? `modal ${className}` : 'modal'} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close">×</button></header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </section>
    </div>
  )
}

export function ConfirmDialog({ isOpen, title, message, onConfirm, onClose }: { isOpen: boolean; title: string; message: string; onConfirm: () => void; onClose: () => void }) {
  return <Modal isOpen={isOpen} title={title} onClose={onClose} footer={<><button className="button secondary" onClick={onClose}>Cancel</button><button className="button danger" onClick={onConfirm}>Confirm</button></>}><p>{message}</p></Modal>
}

