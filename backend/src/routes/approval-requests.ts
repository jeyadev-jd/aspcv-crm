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
  res.json(requests.map(r => ({ ...r, currentReviewerRole: roleForTier(r.escalationTier) })))
})

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
