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
import { z } from 'zod'
import { checkVersion, sendConflict } from '../lib/concurrency'

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
        capacityUnit: { select: { id: true, name: true } },
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
      engineers: { include: { user: { select: { id: true, name: true, role: true } } } },
      capacityUnit: { select: { id: true, name: true } },
    },
  })
  // Resolved before the access check so a missing project reads as 404 for
  // everyone — otherwise a non-admin gets 403 for ids that don't exist, which
  // leaks which project ids are real.
  if (!project) { res.status(404).json({ error: 'Not found' }); return }

  const canReadAll = await resolvePermission(req.user!.id, req.user!.roleName, 'project', 'read_all')
  const isAssigned = (
    project.createdById === req.user!.id ||
    project.assignedPMId === req.user!.id ||
    project.assignedSEId === req.user!.id ||
    project.engineers.some(e => e.userId === req.user!.id)
  )
  if (!canReadAll && !isAssigned) { res.status(403).json({ error: 'Insufficient permissions' }); return }
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'project', 'delete')
  if (!enforceActiveOr404(project, includeInactive === 'true' && canManage, res)) return
  res.json(project)
})

router.post('/', requirePermission('project', 'create'), async (req: AuthRequest, res) => {
  const data = projectSchema.parse(req.body)

  // Inherit the technical spec from the originating Deal unless the caller
  // supplied its own, so capacity and temperature survive the handover.
  const linkedDeal = data.dealId
    ? await prisma.deal.findUnique({
        where: { id: data.dealId },
        select: { capacityValue: true, capacityUnitId: true, tempRangeMin: true, tempRangeMax: true },
      })
    : null
  const inheritedSpec = linkedDeal ? {
    capacityValue: data.capacityValue ?? linkedDeal.capacityValue,
    capacityUnitId: data.capacityUnitId ?? linkedDeal.capacityUnitId,
    tempRangeMin: data.tempRangeMin ?? linkedDeal.tempRangeMin,
    tempRangeMax: data.tempRangeMax ?? linkedDeal.tempRangeMax,
  } : {}

  const project = await prisma.project.create({
    data: {
      ...data,
      ...inheritedSpec,
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

  // Reject a stale write before doing anything else, so a losing edit never
  // consumes an approval token or fires a timeline event.
  const stale = checkVersion(existingProject!, req.body.expectedUpdatedAt)
  if (stale) { sendConflict(res, stale.current, 'project'); return }

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

  // Same gate as a normal edit — moving a project through its lifecycle is a
  // reportable change, so it shouldn't be a way around the edit approval.
  const { allowed, approvalId } = await checkApprovalToken(
    req.user!.id, req.user!.roleName, 'project', req.params.id as string, 'status'
  )
  if (!allowed) {
    return res.status(403).json({
      error: 'approval_required', entityType: 'project', entityId: req.params.id,
      action: 'status', payload: { status },
    })
  }

  const project = await prisma.project.update({
    where: { id: req.params.id as string },
    data: { status: status as any },
  })
  if (approvalId) await consumeApprovalToken(approvalId)
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

    // A project can only close once its warranty terms are pinned down — the
    // frontend collects these in the WarrantyAllocationModal.
    const body = req.body as {
      warrantyStartDate?: string
      warrantyEndDate?: string
      warrantyBudgetAllocated?: number | string
    }
    if (!body.warrantyStartDate || !body.warrantyEndDate) {
      return res.status(400).json({ error: 'warrantyStartDate and warrantyEndDate are required to complete a project' })
    }
    const warrantyStart = new Date(body.warrantyStartDate)
    const warrantyEnd = new Date(body.warrantyEndDate)
    if (Number.isNaN(warrantyStart.getTime()) || Number.isNaN(warrantyEnd.getTime())) {
      return res.status(400).json({ error: 'warrantyStartDate and warrantyEndDate must be valid dates' })
    }
    if (warrantyEnd <= warrantyStart) {
      return res.status(400).json({ error: 'warrantyEndDate must be after warrantyStartDate' })
    }

    if (body.warrantyBudgetAllocated == null) {
      return res.status(400).json({ error: 'warrantyBudgetAllocated is required to complete a project' })
    }
    const warrantyBudget = Number(body.warrantyBudgetAllocated)
    if (!Number.isFinite(warrantyBudget) || warrantyBudget < 0) {
      return res.status(400).json({ error: 'warrantyBudgetAllocated must be a non-negative number' })
    }
    // Checked unconditionally: the previous `&& remaining > 0` guard let any
    // amount through once the remaining budget hit zero, which is exactly the
    // case the limit exists to catch.
    const remaining = project.remainingBudget ?? 0
    if (warrantyBudget > remaining) {
      return res.status(400).json({ error: `Warranty budget ₹${warrantyBudget} exceeds remaining project budget ₹${remaining}` })
    }

    // Completion locks the project and carves warranty budget out of it — both
    // effectively irreversible, so it needs the same oversight as an edit.
    // Checked after validation so an unapprovable request fails on its merits first.
    const { allowed, approvalId } = await checkApprovalToken(
      req.user!.id, req.user!.roleName, 'project', req.params.id as string, 'complete'
    )
    if (!allowed) {
      return res.status(403).json({
        error: 'approval_required', entityType: 'project', entityId: req.params.id,
        action: 'complete',
        payload: { warrantyStartDate: body.warrantyStartDate, warrantyEndDate: body.warrantyEndDate, warrantyBudgetAllocated: warrantyBudget },
      })
    }

    const warrantyMonths = Math.max(
      1,
      Math.round((warrantyEnd.getTime() - warrantyStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    )

    const updatedProject = await prisma.$transaction(async tx => {
      const updatedProject = await tx.project.update({
        where: { id: req.params.id as string },
        data: {
          status: 'Completed',
          isLocked: true,
          completedAt: new Date(),
          warrantyStart,
          warrantyEnd,
          warrantyPeriod: warrantyMonths,
          warrantyBudgetAllocated: warrantyBudget,
          remainingBudget: Math.max(0, remaining - warrantyBudget),
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
            warrantyEnd,
            warrantyMonths,
            serviceCost: 0,
          },
        })
      }

      return updatedProject
    })

    if (approvalId) await consumeApprovalToken(approvalId)
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

    // Cancellation reverses inventory allocations and reclassifies components —
    // not something a single operator should be able to do unreviewed.
    const { allowed, approvalId } = await checkApprovalToken(
      req.user!.id, req.user!.roleName, 'project', req.params.id as string, 'cancel'
    )
    if (!allowed) {
      return res.status(403).json({
        error: 'approval_required', entityType: 'project', entityId: req.params.id,
        action: 'cancel', payload: { reason },
      })
    }

    const hasFinishedWO = (project.workOrders as any[]).some((wo: any) => wo.status === 'Finished')
    const hasActiveWO = (project.workOrders as any[]).some((wo: any) => ['InProduction', 'Assembly', 'Testing'].includes(wo.status))

    await prisma.$transaction(async (tx) => {
      // Return allocated (unconsumed) materials back to raw materials.
      // `increment` rather than read-then-write, so a concurrent allocation can't
      // be clobbered by a stale quantity read.
      const allocs = project.inventoryAllocations as any[]
      await Promise.all(allocs.map(alloc =>
        tx.rawComponent.update({
          where: { id: alloc.rawComponentId },
          data: { quantity: { increment: alloc.quantity } },
        })
      ))

      if (allocs.length > 0) {
        await tx.componentMovement.createMany({
          data: allocs.map(alloc => ({
            componentId: alloc.rawComponentId, type: 'returned',
            toEntityType: 'inventory', toEntityId: 'raw_materials',
            toEntityName: 'Raw Materials', performedById: req.user?.id,
            notes: `Project ${project.title} cancelled`,
          })),
        })

        // The allocation rows are the audit trail for what this project consumed,
        // so they are marked reversed rather than deleted.
        await tx.inventoryAllocation.updateMany({
          where: { projectId: req.params.id as string, reversedAt: null },
          data: { reversedAt: new Date(), reversedById: req.user?.id },
        })

        // Stock value goes back to the warehouse, so take it off the project.
        const returnedValue = allocs.reduce(
          (sum, a) => sum + (a.rawComponent?.price || 0) * a.quantity, 0
        )
        if (returnedValue > 0) {
          await tx.project.update({
            where: { id: req.params.id as string },
            data: { inventoryCost: { decrement: returnedValue } },
          })
        }
      }

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

    if (approvalId) await consumeApprovalToken(approvalId)
    await appendEvent('Project', project.id, 'CANCELLED', `Project "${project.title}" cancelled. ${reason || ''}`, req.user?.id)
    res.json({ ok: true })
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to cancel project' }) }
})

// Undo a Deal -> Project promotion. Only allowed while the Project is still
// untouched by real operational work — once a PO, invoice, allocation, work
// order or material request exists, reverting would either orphan that record
// or require deciding how to unwind it, so this refuses instead of guessing.
router.post('/:id/revert-to-deal', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id as string } })
  if (!enforceActiveOr404(project, false, res)) return

  if (!project!.dealId) {
    res.status(400).json({ error: 'This project has no originating deal to revert to.' })
    return
  }

  const [poCount, invoiceCount, allocCount, woCount, mrCount] = await Promise.all([
    prisma.purchaseOrder.count({ where: { projectId: project!.id } }),
    prisma.invoice.count({ where: { projectId: project!.id } }),
    prisma.inventoryAllocation.count({ where: { projectId: project!.id } }),
    prisma.workOrder.count({ where: { projectId: project!.id } }),
    prisma.materialRequest.count({ where: { projectId: project!.id } }),
  ])
  const blockers: string[] = []
  if (poCount) blockers.push(`${poCount} purchase order${poCount === 1 ? '' : 's'}`)
  if (invoiceCount) blockers.push(`${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'}`)
  if (allocCount) blockers.push(`${allocCount} inventory allocation${allocCount === 1 ? '' : 's'}`)
  if (woCount) blockers.push(`${woCount} work order${woCount === 1 ? '' : 's'}`)
  if (mrCount) blockers.push(`${mrCount} material request${mrCount === 1 ? '' : 's'}`)

  if (blockers.length) {
    res.status(409).json({
      error: 'has_dependents',
      message: `Cannot revert — this project already has ${blockers.join(', ')}. Resolve or remove these first.`,
      blockers,
    })
    return
  }

  // Reverting is undoing a promotion, not an ordinary edit — same review bar as
  // cancel, since it deletes the Project row outright.
  const { allowed, approvalId } = await checkApprovalToken(
    req.user!.id, req.user!.roleName, 'project', req.params.id as string, 'revert_to_deal'
  )
  if (!allowed) {
    res.status(403).json({ error: 'approval_required', entityType: 'project', entityId: req.params.id, action: 'revert_to_deal', payload: {} })
    return
  }

  const dealId = project!.dealId
  await prisma.$transaction(async tx => {
    // Scope lines were copied onto the Project at promotion time (see close-won);
    // they still exist on the Deal, so the Project's copies are discarded, not moved.
    await tx.scopeItem.deleteMany({ where: { entityType: 'Project', entityId: project!.id } })
    await tx.projectBudgetLine.deleteMany({ where: { projectId: project!.id } })
    await tx.projectMilestone.deleteMany({ where: { projectId: project!.id } })
    await tx.projectEngineer.deleteMany({ where: { projectId: project!.id } })
    await tx.project.delete({ where: { id: project!.id } })
    await tx.deal.update({ where: { id: dealId! }, data: { stage: 'Negotiation' } })
  })

  if (approvalId) await consumeApprovalToken(approvalId)
  await appendEvent('Deal', dealId!, 'REVERTED', `Project "${project!.title}" reverted back to Deal (stage: Negotiation)`, req.user?.id)
  await notifyRoles(['SuperAdmin', 'SalesHead', 'BusinessHead'], {
    type: 'deal', severity: 'warning',
    title: `Deal reverted from Project`,
    message: `"${project!.title}" was reverted from Project back to Deal by ${req.user!.id}.`,
    entityType: 'Deal', entityId: dealId!,
  })
  res.json({ ok: true, dealId })
})

// Push work-in-progress scope lines back into inventory as sellable stock.
// Called from the cancel/complete flow: the Project Head picks which scope lines
// represent goods that physically exist, and each becomes a new RawComponent.
router.post('/:id/push-to-inventory', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  const projectId = req.params.id as string
  const parsed = z.object({
    items: z.array(z.object({
      scopeItemId: z.string().min(1),
      category: z.enum(['SemiFinished', 'FinishedGoods']),
      name: z.string().min(1).optional(),
      quantity: z.number().positive().optional(),
      notes: z.string().nullish(),
    })).min(1),
  }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'items[] with scopeItemId and category required' })

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, title: true, progress: true } })
  if (!project) return res.status(404).json({ error: 'Not found' })

  const scopeItems = await prisma.scopeItem.findMany({
    where: { id: { in: parsed.data.items.map(i => i.scopeItemId) }, entityType: 'Project', entityId: projectId },
  })
  if (scopeItems.length !== parsed.data.items.length) {
    return res.status(400).json({ error: 'One or more scope items do not belong to this project' })
  }

  // Creates sellable stock out of work in progress, so it carries the same
  // oversight as the cancellation it usually accompanies.
  const { allowed, approvalId } = await checkApprovalToken(
    req.user!.id, req.user!.roleName, 'project', projectId, 'push_to_inventory'
  )
  if (!allowed) {
    return res.status(403).json({
      error: 'approval_required', entityType: 'project', entityId: projectId,
      action: 'push_to_inventory', payload: { items: parsed.data.items },
    })
  }

  try {
    const created = await prisma.$transaction(async tx => {
      const year = new Date().getFullYear()
      // Seed the counter once from the highest existing ref, then increment
      // locally — a per-item count() would collide across the batch.
      const latest = await tx.rawComponent.findFirst({
        where: { refNumber: { startsWith: `RC-${year}-` } },
        orderBy: { refNumber: 'desc' },
        select: { refNumber: true },
      })
      let seq = latest ? parseInt(latest.refNumber.slice(-4), 10) : 0

      const out = []
      for (const input of parsed.data.items) {
        const item = scopeItems.find(s => s.id === input.scopeItemId)!
        // Pushing a line that still holds allocated stock would double-count it.
        if (item.inventoryComponentId) throw new Error('LINE_STILL_ALLOCATED')
        if (item.fulfillmentStatus === 'semi_finished' || item.fulfillmentStatus === 'completed') {
          throw new Error('ALREADY_PUSHED')
        }

        seq += 1
        const qty = input.quantity ?? item.quantity ?? 1
        const component = await tx.rawComponent.create({
          data: {
            refNumber: `RC-${year}-${String(seq).padStart(4, '0')}`,
            name: input.name || item.name,
            category: input.category,
            status: 'in_stock',
            quantity: Math.ceil(qty),
            unit: item.unit,
            customFields: item.customFields ?? undefined,
            notes: input.notes || `Pushed from project "${project.title}" at ${project.progress ?? 0}% completion`,
          },
        })

        await tx.projectInventoryPush.create({
          data: {
            projectId, componentId: component.id, scopeItemId: item.id,
            category: input.category, quantity: qty,
            pushedById: req.user?.id, notes: input.notes,
          },
        })
        await tx.componentMovement.create({
          data: {
            componentId: component.id, type: 'received',
            toEntityType: 'inventory', toEntityId: 'raw_materials', toEntityName: 'Raw Materials',
            performedById: req.user?.id,
            notes: `Created from project "${project.title}" scope line "${item.name}"`,
          },
        })
        await tx.scopeItem.update({
          where: { id: item.id },
          data: { fulfillmentStatus: input.category === 'FinishedGoods' ? 'completed' : 'semi_finished' },
        })
        out.push(component)
      }
      return out
    })

    if (approvalId) await consumeApprovalToken(approvalId)
    await appendEvent('Project', projectId, 'INVENTORY_PUSH', `${created.length} scope item(s) pushed to inventory from "${project.title}"`, req.user?.id)
    res.status(201).json({ pushed: created.length, components: created })
  } catch (e) {
    const msg = (e as Error)?.message
    if (msg === 'LINE_STILL_ALLOCATED') return res.status(400).json({ error: 'Unallocate the existing component before pushing this line to inventory' })
    if (msg === 'ALREADY_PUSHED') return res.status(400).json({ error: 'That scope line has already been pushed to inventory' })
    console.error(e)
    res.status(500).json({ error: 'Failed to push to inventory' })
  }
})

