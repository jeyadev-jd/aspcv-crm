import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { appendEvent } from '../services/timeline'
import { roleForTier } from '../services/approvalEscalation'
import { notifyRoles, createNotification } from '../services/notify'

const router = createSafeRouter()
router.use(authenticate)

const TIER_INDEX: Record<string, number> = { Manager: 0, ProjectHead: 1, BusinessHead: 2, SuperAdmin: 3 }

// Fields on a project an approved edit-request is allowed to write. Anything else in
// the payload is ignored — prevents an arbitrary-column write via a crafted payload.
const PROJECT_EDIT_KEYS = new Set([
  'budget', 'actualBudget', 'progress', 'notes', 'departmentId', 'assignedPMId',
  'purchaseCost', 'manufacturingCost', 'labourCost', 'serviceCost', 'installationCost',
  'warrantyPeriod', 'startDate', 'endDate', 'warrantyStart', 'warrantyEnd', 'status',
])
const PROJECT_DATE_KEYS = new Set(['startDate', 'endDate', 'warrantyStart', 'warrantyEnd'])

function buildProjectUpdate(payload: any): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!payload || typeof payload !== 'object') return out
  for (const [k, v] of Object.entries(payload)) {
    if (!PROJECT_EDIT_KEYS.has(k)) continue
    out[k] = PROJECT_DATE_KEYS.has(k) ? (v ? new Date(v as string) : null) : v
  }
  return out
}

function canActOnTier(roleName: string, tier: number): boolean {
  return roleName === 'SuperAdmin' || roleName === roleForTier(tier)
}

// POST — any authenticated user creates a request
router.post('/', async (req: AuthRequest, res) => {
  const { entityType, entityId, action, payload, reason } = req.body as {
    entityType: string; entityId: string; action: string; payload?: object; reason?: string
  }
  if (!entityType || !entityId || !action) {
    res.status(400).json({ error: 'entityType, entityId, action required' })
    return
  }
  const ar = await prisma.approvalRequest.create({
    data: {
      requestedById: req.user!.id,
      entityType,
      entityId,
      action,
      payload: payload ?? {},
      reason,
      status: 'pending',
    },
    include: { requestedBy: { select: { id: true, name: true, roleName: true } } },
  })
  await appendEvent('approval_request', ar.id, 'created',
    `Approval requested: ${action} on ${entityType}`, req.user!.id)
  // Notify the reviewers who can act on tier 0 (Manager) + SuperAdmin. Escalation
  // service bumps tier later; this alerts the first reviewer immediately.
  await notifyRoles(['SuperAdmin', roleForTier(ar.escalationTier)], {
    type: 'approval', severity: 'warning',
    title: 'Approval needed',
    message: `${ar.requestedBy?.name ?? 'A user'} requested to ${action} a ${entityType}${reason ? ` — ${reason}` : ''}.`,
    entityType, entityId,
  })
  res.status(201).json(ar)
})

