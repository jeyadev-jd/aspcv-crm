import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
router.use(authenticate)

const MANAGER_ROLES = ['Manager', 'SuperAdmin']
const BIZHEAD_ROLES = ['BusinessHead', 'SuperAdmin']
const ACCOUNTANT_ROLES = ['Accountant', 'SuperAdmin']

async function nextRefNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.materialRequest.count({ where: { refNumber: { startsWith: `MR-${year}-` } } })
  return `MR-${year}-${String(count + 1).padStart(4, '0')}`
}

function deriveStatus(mr: any): string {
  if (mr.rejectedById) return 'rejected'
  if (mr.accountantApprovedAt) return 'paid'
  if (mr.managerApprovedAt && mr.bizHeadApprovedAt) return 'payment_pending'
  if (mr.managerApprovedAt || mr.bizHeadApprovedAt) return 'partial_approved'
  return 'pending'
}

const INCLUDE = {
  requestedBy: { select: { id: true, name: true, role: true } },
  project: { select: { id: true, title: true } },
  items: true,
}

router.get('/', async (req: AuthRequest, res) => {
  const { status, mine } = req.query as Record<string, string>
  const where: any = {}
  if (mine === 'true') where.requestedById = req.user!.id
  if (status) where.status = status
  const requests = await prisma.materialRequest.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' } })
  res.json(requests)
})

router.get('/:id', async (req, res) => {
  const mr = await prisma.materialRequest.findUnique({ where: { id: req.params.id as string }, include: INCLUDE })
  if (!mr) { res.status(404).json({ error: 'Not found' }); return }
  res.json(mr)
})

router.post('/', requirePermission('material_request', 'create'), async (req: AuthRequest, res) => {
  const { projectId, items, notes, totalEstimated } = req.body
  if (!items?.length) { res.status(400).json({ error: 'At least one item required' }); return }

  const refNumber = await nextRefNumber()
  const mr = await prisma.materialRequest.create({
    data: {
      refNumber,
      requestedById: req.user!.id,
      projectId: projectId ?? null,
      notes: notes ?? null,
      totalEstimated: totalEstimated ?? null,
      items: { create: items.map((i: any) => ({
        name: i.name,
        description: i.description ?? null,
        quantity: i.quantity,
        unit: i.unit ?? null,
        estimatedPrice: i.estimatedPrice ?? null,
        componentRefNo: i.componentRefNo ?? null,
      })) },
    },
    include: INCLUDE,
  })
  res.status(201).json(mr)
})

// Approve — role-gated slot (permission check done inline via roleName)
router.patch('/:id/approve', async (req: AuthRequest, res) => {
  const roleName = req.user!.roleName
  const id = req.params.id as string
  const existing = await prisma.materialRequest.findUnique({ where: { id } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.rejectedById) { res.status(400).json({ error: 'Already rejected' }); return }

  const now = new Date()
  let updateData: any = {}

  if (MANAGER_ROLES.includes(roleName) && !existing.managerApprovedAt) {
    updateData = { managerApprovedById: req.user!.id, managerApprovedAt: now }
  } else if (BIZHEAD_ROLES.includes(roleName) && !existing.bizHeadApprovedAt) {
    updateData = { bizHeadApprovedById: req.user!.id, bizHeadApprovedAt: now }
  } else if (ACCOUNTANT_ROLES.includes(roleName) && existing.managerApprovedAt && existing.bizHeadApprovedAt && !existing.accountantApprovedAt) {
    updateData = { accountantApprovedById: req.user!.id, accountantApprovedAt: now }
  } else {
    res.status(400).json({ error: 'No matching approval slot for your role or already approved' })
    return
  }

  const mr = await prisma.materialRequest.findUnique({ where: { id } })
  const merged = { ...mr, ...updateData }
  const newStatus = deriveStatus(merged)
  const updated = await prisma.materialRequest.update({ where: { id }, data: { ...updateData, status: newStatus }, include: INCLUDE })
  res.json(updated)
})

router.patch('/:id/reject', requirePermission('material_request', 'reject'), async (req: AuthRequest, res) => {
  const { reason } = req.body
  const updated = await prisma.materialRequest.update({
    where: { id: req.params.id as string },
    data: { rejectedById: req.user!.id, rejectedAt: new Date(), rejectionReason: reason ?? null, status: 'rejected' },
    include: INCLUDE,
  })
  res.json(updated)
})

export default router