// GET /api/projects/:id/inventory-pushes — audit trail of what this project pushed
router.get('/:id/inventory-pushes', requirePermission('project', 'read_own'), async (req: AuthRequest, res) => {
  const pushes = await prisma.projectInventoryPush.findMany({
    where: { projectId: req.params.id as string },
    include: { component: { select: { id: true, refNumber: true, name: true, category: true, status: true, quantity: true } } },
    orderBy: { pushedAt: 'desc' },
  })
  res.json(pushes)
})

// Assign PM / SE
router.patch('/:id/assign', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  const { assignedPMId, assignedSEId } = req.body

  const existing = await prisma.project.findUnique({ where: { id: req.params.id as string } })
  if (!rejectIfInactive(existing, res)) return

  // Reassignment goes through the same approval gate as a normal edit — otherwise
  // it would be a way to change a project's owners without oversight.
  const { allowed, approvalId } = await checkApprovalToken(
    req.user!.id, req.user!.roleName, 'project', req.params.id as string, 'assign'
  )
  if (!allowed) {
    res.status(403).json({
      error: 'approval_required', entityType: 'project', entityId: req.params.id,
      action: 'assign', payload: { assignedPMId, assignedSEId },
    })
    return
  }

  const project = await prisma.project.update({
    where: { id: req.params.id as string },
    data: { assignedPMId, assignedSEId },
    include: { assignedPM: { select: { name: true } }, assignedSE: { select: { name: true } } },
  })
  if (approvalId) await consumeApprovalToken(approvalId)
  await appendEvent('Project', project.id, 'ASSIGNED',
    `Assigned PM: ${project.assignedPM?.name ?? 'none'}, Engineer: ${project.assignedSE?.name ?? 'none'}`, req.user?.id)
  res.json(project)
})

