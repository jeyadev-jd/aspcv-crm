import { X } from 'lucide-react'
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import type React from 'react'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: number
  zIndex?: number
}

export default function Modal({ title, onClose, children, footer, maxWidth = 520, zIndex = 60 }: Props) {
  const titleId = useId()

  // Escape closes the dialog, matching native <dialog> behaviour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Rendered through a portal at document.body so the dialog sits in a
  // predictable spot in the DOM/accessibility tree regardless of where the
  // trigger lives in the component hierarchy.
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ background: '#fff', borderRadius: 16, width: `min(${maxWidth}px, 96vw)`, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #F0F1F5', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <p id={titleId} style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>{title}</p>
          <button onClick={onClose} aria-label="Close dialog" style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
        {footer && (
          <div style={{ display: 'flex', gap: 12, padding: '16px 24px', borderTop: '1px solid #F0F1F5' }}>{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
