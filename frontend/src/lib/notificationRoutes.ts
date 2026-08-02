/**
 * Where clicking a notification should land, keyed by `entityType`.
 *
 * The backend writes entityType with inconsistent casing ('Project' and
 * 'project' both occur), so every lookup must lowercase the key first.
 * Entity types deliberately absent (e.g. 'System') have nowhere sensible to
 * go — those notifications stay put rather than dumping the user elsewhere.
 */
export const NOTIF_ROUTES: Record<string, string> = {
  project: '/projects',
  lead: '/leads',
  deal: '/deals',
  company: '/accounts',
  contact: '/contacts',
  invoice: '/invoices',
  approvalrequest: '/approvals',
  task: '/tasks',
  quotation: '/projects',
  purchaseorder: '/projects',
  materialrequest: '/warehouse',
  installation: '/projects',
  servicerecord: '/service',
  servicerequest: '/service',
  rawcomponent: '/raw-components',
  dealer: '/dealers',
  expense: '/budget',
  cashflow: '/budget',
  revenuetarget: '/reports',
  attendancerecord: '/hr',
  discussion: '/projects',
}
