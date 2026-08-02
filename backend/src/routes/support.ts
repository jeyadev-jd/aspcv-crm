import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { ticketSchema, stripUnsentDefaults } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { requirePermission, resolvePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { activeFilter, enforceActiveOr404, rejectIfInactive } from '../lib/softDelete'
import { claimTicketNumber, slaDueDate } from '../services/ticketNumbering'

const router = createSafeRouter()
router.use(authenticate)

const listInclude = {
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, name: true, phone: true } },
  project: { select: { id: true, title: true, leadNumber: true, status: true } },
  installation: { select: { id: true, title: true, status: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
} as const

/**
 * A ticket may only point at a project/installation belonging to the same
 * company, otherwise the per-company views and reports would double-count it.
 */
async function assertOwnership(
  companyId: string | undefined,
  projectId?: string | null,
  installationId?: string | null,
): Promise<string | null> {
  if (!companyId) return null
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { companyId: true } })
    if (!project) return 'Project not found'
    if (project.companyId !== companyId) return 'Project belongs to a different company'
  }
  if (installationId) {
    const inst = await prisma.installation.findUnique({ where: { id: installationId }, select: { companyId: true } })
    if (!inst) return 'Installation not found'
    if (inst.companyId !== companyId) return 'Installation belongs to a different company'
  }
  return null
}

router.get('/', async (req: AuthRequest, res) => {
  const { status, priority, companyId, projectId, installationId, assignedToId, category, overdue, search, includeInactive } =
    req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'support', 'delete')
  const where = {
    ...activeFilter(includeInactive === 'true' && canManage),
    ...(status && { status: status as any }),
    ...(priority && { priority: priority as any }),
    ...(companyId && { companyId }),
    ...(projectId && { projectId }),
    ...(installationId && { installationId }),
    ...(assignedToId && (assignedToId === 'unassigned' ? { assignedToId: null } : { assignedToId })),
    ...(category && { category }),
    // Past due and not yet finished — the set the SLA report counts as breached.
    ...(overdue === 'true' && {
      dueDate: { lt: new Date() },
      status: { in: ['Open', 'InProgress'] as any },
    }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { ticketNumber: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }
  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: listInclude,
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.supportTicket.count({ where }),
  ])
  res.json(paginate(tickets, total, pagination))
})

/**
 * Aggregate counters for the Support header and the admin Reports ticket tab.
 * Kept separate from /reports so the Support page does not need financial
 * permissions just to render its own summary strip.
 */
router.get('/stats', async (_req: AuthRequest, res) => {
  const now = new Date()
  const base = { isActive: true }
  const [byStatus, byPriority, byCategory, overdue, unassigned, resolvedRecent] = await Promise.all([
    prisma.supportTicket.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
    prisma.supportTicket.groupBy({ by: ['priority'], where: base, _count: { _all: true } }),
    prisma.supportTicket.groupBy({ by: ['category'], where: base, _count: { _all: true } }),
    prisma.supportTicket.count({
      where: { ...base, dueDate: { lt: now }, status: { in: ['Open', 'InProgress'] } },
    }),
    prisma.supportTicket.count({ where: { ...base, assignedToId: null, status: { in: ['Open', 'InProgress'] } } }),
    prisma.supportTicket.findMany({
      where: { ...base, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true, dueDate: true },
      orderBy: { resolvedAt: 'desc' },
      take: 200,
    }),
  ])

  // Mean hours from open to resolved, over the most recent 200 resolutions.
  const durations = resolvedRecent
    .filter(t => t.resolvedAt)
    .map(t => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3_600_000)
  const avgResolutionHours = durations.length
    ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
    : null
  const metSla = resolvedRecent.filter(t => t.dueDate && t.resolvedAt && t.resolvedAt <= t.dueDate).length
  const slaScored = resolvedRecent.filter(t => t.dueDate && t.resolvedAt).length

  res.json({
    byStatus: byStatus.map(r => ({ status: r.status, count: r._count._all })),
    byPriority: byPriority.map(r => ({ priority: r.priority, count: r._count._all })),
    byCategory: byCategory.map(r => ({ category: r.category ?? 'Uncategorised', count: r._count._all })),
    overdue,
    unassigned,
    avgResolutionHours,
    // Null (not 0) when nothing has been resolved yet, so the UI can say
    // "not enough data" instead of showing a misleading 0%.
    slaCompliancePct: slaScored ? Math.round((metSla / slaScored) * 100) : null,
    slaSampleSize: slaScored,
  })
})

router.get('/:id', async (req: AuthRequest, res) => {
  const { includeInactive } = req.query as Record<string, string>
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'support', 'delete')
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id as string },
    include: {
      ...listInclude,
      company: { include: { contacts: { where: { isActive: true } } } },
      contact: true,
    },
  })
  if (!enforceActiveOr404(ticket, includeInactive === 'true' && canManage, res)) return
  res.json(ticket)
})