// ─── Multiple Engineer Assignment ────────────────────────────────────────────

router.get('/:id/engineers', requirePermission('project', 'read_own'), async (req: AuthRequest, res) => {
  const engineers = await prisma.projectEngineer.findMany({
    where: { projectId: req.params.id as string },
    include: { user: { select: { id: true, name: true, role: true, roleName: true } } },
    orderBy: { assignedAt: 'asc' },
  })
  res.json(engineers)
})

router.post('/:id/engineers', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  const { userId, role } = req.body as { userId: string; role?: string }
  if (!userId) { res.status(400).json({ error: 'userId required' }); return }

  const project = await prisma.project.findUnique({ where: { id: req.params.id as string } })
  if (!rejectIfInactive(project, res)) return

  // Same approval gate as reassignment — without it a user could add themselves
  // to any project and inherit its scoped access.
  const { allowed, approvalId } = await checkApprovalToken(
    req.user!.id, req.user!.roleName, 'project', req.params.id as string, 'add_engineer'
  )
  if (!allowed) {
    res.status(403).json({
      error: 'approval_required', entityType: 'project', entityId: req.params.id,
      action: 'add_engineer', payload: { userId, role },
    })
    return
  }

  const existing = await prisma.projectEngineer.findUnique({
    where: { projectId_userId: { projectId: req.params.id as string, userId } },
  })
  if (existing) { res.status(409).json({ error: 'Engineer already assigned to this project' }); return }
  const assignment = await prisma.projectEngineer.create({
    data: { projectId: req.params.id as string, userId, role: role || 'Engineer', assignedById: req.user?.id },
    include: { user: { select: { id: true, name: true, role: true } } },
  })
  if (approvalId) await consumeApprovalToken(approvalId)
  await appendEvent('Project', req.params.id as string, 'ENGINEER_ASSIGNED', `${assignment.user.name} assigned as ${assignment.role}`, req.user?.id)
  res.status(201).json(assignment)
})