// GET /mine — own requests
router.get('/mine', async (req: AuthRequest, res) => {
  const requests = await prisma.approvalRequest.findMany({
    where: { requestedById: req.user!.id },
    include: { reviewedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(requests)
})

// GET — reviewers see requests currently at their tier (SuperAdmin sees all)
router.get('/', requirePermission('approval_request', 'review'), async (req: AuthRequest, res) => {
  const status = req.query.status as string | undefined
  const roleName = req.user!.roleName
  const isSuperAdmin = roleName === 'SuperAdmin'

  const requests = await prisma.approvalRequest.findMany({
    where: {
      status: status ?? 'pending',
      ...(isSuperAdmin ? {} : { escalationTier: TIER_INDEX[roleName] ?? -1 }),
    },
    include: {
      requestedBy: { select: { id: true, name: true, roleName: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  // Resolve a human label for each entity — an approver seeing "cancel a
  // project" against a raw cuid has to leave the page to know what they are
  // approving. Batched per entity type rather than one query per row.
  const entityTitles = await resolveEntityTitles(requests)

  res.json(requests.map(r => ({
    ...r,
    currentReviewerRole: roleForTier(r.escalationTier),
    entityTitle: entityTitles.get(`${r.entityType.toLowerCase()}:${r.entityId}`) ?? null,
  })))
})

/** Maps `entityType:entityId` to a display name for the approval list. */
async function resolveEntityTitles(
  requests: { entityType: string; entityId: string }[]
): Promise<Map<string, string>> {
  const byType = new Map<string, Set<string>>()
  for (const r of requests) {
    const key = r.entityType.toLowerCase()
    if (!byType.has(key)) byType.set(key, new Set())
    byType.get(key)!.add(r.entityId)
  }

  const titles = new Map<string, string>()
  const add = (type: string, id: string, title: string) => titles.set(`${type}:${id}`, title)

  const ids = (t: string) => Array.from(byType.get(t) ?? [])

  await Promise.all([
    ids('project').length
      ? prisma.project.findMany({ where: { id: { in: ids('project') } }, select: { id: true, title: true } })
          .then(rows => rows.forEach(p => add('project', p.id, p.title)))
      : null,
    ids('deal').length
      ? prisma.deal.findMany({ where: { id: { in: ids('deal') } }, select: { id: true, title: true } })
          .then(rows => rows.forEach(d => add('deal', d.id, d.title)))
      : null,
    ids('lead').length
      ? prisma.lead.findMany({ where: { id: { in: ids('lead') } }, select: { id: true, title: true } })
          .then(rows => rows.forEach(l => add('lead', l.id, l.title)))
      : null,
    ids('hr_user').length
      ? prisma.user.findMany({ where: { id: { in: ids('hr_user') } }, select: { id: true, name: true } })
          .then(rows => rows.forEach(u => add('hr_user', u.id, u.name)))
      : null,
    ids('invoice').length
      ? prisma.invoice.findMany({ where: { id: { in: ids('invoice') } }, select: { id: true, number: true } })
          .then(rows => rows.forEach(i => add('invoice', i.id, `#${i.number}`)))
      : null,
    ids('salary_record').length
      ? prisma.salaryRecord.findMany({ where: { id: { in: ids('salary_record') } }, select: { id: true, month: true, year: true, user: { select: { name: true } } } })
          .then(rows => rows.forEach(s => add('salary_record', s.id, `${s.user?.name ?? 'Employee'} — ${s.month}/${s.year}`)))
      : null,
  ])

  return titles
}

// PATCH /:id/approve — gated to whichever role currently holds the tier (or SuperAdmin)
router.patch('/:id/approve', requirePermission('approval_request', 'review'), async (req: AuthRequest, res) => {
  const ar = await prisma.approvalRequest.findUnique({ where: { id: req.params.id as string } })
  if (!ar) { res.status(404).json({ error: 'Not found' }); return }
  if (ar.status !== 'pending') { res.status(400).json({ error: 'Already reviewed' }); return }
  if (!canActOnTier(req.user!.roleName, ar.escalationTier)) {
    res.status(403).json({ error: `This request is currently with ${roleForTier(ar.escalationTier)} — you cannot act on it yet` })
    return
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

  const updated = await prisma.$transaction(async tx => {
    // Conditional update guards against a concurrent double-approve race —
    // only the first request to land wins; the second sees count===0.
    const result = await tx.approvalRequest.updateMany({
      where: { id: req.params.id as string, status: 'pending' },
      data: { status: 'approved', reviewedById: req.user!.id, reviewedAt: new Date(), expiresAt },
    })
    if (result.count === 0) throw new Error('ALREADY_REVIEWED')

    // HR user activation: activate the inactive user (already created with a fixed
    // role/salary by whoever held hr_user:create — this step only flips isActive,
    // it never re-reads role/salary from the approval payload).
    if (ar.entityType === 'hr_user' && ar.action === 'activate') {
      await tx.user.update({ where: { id: ar.entityId }, data: { isActive: true } })
    }

    // Payload-based project edit: apply the exact change that was approved (whitelisted
    // keys only). No PM retry needed, and the applied change is bound to what was reviewed.
    if (ar.entityType === 'project' && ar.action === 'edit') {
      const data = buildProjectUpdate(ar.payload)
      if (Object.keys(data).length > 0) {
        await tx.project.update({ where: { id: ar.entityId }, data })
      }
    }

    // HR-config approvals: apply the exact write HR had queued, now that SuperAdmin signed off.
    if (ar.entityType === 'leave_type' && ar.action === 'create') {
      const p = ar.payload as any
      await tx.leaveType.create({
        data: {
          code: p.code, name: p.name,
          annualQuota: p.annualQuota || 0,
          monthlyAccrual: p.monthlyAccrual || 0,
          maxCarryForward: p.maxCarryForward || 0,
          carryForwardExpiry: p.carryForwardExpiry || 0,
          isEncashable: p.isEncashable || false,
          maxEncashment: p.maxEncashment || 0,
          isPaidLeave: p.isPaidLeave !== false,
          requiresDocument: p.requiresDocument || false,
          sandwichApplicable: p.sandwichApplicable || false,
          halfDayAllowed: p.halfDayAllowed !== false,
          minDaysNotice: p.minDaysNotice || 0,
          maxConsecutiveDays: p.maxConsecutiveDays || 0,
          gender: p.gender || null,
          probationAllowed: p.probationAllowed || false,
        },
      })
    }
    if (ar.entityType === 'late_lop_rule' && ar.action === 'upsert') {
      const p = ar.payload as any
      await tx.lateLopRule.upsert({
        where: { lateCount: p.lateCount },
        update: { lopDays: p.lopDays },
        create: { lateCount: p.lateCount, lopDays: p.lopDays },
      })
    }
    if (ar.entityType === 'salary_component' && ar.action === 'upsert') {
      const p = ar.payload as any
      await tx.salaryComponent.upsert({
        where: { code: p.code },
        update: { name: p.name, type: p.type, calculationType: p.calculationType, percentageOf: p.percentageOf, percentage: p.percentage, fixedAmount: p.fixedAmount, isTaxable: p.isTaxable, isStatutory: p.isStatutory, sortOrder: p.sortOrder },
        create: { code: p.code, name: p.name, type: p.type, calculationType: p.calculationType, percentageOf: p.percentageOf, percentage: p.percentage, fixedAmount: p.fixedAmount, isTaxable: p.isTaxable, isStatutory: p.isStatutory, sortOrder: p.sortOrder },
      })
    }
    if (ar.entityType === 'leave_type' && ar.action === 'edit') {
      const p = ar.payload as any
      const { id, ...data } = p
      await tx.leaveType.update({ where: { id }, data })
    }
    if (ar.entityType === 'leave_type' && ar.action === 'delete') {
      const p = ar.payload as any
      await tx.leaveType.update({ where: { id: p.id }, data: { isActive: false } })
    }
    if (ar.entityType === 'late_lop_rule' && ar.action === 'delete') {
      const p = ar.payload as any
      await tx.lateLopRule.update({ where: { id: p.id }, data: { isActive: false } })
    }
    if (ar.entityType === 'salary_component' && ar.action === 'delete') {
      const p = ar.payload as any
      await tx.salaryComponent.update({ where: { id: p.id }, data: { isActive: false } })
    }
    // Project ownership changes — applied here so the requester doesn't have to
    // re-submit the call after approval.
    if (ar.entityType === 'project' && ar.action === 'assign') {
      const p = ar.payload as any
      await tx.project.update({
        where: { id: ar.entityId },
        data: { assignedPMId: p.assignedPMId ?? null, assignedSEId: p.assignedSEId ?? null },
      })
    }
    if (ar.entityType === 'project' && ar.action === 'add_engineer') {
      const p = ar.payload as any
      await tx.projectEngineer.upsert({
        where: { projectId_userId: { projectId: ar.entityId, userId: p.userId } },
        update: { role: p.role || 'Engineer' },
        create: { projectId: ar.entityId, userId: p.userId, role: p.role || 'Engineer', assignedById: ar.requestedById },
      })
    }
    if (ar.entityType === 'project' && ar.action === 'remove_engineer') {
      const p = ar.payload as any
      await tx.projectEngineer.deleteMany({ where: { projectId: ar.entityId, userId: p.userId } })
    }
    if (ar.entityType === 'project' && ar.action === 'status') {
      const p = ar.payload as any
      if (p?.status) await tx.project.update({ where: { id: ar.entityId }, data: { status: p.status } })
    }
    // 'complete', 'cancel' and 'push_to_inventory' are deliberately not applied
    // here: each runs a multi-step transaction (warranty allocation, inventory
    // reversal, stock creation) that can't be faithfully replayed from a stored
    // payload. Approving them issues a token instead, and the requester re-runs
    // the action — see checkApprovalToken in middleware/permissions.ts.
    // HR corrected a payroll calculation — apply the whitelisted numeric fields
    // and recompute net now that an admin has signed off. Back to 'draft' so it
    // re-enters the normal approve/pay flow.
    if (ar.entityType === 'salary_record' && ar.action === 'edit') {
      const p = ar.payload as any
      const fields = (p?.fields ?? {}) as Record<string, number>
      const rec = await tx.salaryRecord.findUnique({ where: { id: p.recordId } })
      if (rec) {
        const m = { ...rec, ...fields }
        const netSalary = Math.max(0, m.grossSalary - m.pfEmployee - m.esiEmployee - m.tds - m.lateDeduction - m.absentDeduction - m.otherDeduction)
        await tx.salaryRecord.update({ where: { id: p.recordId }, data: { ...fields, netSalary, status: 'draft' } })
      }
    }

    // HR marked a future date Present (event / off-site) — write it once approved.
    if (ar.entityType === 'AttendanceRecord' && ar.action === 'manual_present') {
      const p = ar.payload as any
      const day = new Date(p.date)
      await tx.attendanceRecord.upsert({
        where: { userId_date: { userId: p.userId, date: day } },
        update: { status: 'present', notes: p.notes ?? 'Marked present by HR (approved)' },
        create: { userId: p.userId, date: day, status: 'present', notes: p.notes ?? 'Marked present by HR (approved)' },
      })
    }

    return tx.approvalRequest.findUniqueOrThrow({ where: { id: req.params.id as string } })
  }).catch(e => {
    if (e.message === 'ALREADY_REVIEWED') return null
    throw e
  })
  if (!updated) { res.status(400).json({ error: 'Already reviewed' }); return }

  await appendEvent(ar.entityType, ar.entityId, 'approval_approved',
    `${ar.action} approved`, req.user!.id, { approvalId: ar.id })
  // Notify the original requester their change is live
  await createNotification({
    userIds: [ar.requestedById], type: 'approval', severity: 'info',
    title: 'Your change was approved',
    message: `Your ${ar.action} request on ${ar.entityType} was approved and applied.`,
    entityType: ar.entityType, entityId: ar.entityId,
  })
  res.json(updated)
})

// PATCH /:id/reject — gated to whichever role currently holds the tier (or SuperAdmin)
router.patch('/:id/reject', requirePermission('approval_request', 'review'), async (req: AuthRequest, res) => {
  const { rejectReason } = req.body as { rejectReason?: string }
  const ar = await prisma.approvalRequest.findUnique({ where: { id: req.params.id as string } })
  if (!ar) { res.status(404).json({ error: 'Not found' }); return }
  if (ar.status !== 'pending') { res.status(400).json({ error: 'Already reviewed' }); return }
  if (!canActOnTier(req.user!.roleName, ar.escalationTier)) {
    res.status(403).json({ error: `This request is currently with ${roleForTier(ar.escalationTier)} — you cannot act on it yet` })
    return
  }

  const updated = await prisma.$transaction(async tx => {
    const result = await tx.approvalRequest.updateMany({
      where: { id: req.params.id as string, status: 'pending' },
      data: { status: 'rejected', reviewedById: req.user!.id, reviewedAt: new Date(), rejectReason },
    })
    if (result.count === 0) throw new Error('ALREADY_REVIEWED')

    // Delete the inactive user if rejecting user activation
    if (ar.entityType === 'hr_user' && ar.action === 'activate') {
      await tx.user.delete({ where: { id: ar.entityId } })
    }

    // Rejected payroll correction — un-park the record to its prior status.
    if (ar.entityType === 'salary_record' && ar.action === 'edit') {
      const p = ar.payload as any
      await tx.salaryRecord.update({ where: { id: p.recordId }, data: { status: p.prevStatus || 'draft' } }).catch(() => {})
    }

    return tx.approvalRequest.findUniqueOrThrow({ where: { id: req.params.id as string } })
  }).catch(e => {
    if (e.message === 'ALREADY_REVIEWED') return null
    throw e
  })
  if (!updated) { res.status(400).json({ error: 'Already reviewed' }); return }

  await appendEvent(ar.entityType, ar.entityId, 'approval_rejected',
    `${ar.action} rejected`, req.user!.id, { approvalId: ar.id, rejectReason })
  await createNotification({
    userIds: [ar.requestedById], type: 'approval', severity: 'warning',
    title: 'Your change was rejected',
    message: `Your ${ar.action} request on ${ar.entityType} was rejected${rejectReason ? `: ${rejectReason}` : '.'}`,
    entityType: ar.entityType, entityId: ar.entityId,
  })
  res.json(updated)
})

export default router
