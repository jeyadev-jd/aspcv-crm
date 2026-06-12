import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { dealSchema } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { requirePermission, checkApprovalToken, consumeApprovalToken } from '../middleware/permissions'
import { getScopeFilter } from '../middleware/scoping'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('deal', 'read_own'), async (req: AuthRequest, res) => {
  const { stage, companyId, leadId, assigneeId } = req.query as Record<string, string>
  const scope = await getScopeFilter(req.user!.id, req.user!.roleName, 'deal')
  const deals = await prisma.deal.findMany({
    where: {
      ...scope,
      isActive: true,
      ...(stage && { stage: stage as any }),
      ...(companyId && { companyId }),
      ...(leadId && { leadId }),
      ...(assigneeId && { owners: { some: { userId: assigneeId } } }),
    },
    include: {
      company: { select: { id: true, name: true } },
      lead: { select: { id: true, title: true } },
      owners: { include: { user: { select: { id: true, name: true, role: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(deals)
})

router.get('/:id', async (req, res) => {
  const deal = await prisma.deal.findUnique({
    where: { id: req.params.id as string },
    include: {
      company: { include: { contacts: { where: { isActive: true } } } },
      lead: { select: { id: true, title: true } },
      owners: { include: { user: { select: { id: true, name: true, role: true } } } },
      projects: { where: { isActive: true }, select: { id: true, title: true, status: true } },
    },
  })
  if (!deal) { res.status(404).json({ error: 'Not found' }); return }
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
  const { allowed, approvalId } = await checkApprovalToken(req.user!.id, req.user!.roleName, 'deal', req.params.id as string, 'edit')
  if (!allowed) {
    res.status(403).json({ error: 'approval_required', entityType: 'deal', entityId: req.params.id, action: 'edit' })
    return
  }
  const data = dealSchema.partial().parse(req.body)
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

router.patch('/:id/stage', async (req: AuthRequest, res) => {
  const { stage } = req.body as { stage: string }
  const deal = await prisma.deal.update({
    where: { id: req.params.id as string },
    data: { stage: stage as any },
    include: { company: { select: { id: true, name: true } } },
  })
  await appendEvent('Deal', deal.id, 'STAGE_CHANGED', `Stage changed to ${stage}`, req.user?.id)

  let promotedProject = null
  let promotedInstallation = null
  if (stage === 'OrderWon') {
    const existing = await prisma.project.findFirst({ where: { dealId: deal.id, isActive: true } })
    if (!existing) {
      promotedProject = await prisma.project.create({
        data: {
          companyId: deal.companyId,
          dealId: deal.id,
          title: deal.title,
          status: 'Planning',
          notes: `Auto-created from Deal (Order Won)`,
        },
        include: { company: { select: { id: true, name: true } } },
      })
      await appendEvent('Project', promotedProject.id, 'CREATED', `Project auto-created from Deal "${deal.title}"`, req.user?.id)

      promotedInstallation = await prisma.installation.create({
        data: {
          companyId: deal.companyId,
          projectId: promotedProject.id,
          title: `Installation — ${deal.title}`,
          status: 'Scheduled',
          notes: `Auto-created from Deal (Order Won)`,
        },
        include: { company: { select: { id: true, name: true } } },
      })
      await appendEvent('Installation', promotedInstallation.id, 'CREATED', `Installation auto-created from Deal "${deal.title}"`, req.user?.id)
    }
  }

  res.json({ deal, promotedProject, promotedInstallation })
})

router.delete('/:id', async (req: AuthRequest, res) => {
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

export default router
