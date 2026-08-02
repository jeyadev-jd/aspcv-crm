import { Trash2, X } from 'lucide-react'

/**
 * Floating bar shown when one or more rows are selected in a list. Offers a
 * bulk delete (which the parent wires to the two-step BulkDeleteDialog) and a
 * clear-selection action.
 */
export default function BulkActionBar({
  count,
  entityLabel = 'items',
  onDelete,
  onClear,
  canDelete = true,
}: {
  count: number
  entityLabel?: string
  onDelete: () => void
  onClear: () => void
  canDelete?: boolean
}) {
  if (count === 0) return null
  return (
    <div style={{
      position: 'sticky', bottom: 16, zIndex: 20, margin: '16px auto 0', width: 'fit-content',
      display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
      background: '#1A1D23', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
        {count} {entityLabel} selected
      </span>
      {canDelete && (
        <button
          onClick={onDelete}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer' }}
        >
          <Trash2 size={13} /> Delete
        </button>
      )}
      <button
        onClick={onClear}
        title="Clear selection"
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer' }}
      >
        <X size={13} /> Clear
      </button>
    </div>
  )
}
