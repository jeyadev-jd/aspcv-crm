import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Two-warning delete confirmation for bulk actions:
 *   1. A first dialog stating what will be deleted (Cancel / Continue).
 *   2. A second dialog requiring the user to type DELETE to enable the final button.
 * Only after both is `onConfirm` called.
 */
export default function BulkDeleteDialog({
  count,
  entityLabel = 'items',
  isPending,
  onCancel,
  onConfirm,
  archive,
}: {
  count: number
  /** Plural noun for the things being deleted, e.g. "invoices". */
  entityLabel?: string
  isPending?: boolean
  onCancel: () => void
  onConfirm: () => void
  /**
   * Set for soft-delete lists, where rows are archived and can be restored.
   * Keeps the copy honest instead of claiming the action is irreversible.
   */
  archive?: boolean
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [typed, setTyped] = useState('')
  const canDelete = typed.trim().toUpperCase() === 'DELETE'

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 90,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  }
  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, padding: 24, width: 'min(420px, 96vw)' }

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={18} style={{ color: '#DC2626' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#374557', margin: 0 }}>
            {step === 1
              ? `${archive ? 'Archive' : 'Delete'} ${count} ${entityLabel}?`
              : `Confirm ${archive ? 'archiving' : 'permanent deletion'}`}
          </p>
        </div>

        {step === 1 ? (
          <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.5 }}>
            You are about to {archive ? 'archive' : 'delete'} <strong>{count}</strong> {entityLabel}.{' '}
            {archive
              ? 'They are hidden from this list and can be restored later.'
              : 'This cannot be undone.'}
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 12px', lineHeight: 1.5 }}>
              This will {archive ? 'archive' : 'permanently remove'} <strong>{count}</strong> {entityLabel}. Type <strong>DELETE</strong> below to confirm.
            </p>
            <input
              autoFocus
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder="Type DELETE"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #FCA5A5', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 20 }}
            />
          </>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}
          >
            Cancel
          </button>
          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer' }}
            >
              Continue
            </button>
          ) : (
            <button
              onClick={onConfirm}
              disabled={!canDelete || isPending}
              style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: canDelete && !isPending ? '#DC2626' : '#F0A5A5', color: '#fff', cursor: canDelete && !isPending ? 'pointer' : 'default' }}
            >
              {isPending ? 'Deleting…' : `Delete ${count}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
