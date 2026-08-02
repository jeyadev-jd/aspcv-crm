import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  /** Menu width in px — used to keep it inside the right edge of the viewport. */
  width?: number
}

/**
 * Row "⋮" action menu that portals to document.body and flips upward when
 * there isn't room below. A plain `position: absolute; top: 100%` menu (the
 * old pattern) clips against the last few rows of any table, since it's
 * positioned relative to the row rather than the viewport.
 */
export default function RowMenu({ open, onOpenChange, children, width = 180 }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; openUp: boolean } | null>(null)

  useLayoutEffect(() => {
    if (!open || !btnRef.current) { setPos(null); return }
    const r = btnRef.current.getBoundingClientRect()
    // Estimate menu height from its actual rendered size once mounted; until
    // then, guess conservatively so the first paint still lands on-screen.
    const estimatedHeight = 260
    const spaceBelow = window.innerHeight - r.bottom
    const openUp = spaceBelow < estimatedHeight && r.top > spaceBelow
    setPos({
      top: openUp ? r.top - 4 : r.bottom + 4,
      left: Math.min(r.right - width, window.innerWidth - width - 8),
      openUp,
    })
  }, [open, width])

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }} onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={e => { e.stopPropagation(); onOpenChange(!open) }}
        style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
      >
        <MoreHorizontal size={15} />
      </button>
      {open && pos && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => onOpenChange(false)} />
          <div
            style={{
              position: 'fixed',
              top: pos.openUp ? undefined : pos.top,
              bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
              left: Math.max(8, pos.left),
              width,
              background: '#fff', borderRadius: 8, border: '1px solid #F0F1F5',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden',
              maxHeight: '70vh', overflowY: 'auto', padding: '4px 0',
            }}
          >
            {children}
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}