router.delete('/:id/engineers/:userId', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  const assignment = await prisma.projectEngineer.findUnique({
    where: { projectId_userId: { projectId: req.params.id as string, userId: req.params.userId as string } },
    include: { user: { select: { name: true } } },
  })
  if (!assignment) { res.status(404).json({ error: 'Not found' }); return }

  const { allowed, approvalId } = await checkApprovalToken(
    req.user!.id, req.user!.roleName, 'project', req.params.id as string, 'remove_engineer'
  )
  if (!allowed) {
    res.status(403).json({
      error: 'approval_required', entityType: 'project', entityId: req.params.id,
      action: 'remove_engineer', payload: { userId: req.params.userId },
    })
    return
  }

  await prisma.projectEngineer.delete({ where: { id: assignment.id } })
  if (approvalId) await consumeApprovalToken(approvalId)
  await appendEvent('Project', req.params.id as string, 'ENGINEER_REMOVED', `${assignment.user.name} removed from project`, req.user?.id)
  res.status(204).end()
})

// ── Budget lines (custom cost centres) ──────────────────────────────────────
// Maps the 8 legacy fixed budget columns to their auto-tracked actual, so a
// first-time GET can seed real starting values instead of all-zero rows.
const DEFAULT_BUDGET_LINES: { label: string; plannedKey: string; actualSourceKey: string | null }[] = [
  { label: 'Equipment',     plannedKey: 'budgetEquipment',     actualSourceKey: 'purchaseCost' },
  { label: 'Procurement',   plannedKey: 'budgetProcurement',   actualSourceKey: 'inventoryCost' },
  { label: 'Installation',  plannedKey: 'budgetInstallation',  actualSourceKey: 'installationCost' },
  { label: 'Civil Works',   plannedKey: 'budgetCivilWorks',    actualSourceKey: 'actualCivilWorks' },
  { label: 'Electrical',    plannedKey: 'budgetElectrical',    actualSourceKey: 'actualElectrical' },
  { label: 'Logistics',     plannedKey: 'budgetLogistics',     actualSourceKey: 'actualLogistics' },
  { label: 'Commissioning', plannedKey: 'budgetCommissioning', actualSourceKey: 'actualCommissioning' },
  { label: 'O&M Reserve',   plannedKey: 'budgetOMReserve',     actualSourceKey: 'serviceCost' },
  { label: 'Contingency',   plannedKey: 'budgetContingency',   actualSourceKey: null },
]