router.post('/', requirePermission('support', 'create'), async (req: AuthRequest, res) => {
  const data = ticketSchema.parse(req.body)
  const ownershipError = await assertOwnership(data.companyId, data.projectId, data.installationId)
  if (ownershipError) { res.status(400).json({ error: ownershipError }); return }

  const now = new Date()
  const ticket = await prisma.supportTicket.create({
    data: {
      ...data,
      ticketNumber: await claimTicketNumber(now),
      // Explicit dueDate wins; otherwise derive it from priority so every
      // ticket is measurable against an SLA from the moment it is raised.
      dueDate: data.dueDate ?? slaDueDate(data.priority, now),
      createdById: req.user?.id,
    },
    include: listInclude,
  })
  await appendEvent('SupportTicket', ticket.id, 'CREATED', `Ticket ${ticket.ticketNumber ?? ''} "${ticket.title}" opened`.trim(), req.user?.id)
  res.status(201).json(ticket)
})

router.put('/:id', requirePermission('support', 'edit'), async (req: AuthRequest, res) => {
  const existingTicket = await prisma.supportTicket.findUnique({ where: { id: req.params.id as string } })
  if (!rejectIfInactive(existingTicket, res)) return
  const data = stripUnsentDefaults(ticketSchema.partial().parse(req.body), req.body)

  const ownershipError = await assertOwnership(
    data.companyId ?? existingTicket!.companyId,
    data.projectId,
    data.installationId,
  )
  if (ownershipError) { res.status(400).json({ error: ownershipError }); return }

  const ticket = await prisma.supportTicket.update({
    where: { id: req.params.id as string },
    data,
    include: listInclude,
  })
  await appendEvent('SupportTicket', ticket.id, 'UPDATED', `Ticket "${ticket.title}" updated`, req.user?.id)
  res.json(ticket)
})

router.patch('/:id/assign', requirePermission('support', 'edit'), async (req: AuthRequest, res) => {
  const { assignedToId } = req.body as { assignedToId: string | null }
  const ticket = await prisma.supportTicket.update({
    where: { id: req.params.id as string },
    data: { assignedToId: assignedToId || null },
    include: listInclude,
  })
  const who = ticket.assignedTo?.name ?? 'nobody'
  await appendEvent('SupportTicket', ticket.id, 'ASSIGNED', `Ticket assigned to ${who}`, req.user?.id)
  res.json(ticket)
})

router.patch('/:id/status', requirePermission('support', 'edit'), async (req: AuthRequest, res) => {
  const { status } = req.body as { status: string }
  const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const now = new Date()
  // Each timestamp is stamped once. Re-opening and re-resolving keeps the
  // original first-response and resolution times so SLA history stays honest.
  const data: Record<string, unknown> = { status: status as any }
  if (status === 'InProgress' && !existing.firstResponseAt) data.firstResponseAt = now
  if ((status === 'Resolved' || status === 'Closed') && !existing.resolvedAt) data.resolvedAt = now
  if (status === 'Closed' && !existing.closedAt) data.closedAt = now

  const ticket = await prisma.supportTicket.update({
    where: { id: req.params.id as string },
    data,
    include: listInclude,
  })
  await appendEvent('SupportTicket', ticket.id, 'STATUS_CHANGED', `Status changed to ${status}`, req.user?.id)
  res.json(ticket)
})

router.delete('/:id', requirePermission('support', 'delete'), async (req: AuthRequest, res) => {
  const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.isActive === false) { res.json({ success: true }); return } // idempotent
  const ticket = await prisma.supportTicket.update({
    where: { id: req.params.id as string },
    data: { isActive: false },
  })
  await appendEvent('SupportTicket', ticket.id, 'DELETED', `Ticket "${ticket.title}" archived`, req.user?.id)
  res.json({ success: true })
})

/**
 * Bulk archive. Soft-deletes in one statement to match the single-row route,
 * and reports how many rows actually changed so the UI can tell the user when
 * some ids were already archived or gone.
 */
router.post('/bulk-delete', requirePermission('support', 'delete'), async (req: AuthRequest, res) => {
  const { ids } = req.body as { ids?: string[] }
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'ids array required' }); return }
  const targets = await prisma.supportTicket.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true, title: true },
  })
  if (targets.length) {
    await prisma.supportTicket.updateMany({
      where: { id: { in: targets.map(t => t.id) } },
      data: { isActive: false },
    })
    await Promise.all(targets.map(t =>
      appendEvent('SupportTicket', t.id, 'DELETED', `Ticket "${t.title}" archived`, req.user?.id),
    ))
  }
  res.json({ deleted: targets.length, skipped: ids.length - targets.length })
})

router.post('/:id/restore', requirePermission('support', 'delete'), async (req: AuthRequest, res) => {
  const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const ticket = await prisma.supportTicket.update({ where: { id: req.params.id as string }, data: { isActive: true } })
  await appendEvent('SupportTicket', ticket.id, 'RESTORED', `Ticket "${ticket.title}" restored`, req.user?.id)
  res.json(ticket)
})

export default router
