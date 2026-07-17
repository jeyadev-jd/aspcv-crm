import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission, resolvePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { appendEvent } from '../services/timeline'
import { notifyRoles, createNotification } from '../services/notify'

const router = createSafeRouter()
router.use(authenticate)

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

router.get('/', requirePermission('material_request', 'read_own'), async (req: AuthRequest, res) => {
  const { status, mine, projectId } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
  const where: any = {}
  const canReadAll = await resolvePermission(req.user!.id, req.user!.roleName, 'material_request', 'read_all')
  // Without read_all, a user can only ever see their own requests — `mine=true`
  // is a redundant client hint in that case, not the enforcement mechanism.
  if (mine === 'true' || !canReadAll) where.requestedById = req.user!.id
  if (status) where.status = status
  if (projectId) where.projectId = projectId
  const [requests, total] = await Promise.all([
    prisma.materialRequest.findMany({
      where,
      include: INCLUDE,
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.materialRequest.count({ where }),
  ])
  res.json(paginate(requests, total, pagination))
})

router.get('/:id', requirePermission('material_request', 'read_own'), async (req: AuthRequest, res) => {
  const mr = await prisma.materialRequest.findUnique({ where: { id: req.params.id as string }, include: INCLUDE })
  if (!mr) { res.status(404).json({ error: 'Not found' }); return }
  const canReadAll = await resolvePermission(req.user!.id, req.user!.roleName, 'material_request', 'read_all')
  if (!canReadAll && mr.requestedById !== req.user!.id) { res.status(403).json({ error: 'Insufficient permissions' }); return }
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
  await appendEvent('MaterialRequest', mr.id, 'CREATED', `Material request "${mr.refNumber}" created`, req.user?.id)
  await notifyRoles(['SuperAdmin', 'Manager', 'Accountant'], {
    type: 'material_request',
    severity: 'info',
    title: `New material request ${mr.refNumber}`,
    message: `${mr.requestedBy?.name ?? 'A user'} raised material request ${mr.refNumber}${mr.project ? ` for ${mr.project.title}` : ''} — needs approval.`,
    entityType: 'MaterialRequest',
    entityId: mr.id,
  })
  res.status(201).json(mr)
})

// Approve — role-gated slot, driven by the central RBAC permission table
router.patch('/:id/approve', async (req: AuthRequest, res) => {
  const { id: userId, roleName } = req.user!
  const id = req.params.id as string
  const existing = await prisma.materialRequest.findUnique({ where: { id } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.rejectedById) { res.status(400).json({ error: 'Already rejected' }); return }
  if (existing.accountantApprovedAt) { res.status(400).json({ error: 'Already fully approved and paid' }); return }

  const now = new Date()
  let updateData: any = {}

  const canManagerApprove = await resolvePermission(userId, roleName, 'material_request', 'approve_manager')
  const canBizHeadApprove = await resolvePermission(userId, roleName, 'material_request', 'approve_bizhead')
  const canAccountantApprove = await resolvePermission(userId, roleName, 'material_request', 'approve_accountant')

  if (canManagerApprove && !existing.managerApprovedAt) {
    updateData = { managerApprovedById: userId, managerApprovedAt: now }
  } else if (canBizHeadApprove && existing.managerApprovedAt && !existing.bizHeadApprovedAt) {
    updateData = { bizHeadApprovedById: userId, bizHeadApprovedAt: now }
  } else if (canAccountantApprove && existing.managerApprovedAt && existing.bizHeadApprovedAt && !existing.accountantApprovedAt) {
    updateData = { accountantApprovedById: userId, accountantApprovedAt: now }
  } else {
    res.status(400).json({ error: 'No matching approval slot for your role, wrong order, or already approved' })
    return
  }

  const mrFull = await prisma.materialRequest.findUnique({ where: { id }, include: { items: true, project: true } })
  const merged = { ...mrFull, ...updateData }
  const newStatus = deriveStatus(merged)

  // Approval update + auto-generated purchase invoice + inventory consumption
  // must land together — a crash mid-way must not leave the MR marked paid
  // with no invoice/inventory movement, or vice versa.
  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.materialRequest.update({ where: { id }, data: { ...updateData, status: newStatus }, include: INCLUDE })
    if (newStatus !== 'paid' || !mrFull) return updated

    {
      const year = new Date().getFullYear()
      const pinvCount = await tx.invoice.count({ where: { number: { startsWith: `PINV-${year}-` } } })
      const pinvNumber = `PINV-${year}-${String(pinvCount + 1).padStart(4, '0')}`
      const total = mrFull.totalEstimated ?? mrFull.items.reduce((s, i) => s + (i.estimatedPrice ?? 0) * (i.quantity ?? 1), 0)
      await tx.invoice.create({
        data: {
          number: pinvNumber,
          date: now,
          customer: mrFull.project?.title ?? `MR ${mrFull.refNumber}`,
          status: 'Paid',
          amount: total,
          fromName: 'ASPCV — Aspiration Cleantech Ventures',
          toName: mrFull.project?.title ?? undefined,
          items: {
            create: mrFull.items.map(i => ({
              item: i.name + (i.componentRefNo ? ` (${i.componentRefNo})` : ''),
              hours: i.quantity ?? 1,
              rate: i.estimatedPrice ?? 0,
              amount: (i.estimatedPrice ?? 0) * (i.quantity ?? 1),
            })),
          },
          activities: {
            create: [{ text: `Purchase invoice auto-generated from ${mrFull.refNumber} after full approval` }],
          },
        },
      })

      for (const item of mrFull.items) {
        if (!item.componentRefNo) continue
        const result = await tx.rawComponent.updateMany({
          where: { refNumber: item.componentRefNo, status: 'in_stock' },
          data: { status: 'assigned', assignedToType: 'MaterialRequest', assignedToId: mrFull.id, assignedAt: now },
        })
        if (result.count === 0) {
          // Component not in stock — log but don't block (may be ordered externally)
          console.warn(`MR ${mrFull.refNumber}: component ${item.componentRefNo} not in_stock, skipping consume`)
        }
      }

      // Roll the MR spend up into the linked project's purchase cost. This runs only
      // in the newStatus==='paid' branch (accountant sign-off), which happens exactly
      // once per MR (guarded above by `existing.accountantApprovedAt` → 400), so the
      // increment can't double-count on re-approval.
      if (mrFull.projectId) {
        await tx.project.update({
          where: { id: mrFull.projectId },
          data: { purchaseCost: { increment: total }, totalExpenses: { increment: total } },
        })
      }
    }

    return updated
  })

  await appendEvent('MaterialRequest', updated.id, 'APPROVAL_STEP', `Approval step recorded — status now ${updated.status}`, req.user?.id, updateData)

  if (updated.status === 'payment_pending') {
    // Both manager + bizhead done → accountant needs to release payment
    await notifyRoles(['SuperAdmin', 'Accountant'], {
      type: 'material_request', severity: 'warning',
      title: `${updated.refNumber} ready for payment`,
      message: `Material request ${updated.refNumber} is fully approved and awaiting payment release.`,
      entityType: 'MaterialRequest', entityId: updated.id,
    })
  } else if (updated.status === 'paid') {
    // Notify the requester their MR is paid + fulfilled
    if (existing.requestedById) {
      await createNotification({
        userIds: [existing.requestedById], type: 'material_request', severity: 'info',
        title: `${updated.refNumber} approved & paid`,
        message: `Your material request ${updated.refNumber} is fully approved, paid, and inventory allocated.`,
        entityType: 'MaterialRequest', entityId: updated.id,
      })
    }
  }
  res.json(updated)
})

router.patch('/:id/reject', requirePermission('material_request', 'reject'), async (req: AuthRequest, res) => {
  const { reason } = req.body
  const existing = await prisma.materialRequest.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.accountantApprovedAt) {
    res.status(400).json({ error: 'Cannot reject — this request is already fully approved, paid, and its inventory/invoice has been generated' })
    return
  }
  if (existing.rejectedById) { res.status(400).json({ error: 'Already rejected' }); return }
  const updated = await prisma.materialRequest.update({
    where: { id: req.params.id as string },
    data: { rejectedById: req.user!.id, rejectedAt: new Date(), rejectionReason: reason ?? null, status: 'rejected' },
    include: INCLUDE,
  })
  await appendEvent('MaterialRequest', updated.id, 'REJECTED', `Material request "${updated.refNumber}" rejected`, req.user?.id, { reason })
  if (existing.requestedById) {
    await createNotification({
      userIds: [existing.requestedById], type: 'material_request', severity: 'warning',
      title: `${updated.refNumber} rejected`,
      message: `Your material request ${updated.refNumber} was rejected${reason ? `: ${reason}` : '.'}`,
      entityType: 'MaterialRequest', entityId: updated.id,
    })
  }
  res.json(updated)
})

export default router
