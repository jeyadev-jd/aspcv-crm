import { toast } from './toast'

export interface VersionConflict {
  error: 'version_conflict'
  message: string
  updatedAt: string
  current: Record<string, unknown>
}

/** True when an axios error is a 409 raised by the concurrency check. */
export function isVersionConflict(e: unknown): boolean {
  const err = e as { response?: { status?: number; data?: { error?: string } } }
  return err?.response?.status === 409 && err.response.data?.error === 'version_conflict'
}

export function conflictData(e: unknown): VersionConflict | null {
  if (!isVersionConflict(e)) return null
  return (e as { response: { data: VersionConflict } }).response.data
}

/**
 * Standard handling for a rejected stale save. Keeps the user's form as-is —
 * discarding their input on conflict would trade one lost edit for another —
 * and offers to pull in the newer server copy instead.
 *
 * Returns true when the error was a conflict and has been handled.
 */
export function handleVersionConflict(e: unknown, onReload?: () => void): boolean {
  const data = conflictData(e)
  if (!data) return false

  const when = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null
  const msg = when ? `${data.message} (at ${when})` : data.message

  toast.warning(msg, onReload ? {
    action: { label: 'Reload theirs', onClick: onReload },
    duration: 12000, // long enough to read the names and decide
  } : { duration: 8000 })

  return true
}
