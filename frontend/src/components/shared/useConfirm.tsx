import { useState, useCallback } from 'react'
import ConfirmDialog from './ConfirmDialog'

interface ConfirmRequest {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  /** Seconds to hold the confirm button disabled — for irreversible actions. */
  countdownSeconds?: number
  onConfirm: () => void | Promise<void>
}

/**
 * One styled confirm per page, so row actions do not each need their own
 * piece of state. Replaces native `confirm()` — a browser dialog next to the
 * rest of the UI reads as a different product.
 *
 *   const { confirm, confirmDialog } = useConfirm()
 *   <button onClick={() => confirm({ title: 'Delete this?', onConfirm: () => del.mutate(id) })} />
 *   {confirmDialog}
 */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const [pending, setPending] = useState(false)

  const confirm = useCallback((req: ConfirmRequest) => setRequest(req), [])

  const confirmDialog = request ? (
    <ConfirmDialog
      title={request.title}
      message={request.message ?? 'This action cannot be undone.'}
      confirmLabel={request.confirmLabel}
      cancelLabel={request.cancelLabel}
      danger={request.danger}
      countdownSeconds={request.countdownSeconds}
      isPending={pending}
      onCancel={() => { if (!pending) setRequest(null) }}
      onConfirm={async () => {
        setPending(true)
        try {
          await request.onConfirm()
          setRequest(null)
        } finally {
          setPending(false)
        }
      }}
    />
  ) : null

  return { confirm, confirmDialog }
}