router.get('/:id/budget-lines', requirePermission('project', 'read_own'), async (req: AuthRequest, res) => {
  const projectId = req.params.id as string
  let lines = await prisma.projectBudgetLine.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
  })

  if (lines.length === 0) {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) { res.status(404).json({ error: 'Project not found' }); return }
    lines = await prisma.$transaction(
      DEFAULT_BUDGET_LINES.map((d, i) => prisma.projectBudgetLine.create({
        data: {
          projectId,
          label: d.label,
          planned: (project as any)[d.plannedKey] ?? 0,
          actualSourceKey: d.actualSourceKey,
          sortOrder: i,
        },
      }))
    )
  }

  // Resolve each auto-tracked line's live actual off the current project row.
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  const withActuals = lines.map(l => ({
    ...l,
    actual: l.actualSourceKey ? Number((project as any)?.[l.actualSourceKey]) || 0 : (l.manualActual ?? 0),
  }))
  res.json(withActuals)
})

router.post('/:id/budget-lines', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  const projectId = req.params.id as string
  const { label, planned } = req.body as { label: string; planned?: number }
  if (!label?.trim()) { res.status(400).json({ error: 'label required' }); return }

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!rejectIfInactive(project, res)) return

  const maxOrder = await prisma.projectBudgetLine.aggregate({ where: { projectId }, _max: { sortOrder: true } })
  const line = await prisma.projectBudgetLine.create({
    data: { projectId, label: label.trim(), planned: planned ?? 0, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  })
  res.status(201).json({ ...line, actual: line.manualActual ?? 0 })
})

