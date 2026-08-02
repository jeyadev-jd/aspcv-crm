import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { dealSchema, stripUnsentDefaults } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { notifyRoles, createNotification } from '../services/notify'
import { requirePermission, resolvePermission, checkApprovalToken, consumeApprovalToken } from '../middleware/permissions'
import { getScopeFilter } from '../middleware/scoping'
import { parsePagination, paginate } from '../lib/pagination'
import { activeFilter, enforceActiveOr404, rejectIfInactive } from '../lib/softDelete'
import { checkVersion, sendConflict } from '../lib/concurrency'

const router = createSafeRouter()
router.use(authenticate)

router.get('/', requirePermission('deal', 'read_own'), async (req: AuthRequest, res) => {
  const { stage, companyId, leadId, assigneeId, includeInactive } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
  const scope = await getScopeFilter(req.user!.id, req.user!.roleName, 'deal')
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'deal', 'delete')
  const where = {
    ...scope,
    ...activeFilter(includeInactive === 'true' && canManage),
    ...(stage && { stage: stage as any }),
    ...(companyId && { companyId }),
    ...(leadId && { leadId }),
    ...(assigneeId && { owners: { some: { userId: assigneeId } } }),
    ...(pagination.search && { title: { contains: pagination.search, mode: 'insensitive' as const } }),
  }
  const [deals, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        lead: { select: { id: true, title: true } },
        owners: { include: { user: { select: { id: true, name: true, role: true } } } },
        department: { select: { id: true, name: true } },
        assignedPM: { select: { id: true, name: true, role: true } },
        assignedSE: { select: { id: true, name: true, role: true } },
        region: { select: { id: true, name: true } },
        commercialModel: { select: { id: true, name: true } },
        capacityUnit: { select: { id: true, name: true } },
        projects: { where: { isActive: true }, select: { id: true, title: true, status: true } },
      },
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.deal.count({ where }),
  ])
  res.json(paginate(deals, total, pagination))
})

router.get('/:id', requirePermission('deal', 'read_own'), async (req: AuthRequest, res) => {
  const { includeInactive } = req.query as Record<string, string>
  const deal = await prisma.deal.findUnique({
    where: { id: req.params.id as string },
    include: {
      company: { include: { contacts: { where: { isActive: true } } } },
      lead: { select: { id: true, title: true } },
      owners: { include: { user: { select: { id: true, name: true, role: true } } } },
      projects: { where: { isActive: true }, select: { id: true, title: true, status: true } },
      department: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } },
      commercialModel: { select: { id: true, name: true } },
      capacityUnit: { select: { id: true, name: true } },
    },
  })
  const canReadAll = await resolvePermission(req.user!.id, req.user!.roleName, 'deal', 'read_all')
  if (!canReadAll && deal && !deal.owners.some(o => o.userId === req.user!.id)) { res.status(403).json({ error: 'Insufficient permissions' }); return }
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'deal', 'delete')
  if (!enforceActiveOr404(deal, includeInactive === 'true' && canManage, res)) return
  res.json(deal)
})

