interface Props {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
}

// Styled replacement for window.confirm() — use for destructive actions (delete, deactivate,
// reject) where a native browser confirm() looks out of place next to the rest of the UI.
export default function ConfirmDialog({
  title, message = 'This action cannot be undone.', confirmLabel = 'Delete', cancelLabel = 'Cancel',
  danger = true, onConfirm, onCancel, isPending = false,
}: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>{title}</p>
        <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 20 }}>{message}</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: danger ? '#FF5353' : '#5D78FF', color: '#fff', cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}
          >
            {isPending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