router.patch('/:id/budget-lines/:lineId', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  const { label, planned, manualActual } = req.body as { label?: string; planned?: number; manualActual?: number }
  const existing = await prisma.projectBudgetLine.findUnique({ where: { id: req.params.lineId as string } })
  if (!existing || existing.projectId !== req.params.id) { res.status(404).json({ error: 'Not found' }); return }

  // Negative planned/actual values break the variance maths downstream.
  for (const [field, value] of [['planned', planned], ['manualActual', manualActual]] as const) {
    if (value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      res.status(400).json({ error: `${field} must be a positive number` })
      return
    }
  }

  const data: any = {}
  if (label !== undefined) data.label = label.trim()
  if (planned !== undefined) data.planned = planned
  // Manual actuals only apply to user-added centres — auto-tracked ones
  // derive their number from actualSourceKey and would silently disagree
  // with the project column if this were allowed to override it.
  if (manualActual !== undefined && !existing.actualSourceKey) data.manualActual = manualActual

  const line = await prisma.projectBudgetLine.update({ where: { id: req.params.lineId as string }, data })
  const project = await prisma.project.findUnique({ where: { id: req.params.id as string } })
  const actual = line.actualSourceKey ? Number((project as any)?.[line.actualSourceKey]) || 0 : (line.manualActual ?? 0)
  res.json({ ...line, actual })
})

