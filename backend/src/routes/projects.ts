import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { projectSchema, stripUnsentDefaults } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { requirePermission, resolvePermission, checkApprovalToken, consumeApprovalToken } from '../middleware/permissions'
import { getScopeFilter } from '../middleware/scoping'
import { checkProjectOverrun, notifyRoles } from '../services/notify'
import { parsePagination, paginate } from '../lib/pagination'
import { activeFilter, enforceActiveOr404, rejectIfInactive } from '../lib/softDelete'
import { syncCalendarEvent } from '../services/calendarSync'

const router = createSafeRouter()
router.use(authenticate)

router.get('/', requirePermission('project', 'read_own'), async (req: AuthRequest, res) => {
  const { status, companyId, dealId, includeInactive } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
  const scope = await getScopeFilter(req.user!.id, req.user!.roleName, 'project')
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'project', 'delete')
  const where = {
    ...scope,
    ...activeFilter(includeInactive === 'true' && canManage),
    ...(status && { status: status as any }),
    ...(companyId && { companyId }),
    ...(dealId && { dealId }),
    ...(pagination.search && { title: { contains: pagination.search, mode: 'insensitive' as const } }),
  }
  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
        installations: { where: { isActive: true }, select: { id: true, status: true } },
        department: { select: { id: true, name: true } },
        assignedPM: { select: { id: true, name: true, role: true } },
        assignedSE: { select: { id: true, name: true, role: true } },
      },
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.project.count({ where }),
  ])
  res.json(paginate(projects, total, pagination))
})

router.get('/:id', requirePermission('project', 'read_own'), async (req: AuthRequest, res) => {
  const { includeInactive } = req.query as Record<string, string>
  const project = await prisma.project.findUnique({
    where: { id: req.params.id as string },
    include: {
      company: { include: { contacts: { where: { isActive: true } } } },
      deal: { select: { id: true, title: true } },
      installations: { where: { isActive: true } },
      department: { select: { id: true, name: true } },
      assignedPM: { select: { id: true, name: true, role: true } },
      assignedSE: { select: { id: true, name: true, role: true } },
    },
  })
  const canReadAll = await resolvePermission(req.user!.id, req.user!.roleName, 'project', 'read_all')
  if (!canReadAll && project && project.createdById !== req.user!.id) { res.status(403).json({ error: 'Insufficient permissions' }); return }
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'project', 'delete')
  if (!enforceActiveOr404(project, includeInactive === 'true' && canManage, res)) return
  res.json(project)
})

router.post('/', requirePermission('project', 'create'), async (req: AuthRequest, res) => {
  const data = projectSchema.parse(req.body)
  const project = await prisma.project.create({
    data: {
      ...data,
      createdById: req.user!.id,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
    include: { company: { select: { id: true, name: true } } },
  })
  await appendEvent('Project', project.id, 'CREATED', `Project "${project.title}" created`, req.user?.id)
  res.status(201).json(project)
})

router.put('/:id', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  const existingProject = await prisma.project.findUnique({ where: { id: req.params.id as string } })
  if (!rejectIfInactive(existingProject, res)) return

  const data = stripUnsentDefaults(projectSchema.partial().parse(req.body), req.body)

  // Approval gate: SuperAdmin edits apply immediately; everyone else needs an
  // approved ApprovalRequest token (payload applied on approve, see approval-requests.ts).
  const { allowed, approvalId } = await checkApprovalToken(req.user!.id, req.user!.roleName, 'project', req.params.id as string, 'edit')
  if (!allowed) {
    res.status(403).json({ error: 'approval_required', entityType: 'project', entityId: req.params.id, action: 'edit', payload: data })
    return
  }

  const project = await prisma.project.update({
    where: { id: req.params.id as string },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      warrantyStart: data.warrantyStart ? new Date(data.warrantyStart) : undefined,
      warrantyEnd: data.warrantyEnd ? new Date(data.warrantyEnd) : undefined,
    },
    include: { company: { select: { id: true, name: true } } },
  })
  if (approvalId) await consumeApprovalToken(approvalId)
  await appendEvent('Project', project.id, 'UPDATED', `Project "${project.title}" updated`, req.user?.id)
  if (data.warrantyEnd && project.warrantyEnd) {
    await syncCalendarEvent({
      entityType: 'Project', entityId: project.id, category: 'WarrantyExpiry',
      title: `Warranty expires: ${project.title}`, date: project.warrantyEnd,
      description: `Warranty period ends for project "${project.title}"`, actorId: req.user?.id,
    })
  }
  // tiered budget-overrun alert → admin / project head / business head
  await checkProjectOverrun(project.id)
  res.json(project)
})

