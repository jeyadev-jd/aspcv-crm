import { Response } from 'express'

// Models that carry an `isActive` soft-delete flag. Kept as an explicit list
// (not schema introspection) so adding a new soft-deletable model is a
// deliberate, visible change here rather than something that silently
// changes behavior for every model with a matching field name.
export const SOFT_DELETE_MODELS = [
  'designation', 'industry', 'department', 'user', 'company', 'contact',
  'lead', 'deal', 'project', 'installation', 'attendanceLocation', 'dealer',
  'roleDefinition', 'supportTicket',
] as const

export type SoftDeleteModel = typeof SOFT_DELETE_MODELS[number]

// List-endpoint filter: excludes inactive rows unless includeInactive=true
// AND the caller is authorized (checked by the route before calling this).
export function activeFilter(includeInactive: boolean): { isActive?: true } {
  return includeInactive ? {} : { isActive: true }
}

// Detail-endpoint guard: given a record (or null), enforces the 404-unless-
// includeInactive rule. Returns true if the caller should continue handling
// the record, false if a response was already sent and the route must return.
export function enforceActiveOr404(
  record: { isActive?: boolean | null } | null,
  includeInactive: boolean,
  res: Response,
): boolean {
  if (!record) {
    res.status(404).json({ error: 'Not found' })
    return false
  }
  if (record.isActive === false && !includeInactive) {
    res.status(404).json({ error: 'Not found' })
    return false
  }
  return true
}

// Update-endpoint guard: rejects writes to an already-inactive record.
// Restoring (isActive: false -> true) must go through the dedicated
// /:id/restore endpoint, not a generic PATCH, so this always blocks PATCH/PUT
// on an inactive row regardless of what the request body contains.
export function rejectIfInactive(
  record: { isActive?: boolean | null } | null,
  res: Response,
): boolean {
  if (!record) {
    res.status(404).json({ error: 'Not found' })
    return false
  }
  if (record.isActive === false) {
    res.status(400).json({ error: 'Cannot modify an inactive (archived) record — restore it first' })
    return false
  }
  return true
}