router.delete('/:id/budget-lines/:lineId', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  const existing = await prisma.projectBudgetLine.findUnique({ where: { id: req.params.lineId as string } })
  if (!existing || existing.projectId !== req.params.id) { res.status(404).json({ error: 'Not found' }); return }
  await prisma.projectBudgetLine.delete({ where: { id: req.params.lineId as string } })
  res.status(204).end()
})

// ─── Scope of Supply ────────────────────────────────────────────────────────
// Multiple lines per project (heat pump unit 1, solar thermal 2000LPD, ...).
// Manufacturing work orders and Installations each link to at most one line
// via scopeItemId — a project with several scope lines gets one work order /
// installation per line, rather than either side juggling a multi-select.

router.get('/:id/scope-items', requirePermission('project', 'read_own'), async (req: AuthRequest, res) => {
  const items = await prisma.projectScopeItem.findMany({
    where: { projectId: req.params.id as string },
    orderBy: { sortOrder: 'asc' },
  })
  res.json(items)
})

router.post('/:id/scope-items', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  const projectId = req.params.id as string
  const { title, description, productType, quantity, unitPrice, hsnCode, gstRate } = req.body as {
    title: string; description?: string; productType?: string
    quantity?: number; unitPrice?: number; hsnCode?: string; gstRate?: number
  }
  if (!title?.trim()) { res.status(400).json({ error: 'title required' }); return }

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!rejectIfInactive(project, res)) return

  const qty = quantity ?? 1
  const price = unitPrice ?? 0
  const maxOrder = await prisma.projectScopeItem.aggregate({ where: { projectId }, _max: { sortOrder: true } })
  const item = await prisma.projectScopeItem.create({
    data: {
      projectId, title: title.trim(), description, productType,
      quantity: qty, unitPrice: price, totalPrice: qty * price,
      hsnCode, gstRate: gstRate ?? 18,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  })
  res.status(201).json(item)
})