const VALID_PROJECT_STATUSES = ['Planning', 'Engineering', 'Procurement', 'Manufacturing', 'Installation', 'Testing', 'Completed', 'Cancelled', 'Active', 'OnHold']

router.patch('/:id/status', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  const { status } = req.body as { status: string }
  if (!VALID_PROJECT_STATUSES.includes(status)) return res.status(400).json({ error: `Invalid status: ${status}` })
  if (status === 'Completed') return res.status(400).json({ error: 'Use POST /:id/complete to mark a project Completed — it locks records and creates the warranty/service record.' })
  if (status === 'Cancelled') return res.status(400).json({ error: 'Use POST /:id/cancel to cancel a project — it returns allocated inventory.' })

  const existing = await prisma.project.findUnique({ where: { id: req.params.id as string } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (existing.isLocked) return res.status(400).json({ error: 'Project is locked (already completed) and cannot change status' })

  const project = await prisma.project.update({
    where: { id: req.params.id as string },
    data: { status: status as any },
  })
  await appendEvent('Project', project.id, 'STATUS_CHANGED', `Status changed to ${status}`, req.user?.id)
  res.json(project)
})

// Complete project: lock records, create service record, move to completed
router.post('/:id/complete', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id as string },
      include: { company: true },
    })
    if (!project) return res.status(404).json({ error: 'Not found' })

    const warrantyStart = new Date()
    const warrantyEnd = new Date()
    if (project.warrantyPeriod) warrantyEnd.setMonth(warrantyEnd.getMonth() + project.warrantyPeriod)

    const updatedProject = await prisma.$transaction(async tx => {
      const updatedProject = await tx.project.update({
        where: { id: req.params.id as string },
        data: {
          status: 'Completed',
          isLocked: true,
          completedAt: new Date(),
          warrantyStart,
          warrantyEnd: project.warrantyPeriod ? warrantyEnd : undefined,
        },
      })

      // Auto-create service record
      const existing = await tx.serviceRecord.findUnique({ where: { projectId: req.params.id as string } })
      if (!existing) {
        await tx.serviceRecord.create({
          data: {
            projectId: req.params.id as string,
            companyId: project.companyId,
            installationDate: new Date(),
            warrantyStart,
            warrantyEnd: project.warrantyPeriod ? warrantyEnd : undefined,
            warrantyMonths: project.warrantyPeriod,
          },
        })
      }

      return updatedProject
    })

    await appendEvent('Project', project.id, 'COMPLETED', `Project "${project.title}" completed`, req.user?.id)
    if (updatedProject.warrantyEnd) {
      await syncCalendarEvent({
        entityType: 'Project', entityId: project.id, category: 'WarrantyExpiry',
        title: `Warranty expires: ${project.title}`, date: updatedProject.warrantyEnd,
        description: `Warranty period ends for project "${project.title}"`, actorId: req.user?.id,
      })
    }
    res.json(updatedProject)
  } catch (e) { res.status(500).json({ error: 'Failed to complete project' }) }
})