router.post('/', requirePermission('deal', 'create'), async (req: AuthRequest, res) => {
  const data = dealSchema.parse(req.body)
  const { ownerIds, ...dealData } = data as typeof data & { ownerIds?: string[] }
  const linkedLead = dealData.leadId
    ? await prisma.lead.findUnique({
        where: { id: dealData.leadId },
        select: {
          leadNumber: true, capacityValue: true, capacityUnitId: true,
          tempRangeMin: true, tempRangeMax: true,
        },
      })
    : null

  // Inherit the technical spec from the originating Lead unless the caller
  // explicitly supplied its own — sales shouldn't have to retype it.
  const inheritedSpec = linkedLead ? {
    capacityValue: dealData.capacityValue ?? linkedLead.capacityValue,
    capacityUnitId: dealData.capacityUnitId ?? linkedLead.capacityUnitId,
    tempRangeMin: dealData.tempRangeMin ?? linkedLead.tempRangeMin,
    tempRangeMax: dealData.tempRangeMax ?? linkedLead.tempRangeMax,
  } : {}

  const deal = await prisma.deal.create({
    data: {
      ...dealData,
      ...inheritedSpec,
      leadNumber: linkedLead?.leadNumber,
      createdById: req.user!.id,
      closeDate: dealData.closeDate ? new Date(dealData.closeDate) : undefined,
      owners: req.user
        ? { create: [{ userId: req.user.id, role: 'primary' }] }
        : undefined,
    },
    include: { company: { select: { id: true, name: true } } },
  })
  if (ownerIds?.length) {
    const extras = ownerIds.filter(id => id !== req.user?.id)
    if (extras.length) {
      await prisma.dealOwner.createMany({
        data: extras.map(userId => ({ dealId: deal.id, userId, role: 'secondary' })),
        skipDuplicates: true,
      })
    }
  }
  // Carry the Lead's Scope of Supply onto the Deal — sales already captured it
  // once, so it shouldn't need retyping (and Costing's capacity gate reads it
  // from here downstream).
  if (dealData.leadId) {
    const leadScope = await prisma.scopeItem.findMany({
      where: { entityType: 'Lead', entityId: dealData.leadId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    if (leadScope.length) {
      await prisma.scopeItem.createMany({
        data: leadScope.map(s => ({
          entityType: 'Deal', entityId: deal.id, name: s.name,
          specification: s.specification, capacityKw: s.capacityKw,
          quantity: s.quantity, unit: s.unit, customFields: s.customFields as any,
          notes: s.notes, sortOrder: s.sortOrder, createdById: req.user!.id,
        })),
      })
    }
  }
  await appendEvent('Deal', deal.id, 'CREATED', `Deal "${deal.title}" created`, req.user?.id)
  res.status(201).json(deal)
})

router.put('/:id', async (req: AuthRequest, res) => {
  const existingDeal = await prisma.deal.findUnique({ where: { id: req.params.id as string } })
  if (!rejectIfInactive(existingDeal, res)) return

  // Stale write check runs before the approval gate so a losing edit never
  // burns a single-use approval token.
  const stale = checkVersion(existingDeal!, req.body.expectedUpdatedAt)
  if (stale) { sendConflict(res, stale.current, 'deal'); return }

  const { allowed, approvalId } = await checkApprovalToken(req.user!.id, req.user!.roleName, 'deal', req.params.id as string, 'edit')
  if (!allowed) {
    res.status(403).json({ error: 'approval_required', entityType: 'deal', entityId: req.params.id, action: 'edit' })
    return
  }
  const data = stripUnsentDefaults(dealSchema.partial().parse(req.body), req.body)
  const deal = await prisma.deal.update({
    where: { id: req.params.id as string },
    data: {
      ...data,
      closeDate: data.closeDate ? new Date(data.closeDate) : undefined,
    },
    include: { company: { select: { id: true, name: true } } },
  })
  if (approvalId) await consumeApprovalToken(approvalId)
  await appendEvent('Deal', deal.id, 'UPDATED', `Deal "${deal.title}" updated`, req.user?.id)
  res.json(deal)
})

const VALID_STAGES = ['LeadIn', 'Proposal', 'Negotiation', 'OrderWon', 'OrderLost'] as const
// OrderWon must go through POST /:id/close-won (requires handover notes + PM assignment).
// Any stage can move to OrderLost. Forward progression only for the open stages.
const ALLOWED_STAGE_TRANSITIONS: Record<string, string[]> = {
  LeadIn: ['Proposal', 'Negotiation', 'OrderLost'],
  Proposal: ['Negotiation', 'LeadIn', 'OrderLost'],
  Negotiation: ['Proposal', 'OrderLost'],
  OrderWon: [],
  OrderLost: ['Negotiation'],
}

router.patch('/:id/stage', requirePermission('deal', 'edit'), async (req: AuthRequest, res) => {
  const { stage } = req.body as { stage: string }
  if (!VALID_STAGES.includes(stage as any)) return res.status(400).json({ error: `Invalid stage: ${stage}` })
  if (stage === 'OrderWon') return res.status(400).json({ error: 'Use POST /:id/close-won to mark a deal Closed Won — it requires handover notes and a Project Manager assignment.' })

  const existing = await prisma.deal.findUnique({ where: { id: req.params.id as string } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const allowed = ALLOWED_STAGE_TRANSITIONS[existing.stage] ?? []
  if (!allowed.includes(stage)) return res.status(400).json({ error: `Cannot move deal from ${existing.stage} to ${stage}` })

  const deal = await prisma.deal.update({
    where: { id: req.params.id as string },
    data: { stage: stage as any },
    include: { company: { select: { id: true, name: true } } },
  })
  await appendEvent('Deal', deal.id, 'STAGE_CHANGED', `Stage changed to ${stage}`, req.user?.id)

  // Sync the originating Lead's status when its promoted Deal closes lost —
  // otherwise the Lead is left showing a stale status once the Deal's outcome is known.
  if (deal.leadId && stage === 'OrderLost') {
    await prisma.lead.update({ where: { id: deal.leadId }, data: { status: stage as any } })
    await appendEvent('Lead', deal.leadId, 'STATUS_CHANGED', `Status synced to ${stage} from Deal close`, req.user?.id)
  }

  res.json({ deal, promotedProject: null })
})

// Any shareable link is accepted for the signed handover PDF — OneDrive, Google
// Drive, Dropbox, or an internal file server.
const HANDOVER_URL = /^https?:\/\/.+/i

// Sales team submits handover + assigns PM when marking deal Closed Won
// (equivalently: accepting the winning Quotation). Spawns the Project directly
// from the Deal — no Sales Order step.
router.post('/:id/close-won', requirePermission('deal', 'edit'), async (req: AuthRequest, res) => {
  const { handoverNotes, handoverOneDriveUrl, assignedPMId, quotationId, budget } = req.body
  if (!handoverNotes?.trim()) {
    res.status(400).json({ error: 'Handover description is required' })
    return
  }
  if (!assignedPMId) {
    res.status(400).json({ error: 'Project Head assignment is required' })
    return
  }
  // Budget is set here because it caps every Purchase Order raised on the
  // project later; falls back to the deal value when not overridden.
  let projectBudget: number | undefined
  if (budget !== undefined && budget !== null && budget !== '') {
    projectBudget = Number(budget)
    if (!Number.isFinite(projectBudget) || projectBudget < 0) {
      res.status(400).json({ error: 'Budget must be a positive number' })
      return
    }
  }
  if (!handoverOneDriveUrl?.trim() || !HANDOVER_URL.test(handoverOneDriveUrl.trim())) {
    res.status(400).json({ error: 'Handover document must be a valid link' })
    return
  }
  const deal = await prisma.deal.findUnique({ where: { id: req.params.id as string } })
  if (!deal) { res.status(404).json({ error: 'Not found' }); return }
  if (deal.stage === 'OrderWon') { res.status(400).json({ error: 'Already marked Closed Won' }); return }

  if (quotationId) {
    const q = await prisma.quotation.findUnique({ where: { id: quotationId } })
    if (!q) { res.status(404).json({ error: 'Quotation not found' }); return }
    if (q.dealId && q.dealId !== deal.id) { res.status(400).json({ error: 'Quotation belongs to a different deal' }); return }
    if (q.status !== 'Sent') { res.status(400).json({ error: 'Quotation must be admin-approved and sent to the customer before it can be accepted' }); return }
  }

  const notes = handoverNotes.trim()
  const url = handoverOneDriveUrl.trim()
  const finalBudget = projectBudget ?? deal.value ?? 0

  const { updated, promotedProject } = await prisma.$transaction(async tx => {
    let promotedProject = null
    const existing = await tx.project.findFirst({ where: { dealId: deal.id, isActive: true } })
    if (!existing) {
      promotedProject = await tx.project.create({
        data: {
          title: deal.title,
          companyId: deal.companyId,
          dealId: deal.id,
          leadNumber: deal.leadNumber,
          quotationId: quotationId || null,
          budget: finalBudget,
          remainingBudget: finalBudget,
          status: 'Planning',
          assignedPMId: assignedPMId,
          handoverNotes: notes,
          handoverOneDriveUrl: url,
          createdById: req.user!.id,
        },
      })
    } else {
      promotedProject = await tx.project.update({
        where: { id: existing.id },
        data: {
          assignedPMId: assignedPMId,
          quotationId: quotationId || existing.quotationId,
          handoverNotes: notes,
          handoverOneDriveUrl: url,
          leadNumber: existing.leadNumber ?? deal.leadNumber,
          // Only overwrite the budget when one was explicitly supplied, so a
          // re-handover does not silently reset spend tracking.
          ...(projectBudget !== undefined ? { budget: projectBudget, remainingBudget: projectBudget } : {}),
        },
      })
    }

    if (quotationId) {
      await tx.quotation.update({ where: { id: quotationId }, data: { status: 'Accepted' } })
    }

    // Carry the Deal's Scope of Supply onto the new Project — otherwise the
    // scope entered during Lead/Deal is invisible on the Project it becomes,
    // and inventory allocation (which only reads Project scope lines) has
    // nothing to attach to.
    const dealScope = await tx.scopeItem.findMany({
      where: { entityType: 'Deal', entityId: deal.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    if (dealScope.length) {
      const already = await tx.scopeItem.count({ where: { entityType: 'Project', entityId: promotedProject.id } })
      if (already === 0) {
        await tx.scopeItem.createMany({
          data: dealScope.map(s => ({
            entityType: 'Project', entityId: promotedProject!.id, name: s.name,
            specification: s.specification, capacityKw: s.capacityKw,
            quantity: s.quantity, unit: s.unit, customFields: s.customFields as any,
            notes: s.notes, sortOrder: s.sortOrder, createdById: req.user!.id,
          })),
        })
      }
    }

    const updated = await tx.deal.update({
      where: { id: req.params.id as string },
      data: {
        stage: 'OrderWon',
        handoverNotes: notes,
        handoverAttachmentUrl: url,
        handoverSubmittedAt: new Date(),
        assignedPMId: assignedPMId,
      },
      include: {
        company: { select: { id: true, name: true } },
        assignedPM: { select: { id: true, name: true, role: true } },
        assignedSE: { select: { id: true, name: true, role: true } },
      },
    })
    return { updated, promotedProject }
  })
  await appendEvent('Deal', deal.id, 'STAGE_CHANGED', `Deal marked Closed Won. PM assigned. Handover submitted by ${req.user!.id}`, req.user!.id)
  await notifyRoles(['SuperAdmin', 'SalesHead', 'BusinessHead', 'ProjectHead'], {
    type: 'deal', severity: 'info',
    title: `Deal won: ${updated.title}`,
    message: `${updated.title} (${updated.company?.name ?? ''}) closed as Order Won${updated.value ? ` — ₹${updated.value.toLocaleString()}` : ''}. Project created.`,
    entityType: 'Deal', entityId: updated.id,
  })
  if (assignedPMId) {
    await createNotification({
      userIds: [assignedPMId], type: 'project', severity: 'info',
      title: `You're PM on ${updated.title}`,
      message: `You have been assigned as Project Manager for the newly won deal ${updated.title}.`,
      entityType: 'Deal', entityId: updated.id,
    })
  }
  res.json({ deal: updated, promotedProject })
})

// Undo a Lead -> Deal promotion. Only allowed while nothing downstream depends
// on the Deal: no Project ever promoted from it, no Quotation raised. Same
// reasoning as the Project revert - block rather than guess how to unwind work.
router.post('/:id/revert-to-lead', requirePermission('deal', 'edit'), async (req: AuthRequest, res) => {
  const deal = await prisma.deal.findUnique({ where: { id: req.params.id as string } })
  if (!enforceActiveOr404(deal, false, res)) return

  if (!deal!.leadId) {
    res.status(400).json({ error: 'This deal has no originating lead to revert to.' })
    return
  }

  const [projectCount, quotationCount] = await Promise.all([
    prisma.project.count({ where: { dealId: deal!.id, isActive: true } }),
    prisma.quotation.count({ where: { dealId: deal!.id } }),
  ])
  const blockers: string[] = []
  if (projectCount) blockers.push(`${projectCount} project${projectCount === 1 ? '' : 's'}`)
  if (quotationCount) blockers.push(`${quotationCount} quotation${quotationCount === 1 ? '' : 's'}`)

  if (blockers.length) {
    res.status(409).json({
      error: 'has_dependents',
      message: `Cannot revert — this deal already has ${blockers.join(', ')}. Resolve or remove these first.`,
      blockers,
    })
    return
  }

  const { allowed, approvalId } = await checkApprovalToken(
    req.user!.id, req.user!.roleName, 'deal', req.params.id as string, 'revert_to_lead'
  )
  if (!allowed) {
    res.status(403).json({ error: 'approval_required', entityType: 'deal', entityId: req.params.id, action: 'revert_to_lead', payload: {} })
    return
  }

  const leadId = deal!.leadId
  await prisma.$transaction(async tx => {
    // Deal-level scope lines are this deal's own copy (see promoteLeadToDeal /
    // close-won carrying scope forward) - discarded along with the Deal itself.
    await tx.scopeItem.deleteMany({ where: { entityType: 'Deal', entityId: deal!.id } })
    await tx.dealOwner.deleteMany({ where: { dealId: deal!.id } })
    await tx.deal.delete({ where: { id: deal!.id } })
    await tx.lead.update({ where: { id: leadId! }, data: { status: 'ProspectiveLead' } })
  })

  if (approvalId) await consumeApprovalToken(approvalId)
  await appendEvent('Lead', leadId!, 'REVERTED', `Deal "${deal!.title}" reverted back to Lead (status: ProspectiveLead)`, req.user?.id)
  await notifyRoles(['SuperAdmin', 'SalesHead', 'BusinessHead'], {
    type: 'lead', severity: 'warning',
    title: `Deal reverted from Lead`,
    message: `"${deal!.title}" was reverted from Deal back to Lead by ${req.user!.id}.`,
    entityType: 'Lead', entityId: leadId!,
  })
  res.json({ ok: true, leadId })
})

// Manager re-assigns Project Manager on a Closed Won deal
router.patch('/:id/assign-pm', requirePermission('deal', 'assign_pm'), async (req: AuthRequest, res) => {
  const { assignedPMId } = req.body
  const updated = await prisma.$transaction(async tx => {
    const updated = await tx.deal.update({
      where: { id: req.params.id as string },
      data: { assignedPMId: assignedPMId || null },
      include: {
        company: { select: { id: true, name: true } },
        assignedPM: { select: { id: true, name: true, role: true } },
        assignedSE: { select: { id: true, name: true, role: true } },
      },
    })
    await tx.project.updateMany({
      where: { dealId: req.params.id as string, isActive: true },
      data: { assignedPMId: assignedPMId || null },
    })
    return updated
  })
  await appendEvent('Deal', updated.id, 'PM_ASSIGNED', `Project Manager assigned`, req.user!.id)
  res.json(updated)
})

// Manager assigns Service Engineer to a Closed Won deal
router.patch('/:id/assign-se', requirePermission('deal', 'assign_se'), async (req: AuthRequest, res) => {
  const { assignedSEId } = req.body
  const updated = await prisma.$transaction(async tx => {
    const updated = await tx.deal.update({
      where: { id: req.params.id as string },
      data: { assignedSEId: assignedSEId || null },
      include: {
        company: { select: { id: true, name: true } },
        assignedPM: { select: { id: true, name: true, role: true } },
        assignedSE: { select: { id: true, name: true, role: true } },
      },
    })
    await tx.project.updateMany({
      where: { dealId: req.params.id as string, isActive: true },
      data: { assignedSEId: assignedSEId || null },
    })
    return updated
  })
  await appendEvent('Deal', updated.id, 'SE_ASSIGNED', `Service Engineer assigned`, req.user!.id)
  res.json(updated)
})

router.delete('/:id', async (req: AuthRequest, res) => {
  const existing = await prisma.deal.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.isActive === false) { res.json({ success: true }); return } // idempotent
  const { allowed, approvalId } = await checkApprovalToken(req.user!.id, req.user!.roleName, 'deal', req.params.id as string, 'delete')
  if (!allowed) {
    res.status(403).json({ error: 'approval_required', entityType: 'deal', entityId: req.params.id, action: 'delete' })
    return
  }
  const deal = await prisma.deal.update({
    where: { id: req.params.id as string },
    data: { isActive: false },
  })
  if (approvalId) await consumeApprovalToken(approvalId)
  await appendEvent('Deal', deal.id, 'DELETED', `Deal "${deal.title}" archived`, req.user?.id)
  res.json({ success: true })
})

/**
 * Bulk archive. Deletion is approval-gated per record, so this checks each id
 * individually rather than issuing one updateMany — a bulk path must not become
 * a way around the approval requirement. Ids needing approval come back in
 * `blocked` so the UI can say which ones were left alone.
 */
router.post('/bulk-delete', requirePermission('deal', 'delete'), async (req: AuthRequest, res) => {
  const { ids } = req.body as { ids?: string[] }
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'ids array required' }); return }

  const targets = await prisma.deal.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true, title: true },
  })

  const deleted: string[] = []
  const blocked: { id: string; title: string; reason: string }[] = []
  for (const target of targets) {
    const { allowed, approvalId } = await checkApprovalToken(req.user!.id, req.user!.roleName, 'deal', target.id, 'delete')
    if (!allowed) {
      blocked.push({ id: target.id, title: target.title, reason: 'Needs approval' })
      continue
    }
    await prisma.deal.update({ where: { id: target.id }, data: { isActive: false } })
    if (approvalId) await consumeApprovalToken(approvalId)
    await appendEvent('Deal', target.id, 'DELETED', `Deal "${target.title}" archived`, req.user?.id)
    deleted.push(target.id)
  }

  res.json({ deleted: deleted.length, skipped: ids.length - targets.length, blocked })
})

router.post('/:id/restore', requirePermission('deal', 'delete'), async (req: AuthRequest, res) => {
  const existing = await prisma.deal.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const deal = await prisma.deal.update({ where: { id: req.params.id as string }, data: { isActive: true } })
  await appendEvent('Deal', deal.id, 'RESTORED', `Deal "${deal.title}" restored`, req.user?.id)
  res.json(deal)
})

export default router