router.patch('/:id/scope-items/:itemId', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  const existing = await prisma.projectScopeItem.findUnique({ where: { id: req.params.itemId as string } })
  if (!existing || existing.projectId !== req.params.id) { res.status(404).json({ error: 'Not found' }); return }

  const { title, description, productType, quantity, unitPrice, hsnCode, gstRate, status } = req.body as {
    title?: string; description?: string; productType?: string
    quantity?: number; unitPrice?: number; hsnCode?: string; gstRate?: number; status?: string
  }

  const data: any = {}
  if (title !== undefined) data.title = title.trim()
  if (description !== undefined) data.description = description
  if (productType !== undefined) data.productType = productType
  if (hsnCode !== undefined) data.hsnCode = hsnCode
  if (gstRate !== undefined) data.gstRate = gstRate
  if (status !== undefined) {
    data.status = status
    if (status === 'Completed' && !existing.completedAt) data.completedAt = new Date()
  }
  const qty = quantity ?? existing.quantity
  const price = unitPrice ?? existing.unitPrice
  if (quantity !== undefined) data.quantity = quantity
  if (unitPrice !== undefined) data.unitPrice = unitPrice
  if (quantity !== undefined || unitPrice !== undefined) data.totalPrice = qty * price

  const item = await prisma.projectScopeItem.update({ where: { id: req.params.itemId as string }, data })
  res.json(item)
})

router.delete('/:id/scope-items/:itemId', requirePermission('project', 'edit'), async (req: AuthRequest, res) => {
  const existing = await prisma.projectScopeItem.findUnique({ where: { id: req.params.itemId as string } })
  if (!existing || existing.projectId !== req.params.id) { res.status(404).json({ error: 'Not found' }); return }
  const inUse = await prisma.workOrder.count({ where: { scopeItemId: existing.id } })
    + await prisma.installation.count({ where: { scopeItemId: existing.id } })
  if (inUse > 0) { res.status(409).json({ error: 'Scope item is assigned to a work order or installation — unassign first' }); return }
  await prisma.projectScopeItem.delete({ where: { id: req.params.itemId as string } })
  res.status(204).end()
})

// Get full ERP data for project
router.get('/:id/erp', requirePermission('project', 'read_own'), async (req: AuthRequest, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id as string },
      include: {
        company: true,
        deal: { select: { id: true, title: true } },
        quotation: { select: { id: true, refNumber: true, title: true } },
        purchaseOrders: { include: { items: true, goodsReceipts: true } },
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

/** Bulk archive. Mirrors the single-row soft delete above. */
router.post('/bulk-delete', requirePermission('project', 'delete'), async (req: AuthRequest, res) => {
  const { ids } = req.body as { ids?: string[] }
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'ids array required' }); return }
  const targets = await prisma.project.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true, title: true, isLocked: true },
  })
  // A locked project is mid-execution; archiving it in bulk would be a
  // surprise, so it is reported back instead of silently skipped.
  const locked = targets.filter(t => t.isLocked)
  const deletable = targets.filter(t => !t.isLocked)
  if (deletable.length) {
    await prisma.project.updateMany({
      where: { id: { in: deletable.map(t => t.id) } },
      data: { isActive: false },
    })
    await Promise.all(deletable.map(p =>
      appendEvent('Project', p.id, 'DELETED', `Project "${p.title}" archived`, req.user?.id),
    ))
  }
  res.json({
    deleted: deletable.length,
    skipped: ids.length - deletable.length,
    blocked: locked.map(p => ({ id: p.id, title: p.title, reason: 'Project is locked' })),
  })
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
  const project = await prisma.project.findUnique({
    where: { id: req.params.id as string },
    include: { company: true, engineers: { select: { userId: true } } },
  })
  if (!project) { res.status(404).json({ error: 'Not found' }); return }

  // Holding invoice:create is not enough — the caller must also be able to see
  // this project, or they could bill one they have no access to.
  const canReadAll = await resolvePermission(req.user!.id, req.user!.roleName, 'project', 'read_all')
  const isAssigned =
    project.createdById === req.user!.id ||
    project.assignedPMId === req.user!.id ||
    project.assignedSEId === req.user!.id ||
    project.engineers.some(e => e.userId === req.user!.id)
  if (!canReadAll && !isAssigned) { res.status(403).json({ error: 'Insufficient permissions' }); return }

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