// Cancel project with inventory return logic
router.post('/:id/cancel', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body
    const project = await prisma.project.findUnique({
      where: { id: req.params.id as string },
      include: {
        workOrders: true,
        inventoryAllocations: { include: { rawComponent: true } },
      },
    }) as any
    if (!project) return res.status(404).json({ error: 'Not found' })

    const hasFinishedWO = (project.workOrders as any[]).some((wo: any) => wo.status === 'Finished')
    const hasActiveWO = (project.workOrders as any[]).some((wo: any) => ['InProduction', 'Assembly', 'Testing'].includes(wo.status))

    await prisma.$transaction(async (tx) => {
      // Return allocated (unconsumed) materials back to raw materials
      for (const alloc of project.inventoryAllocations) {
        await tx.rawComponent.update({
          where: { id: alloc.rawComponentId },
          data: { quantity: (alloc.rawComponent.quantity || 0) + alloc.quantity },
        })
        await tx.componentMovement.create({
          data: {
            componentId: alloc.rawComponentId, type: 'returned',
            toEntityType: 'inventory', toEntityId: 'raw_materials',
            toEntityName: 'Raw Materials', performedById: req.user?.id,
            notes: `Project ${project.title} cancelled`,
          },
        })
      }
      await tx.inventoryAllocation.deleteMany({ where: { projectId: req.params.id as string } })

      if (hasFinishedWO) {
        await tx.rawComponent.updateMany({
          where: { materialConsumptions: { some: { workOrder: { projectId: req.params.id as string } } } },
          data: { category: 'FinishedGoods', status: 'finished_goods', assignedToType: 'FinishedGoods', assignedToId: project.id },
        })
        await tx.workOrder.updateMany({
          where: { projectId: req.params.id as string, status: { not: 'Finished' } },
          data: { status: 'Cancelled' },
        })
        await tx.project.update({
          where: { id: req.params.id as string },
          data: { status: 'Cancelled', notes: `${project.notes || ''}\nCancelled after manufacturing: ${reason || ''}` },
        })
      } else if (hasActiveWO) {
        await tx.rawComponent.updateMany({
          where: { materialConsumptions: { some: { workOrder: { projectId: req.params.id as string } } } },
          data: { category: 'SemiFinished', status: 'semi_finished', assignedToType: 'SemiFinished', assignedToId: project.id },
        })
        await tx.workOrder.updateMany({
          where: { projectId: req.params.id as string },
          data: { status: 'Cancelled' },
        })
        await tx.project.update({
          where: { id: req.params.id as string },
          data: { status: 'Cancelled', notes: `${project.notes || ''}\nCancelled during manufacturing: ${reason || ''}` },
        })
      } else {
        await tx.project.update({
          where: { id: req.params.id as string },
          data: { status: 'Cancelled', notes: `${project.notes || ''}\nCancelled before manufacturing: ${reason || ''}` },
        })
      }
    })

    await appendEvent('Project', project.id, 'CANCELLED', `Project "${project.title}" cancelled. ${reason || ''}`, req.user?.id)
    res.json({ ok: true })
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to cancel project' }) }
})

// Assign PM / SE
router.patch('/:id/assign', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  const { assignedPMId, assignedSEId } = req.body
  const project = await prisma.project.update({
    where: { id: req.params.id as string },
    data: { assignedPMId, assignedSEId },
    include: { assignedPM: { select: { name: true } }, assignedSE: { select: { name: true } } },
  })
  await appendEvent('Project', project.id, 'ASSIGNED',
    `Assigned PM: ${project.assignedPM?.name ?? 'none'}, Engineer: ${project.assignedSE?.name ?? 'none'}`, req.user?.id)
  res.json(project)
})

// Get full ERP data for project
router.get('/:id/erp', async (req: AuthRequest, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id as string },
      include: {
        company: true,
        salesOrder: { include: { handoverDoc: true } },
        boms: { include: { items: true, purchaseOrders: { include: { items: true, goodsReceipts: true } } } },
        workOrders: { include: { logs: true, materialConsumptions: { include: { rawComponent: true } } } },
        inventoryAllocations: { include: { rawComponent: true } },
        serviceRecord: { include: { serviceRequests: true } },
        materialRequests: { include: { items: true } },
        installations: true,
      },
    })
    if (!project) return res.status(404).json({ error: 'Not found' })
    res.json(project)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch project ERP data' }) }
})

router.delete('/:id', requirePermission('project', 'delete'), async (req: AuthRequest, res) => {
  const existing = await prisma.project.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.isActive === false) { res.json({ success: true }); return } // idempotent
  const project = await prisma.project.update({
    where: { id: req.params.id as string },
    data: { isActive: false },
  })
  await appendEvent('Project', project.id, 'DELETED', `Project "${project.title}" archived`, req.user?.id)
  res.json({ success: true })
})

router.post('/:id/restore', requirePermission('project', 'delete'), async (req: AuthRequest, res) => {
  const existing = await prisma.project.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const project = await prisma.project.update({ where: { id: req.params.id as string }, data: { isActive: true } })
  await appendEvent('Project', project.id, 'RESTORED', `Project "${project.title}" restored`, req.user?.id)
  res.json(project)
})

// ─── Billing ──────────────────────────────────────────────────────────────────
// All numbers are derived from real, already-maintained data: the five cost columns
// (kept in sync by goods-receipts/work-orders/service-records/material-requests/expenses),
// and the project's linked invoices/payments. Nothing here is fabricated or hardcoded.

