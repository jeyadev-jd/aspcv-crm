import type { Response } from 'express'

/**
 * Optimistic concurrency control for update routes.
 *
 * Without this every PUT/PATCH is a blind overwrite: two users open the same
 * record, both save, and the second silently discards the first's work. The
 * client echoes back the `updatedAt` it loaded; if the stored row has moved on
 * since, we reject with 409 and hand back the current server state so the UI
 * can show what changed rather than just losing the edit.
 *
 * Passing no `expectedUpdatedAt` skips the check — keeps older clients and
 * internal callers working rather than hard-failing them.
 */
export interface ConflictInfo<T> {
  conflict: true
  current: T
}

export function checkVersion<T extends { updatedAt: Date }>(
  stored: T,
  expectedUpdatedAt: unknown
): ConflictInfo<T> | null {
  if (expectedUpdatedAt === undefined || expectedUpdatedAt === null || expectedUpdatedAt === '') {
    return null
  }

  const expected = new Date(String(expectedUpdatedAt))
  if (Number.isNaN(expected.getTime())) return null // unparseable — treat as absent

  // Compare at second granularity: JSON round-tripping can shave sub-millisecond
  // precision, which would otherwise produce phantom conflicts.
  const storedMs = Math.floor(stored.updatedAt.getTime() / 1000)
  const expectedMs = Math.floor(expected.getTime() / 1000)
  if (storedMs === expectedMs) return null

  return { conflict: true, current: stored }
}

/** Sends the standard 409 body. Returns true so callers can `if (...) return`. */
export function sendConflict<T extends { updatedAt: Date }>(
  res: Response,
  current: T,
  entityLabel: string,
  editorName?: string | null
): true {
  res.status(409).json({
    error: 'version_conflict',
    message: editorName
      ? `This ${entityLabel} was updated by ${editorName} while you were editing.`
      : `This ${entityLabel} was updated by someone else while you were editing.`,
    updatedAt: current.updatedAt,
    current,
  })
  return true
}
