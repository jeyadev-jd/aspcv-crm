import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission, resolvePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { appendEvent } from '../services/timeline'
import { notifyRoles, createNotification } from '../services/notify'
import { nextMRNumber } from '../lib/sequences'

const router = createSafeRouter()
router.use(authenticate)

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
  items: { include: { vendor: { select: { id: true, name: true } } } },
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

  const refNumber = await nextMRNumber()
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
        // Line price comes from the chosen dealer; estimatedPrice stays as the
        // requester's own figure when no vendor was picked.
        estimatedPrice: i.estimatedPrice ?? (i.unitPrice != null ? i.unitPrice * (i.quantity ?? 1) : null),
        componentRefNo: i.componentRefNo ?? null,
        vendorId: i.vendorId || null,
        unitPrice: i.unitPrice != null ? Number(i.unitPrice) : null,
        referenceNumber: i.referenceNumber ?? null,
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

  // Approval update + auto-generated draft PO + inventory consumption
  // must land together — a crash mid-way must not leave the MR marked paid
  // with no PO/inventory movement, or vice versa.
  const txResult = await prisma.$transaction(async (tx) => {
    let generatedPO: { id: string; refNumber: string } | null = null
    const updated = await tx.materialRequest.update({ where: { id }, data: { ...updateData, status: newStatus }, include: INCLUDE })
    if (newStatus !== 'paid' || !mrFull) return { updated, generatedPO }

    {
      // Items already in stock get assigned directly to the MR — no procurement needed.
      // Items with no componentRefNo (not in stock) need to be purchased — these go
      // into a draft Purchase Order for Procurement to action, per business rule:
      // "Approved material requests must generate a draft PO, not a paid invoice."
      const inStockItems = mrFull.items.filter(i => i.componentRefNo)
      const toProcureItems = mrFull.items.filter(i => !i.componentRefNo)

      for (const item of inStockItems) {
        const result = await tx.rawComponent.updateMany({
          where: { refNumber: item.componentRefNo!, status: 'in_stock' },
          data: { status: 'assigned', assignedToType: 'MaterialRequest', assignedToId: mrFull.id, assignedAt: now },
        })
        if (result.count === 0) {
          console.warn(`MR ${mrFull.refNumber}: component ${item.componentRefNo} not in_stock, skipping consume`)
        }
      }

      if (toProcureItems.length > 0) {
        // A request can name a different dealer per line, so group by vendor and
        // raise one draft PO each. Lines with no vendor fall into a single
        // unassigned PO for Procurement to source.
        const byVendor = new Map<string, typeof toProcureItems>()
        for (const item of toProcureItems) {
          const key = item.vendorId ?? ''
          if (!byVendor.has(key)) byVendor.set(key, [])
          byVendor.get(key)!.push(item)
        }

        let poCount = await tx.purchaseOrder.count()
        for (const [vendorId, lines] of byVendor) {
          poCount++
          const poRefNumber = `PO-${String(poCount).padStart(4, '0')}`
          // Prefer the dealer's quoted unit price; fall back to the requester's estimate.
          const lineTotal = (i: (typeof lines)[number]) =>
            (i.unitPrice ?? i.estimatedPrice ?? 0) * (i.quantity ?? 1)
          const subtotal = lines.reduce((s, i) => s + lineTotal(i), 0)
          const taxPercent = 18
          const totalAmount = subtotal * (1 + taxPercent / 100)

          const vendor = vendorId
            ? await tx.dealer.findUnique({
                where: { id: vendorId },
                select: { name: true, email: true, phone: true, address: true },
              })
            : null

          const po = await tx.purchaseOrder.create({
            data: {
              refNumber: poRefNumber,
              projectId: mrFull.projectId,
              supplierId: vendorId || null,
              supplierName: vendor?.name ?? 'TBD — Procurement to assign supplier',
              supplierEmail: vendor?.email ?? null,
              supplierPhone: vendor?.phone ?? null,
              supplierAddress: vendor?.address ?? null,
              status: 'Draft',
              subtotal,
              taxPercent,
              totalAmount,
              notes: `Auto-generated from Material Request ${mrFull.refNumber}${mrFull.project ? ` for project ${mrFull.project.title}` : ''}`,
              createdById: userId,
              items: {
                create: lines.map(i => ({
                  itemName: i.name,
                  description: i.referenceNumber
                    ? `${i.description ?? ''} (Ref: ${i.referenceNumber})`.trim()
                    : i.description,
                  quantity: i.quantity ?? 1,
                  unit: i.unit,
                  unitPrice: i.unitPrice ?? i.estimatedPrice ?? 0,
                  amount: lineTotal(i),
                })),
              },
            },
          })
          // Report the first PO raised; the notification text stays singular.
          if (!generatedPO) generatedPO = { id: po.id, refNumber: po.refNumber }
        }
      }

      // Roll the MR spend up into the linked project's purchase cost. This runs only
      // in the newStatus==='paid' branch (accountant sign-off), which happens exactly
      // once per MR (guarded above by `existing.accountantApprovedAt` → 400), so the
      // increment can't double-count on re-approval.
      const total = mrFull.totalEstimated ?? mrFull.items.reduce(
        (s, i) => s + (i.unitPrice ?? i.estimatedPrice ?? 0) * (i.quantity ?? 1), 0
      )
      if (mrFull.projectId) {
        await tx.project.update({
          where: { id: mrFull.projectId },
          data: { purchaseCost: { increment: total }, totalExpenses: { increment: total } },
        })
      }
    }

    return { updated, generatedPO }
  })

  const { updated, generatedPO } = txResult

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
    const poNote = generatedPO ? ` Purchase order ${generatedPO.refNumber} was created in Procurement for items not in stock.` : ' All items were fulfilled from existing stock.'
    // Notify the requester their MR is fully approved + fulfilled
    if (existing.requestedById) {
      await createNotification({
        userIds: [existing.requestedById], type: 'material_request', severity: 'info',
        title: `${updated.refNumber} approved`,
        message: `Your material request ${updated.refNumber} is fully approved and inventory allocated.${poNote}`,
        entityType: 'MaterialRequest', entityId: updated.id,
      })
    }
    if (generatedPO) {
      await notifyRoles(['SuperAdmin', 'Manager'], {
        type: 'purchase_order', severity: 'info',
        title: `Draft PO ${generatedPO.refNumber} needs supplier assignment`,
        message: `Purchase order ${generatedPO.refNumber} was auto-generated from material request ${updated.refNumber}. Assign a supplier to proceed.`,
        entityType: 'PurchaseOrder', entityId: generatedPO.id,
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
