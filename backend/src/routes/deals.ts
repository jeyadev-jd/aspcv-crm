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
  const deal = await prisma.deal.create({
    data: {
      ...dealData,
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
  await appendEvent('Deal', deal.id, 'CREATED', `Deal "${deal.title}" created`, req.user?.id)
  res.status(201).json(deal)
})

router.put('/:id', async (req: AuthRequest, res) => {
  const existingDeal = await prisma.deal.findUnique({ where: { id: req.params.id as string } })
  if (!rejectIfInactive(existingDeal, res)) return
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

// Sales team submits handover + assigns PM when marking deal Closed Won
router.post('/:id/close-won', requirePermission('deal', 'edit'), async (req: AuthRequest, res) => {
  const { handoverNotes, handoverAttachmentUrl, assignedPMId } = req.body
  if (!handoverNotes?.trim()) {
    res.status(400).json({ error: 'Handover description is required' })
    return
  }
  if (!assignedPMId) {
    res.status(400).json({ error: 'Project Manager assignment is required' })
    return
  }
  const deal = await prisma.deal.findUnique({ where: { id: req.params.id as string } })
  if (!deal) { res.status(404).json({ error: 'Not found' }); return }
  if (deal.stage === 'OrderWon') { res.status(400).json({ error: 'Already marked Closed Won' }); return }

  const { updated, promotedProject } = await prisma.$transaction(async tx => {
    let promotedProject = null
    const existing = await tx.project.findFirst({ where: { dealId: deal.id, isActive: true } })
    if (!existing) {
      promotedProject = await tx.project.create({
        data: {
          title: deal.title,
          companyId: deal.companyId,
          dealId: deal.id,
          budget: deal.value,
          remainingBudget: deal.value,
          status: 'Planning',
          assignedPMId: assignedPMId,
          createdById: req.user!.id,
        },
      })
    } else {
      await tx.project.update({ where: { id: existing.id }, data: { assignedPMId: assignedPMId } })
    }

    const updated = await tx.deal.update({
      where: { id: req.params.id as string },
      data: {
        stage: 'OrderWon',
        handoverNotes: handoverNotes.trim(),
        handoverAttachmentUrl: handoverAttachmentUrl?.trim() || null,
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

router.post('/:id/restore', requirePermission('deal', 'delete'), async (req: AuthRequest, res) => {
  const existing = await prisma.deal.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const deal = await prisma.deal.update({ where: { id: req.params.id as string }, data: { isActive: true } })
  await appendEvent('Deal', deal.id, 'RESTORED', `Deal "${deal.title}" restored`, req.user?.id)
  res.json(deal)
})

export default router