router.get('/:id/billing', requirePermission('project', 'read_all'), async (req: AuthRequest, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id as string } })
  if (!project) { res.status(404).json({ error: 'Not found' }); return }

  const otherExpenses = await prisma.expense.aggregate({
    where: { entityType: 'project', entityId: project.id },
    _sum: { amount: true },
  })
  const purchaseCost = project.purchaseCost || 0
  const manufacturingCost = project.manufacturingCost || 0
  const labourCost = project.labourCost || 0
  const serviceCost = project.serviceCost || 0
  const installationCost = project.installationCost || 0
  const otherExpenseTotal = otherExpenses._sum.amount || 0
  const totalCost = purchaseCost + manufacturingCost + labourCost + serviceCost + installationCost + otherExpenseTotal

  const invoices = await prisma.invoice.findMany({
    where: { projectId: project.id, status: { not: 'Cancelled' } },
    include: { items: true, payments: true },
    orderBy: { createdAt: 'desc' },
  })
  const revenue = invoices.reduce((s, i) => s + i.amount, 0)
  const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0)
  const outstanding = revenue - totalPaid
  const uninvoiced = Math.max(0, totalCost - revenue)
  const profit = revenue - totalCost
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0

  res.json({
    costs: { purchaseCost, manufacturingCost, labourCost, serviceCost, installationCost, otherExpenses: otherExpenseTotal, totalCost },
    revenue, totalPaid, outstanding, uninvoiced, profit, margin,
    invoices,
  })
})

router.post('/:id/generate-invoice', requirePermission('invoice', 'create'), async (req: AuthRequest, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id as string }, include: { company: true } })
  if (!project) { res.status(404).json({ error: 'Not found' }); return }

  const otherExpenses = await prisma.expense.aggregate({
    where: { entityType: 'project', entityId: project.id },
    _sum: { amount: true },
  })
  const buckets = [
    { label: 'Purchase', value: project.purchaseCost || 0 },
    { label: 'Manufacturing', value: project.manufacturingCost || 0 },
    { label: 'Labour', value: project.labourCost || 0 },
    { label: 'Service', value: project.serviceCost || 0 },
    { label: 'Other Expenses', value: otherExpenses._sum.amount || 0 },
  ]
  const totalCost = buckets.reduce((s, b) => s + b.value, 0) + (project.installationCost || 0)

  const existingInvoices = await prisma.invoice.findMany({ where: { projectId: project.id, status: { not: 'Cancelled' } } })
  const alreadyInvoiced = existingInvoices.reduce((s, i) => s + i.amount, 0)
  const uninvoiced = totalCost - alreadyInvoiced

  if (uninvoiced <= 0) { res.status(400).json({ error: 'Nothing to bill — all project costs are already invoiced' }); return }

  // Scale each bucket proportionally to the uninvoiced remainder so re-generating after
  // a partial invoice only bills the new delta, never duplicating what's already billed.
  const scale = totalCost > 0 ? uninvoiced / totalCost : 0
  const items = buckets
    .filter(b => b.value > 0)
    .map(b => ({ item: b.label, amount: Math.round(b.value * scale) }))
  if (project.installationCost) items.push({ item: 'Installation', amount: Math.round(project.installationCost * scale) })

  const year = new Date().getFullYear()
  const count = await prisma.invoice.count({ where: { number: { startsWith: `INV-${year}-` } } })
  const number = `INV-${year}-${String(count + 1).padStart(4, '0')}`

  const invoice = await prisma.invoice.create({
    data: {
      number, date: new Date(), customer: project.company?.name ?? project.title,
      status: 'Draft', amount: Math.round(uninvoiced),
      projectId: project.id,
      fromName: 'ASPCV — Aspiration Cleantech Ventures',
      toName: project.company?.name ?? undefined,
      items: { create: items },
      activities: { create: [{ text: `Draft invoice generated from project "${project.title}" billable costs` }] },
    },
    include: { items: true, activities: true, payments: true },
  })
  await appendEvent('Invoice', invoice.id, 'CREATED', `Draft invoice #${invoice.number} generated from project "${project.title}"`, req.user?.id)
  await appendEvent('Project', project.id, 'INVOICE_GENERATED', `Invoice #${invoice.number} generated for ₹${invoice.amount.toLocaleString()}`, req.user?.id)
  await notifyRoles(['SuperAdmin', 'Accountant'], {
    type: 'invoice', severity: 'info',
    title: `Draft invoice #${invoice.number} generated`,
    message: `A draft invoice for ₹${invoice.amount.toLocaleString()} was generated from project "${project.title}".`,
    entityType: 'Invoice', entityId: invoice.id,
  })
  res.status(201).json(invoice)
})

export default router
