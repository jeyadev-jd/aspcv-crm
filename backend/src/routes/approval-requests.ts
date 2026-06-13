import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { appendEvent } from '../services/timeline'

const router = Router()
router.use(authenticate)

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

// GET — SuperAdmin sees all (default: pending)
router.get('/', requirePermission('approval_request', 'review'), async (req: AuthRequest, res) => {
  const status = req.query.status as string | undefined
  const requests = await prisma.approvalRequest.findMany({
    where: { status: status ?? 'pending' },
    include: {
      requestedBy: { select: { id: true, name: true, roleName: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(requests)
})

// PATCH /:id/approve — SuperAdmin only
router.patch('/:id/approve', requirePermission('approval_request', 'review'), async (req: AuthRequest, res) => {
  const ar = await prisma.approvalRequest.findUnique({ where: { id: req.params.id as string } })
  if (!ar) { res.status(404).json({ error: 'Not found' }); return }
  if (ar.status !== 'pending') { res.status(400).json({ error: 'Already reviewed' }); return }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

  // HR user activation: activate the inactive user
  if (ar.entityType === 'hr_user' && ar.action === 'activate') {
    await prisma.user.update({
      where: { id: ar.entityId },
      data: { isActive: true },
    })
  }

  // HR user creation (legacy): create the user immediately on approval
  if (ar.entityType === 'hr_user' && ar.action === 'user_create') {
    const bcrypt = await import('bcrypt')
    const payload = ar.payload as Record<string, unknown>
    const { password, dateOfBirth, joiningDate, ...rest } = payload as {
      password?: string; dateOfBirth?: string; joiningDate?: string; [k: string]: unknown
    }
    await prisma.user.create({
      data: {
        ...(rest as any),
        roleName: (rest.roleName ?? rest.role ?? 'Viewer') as string,
        passwordHash: await bcrypt.hash((password as string) || 'ChangeMe123!', 10),
        ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
        ...(joiningDate && { joiningDate: new Date(joiningDate) }),
        createdById: ar.requestedById,
      },
    })
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: req.params.id as string },
    data: { status: 'approved', reviewedById: req.user!.id, reviewedAt: new Date(), expiresAt },
  })
  await appendEvent(ar.entityType, ar.entityId, 'approval_approved',
    `${ar.action} approved`, req.user!.id, { approvalId: ar.id })
  res.json(updated)
})

// PATCH /:id/reject — SuperAdmin only
router.patch('/:id/reject', requirePermission('approval_request', 'review'), async (req: AuthRequest, res) => {
  const { rejectReason } = req.body as { rejectReason?: string }
  const ar = await prisma.approvalRequest.findUnique({ where: { id: req.params.id as string } })
  if (!ar) { res.status(404).json({ error: 'Not found' }); return }
  if (ar.status !== 'pending') { res.status(400).json({ error: 'Already reviewed' }); return }

  // Delete the inactive user if rejecting user activation
  if (ar.entityType === 'hr_user' && ar.action === 'activate') {
    await prisma.user.delete({ where: { id: ar.entityId } })
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: req.params.id as string },
    data: { status: 'rejected', reviewedById: req.user!.id, reviewedAt: new Date(), rejectReason },
  })
  await appendEvent(ar.entityType, ar.entityId, 'approval_rejected',
    `${ar.action} rejected`, req.user!.id, { approvalId: ar.id, rejectReason })
  res.json(updated)
})

export default router
