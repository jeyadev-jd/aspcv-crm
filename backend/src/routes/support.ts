import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { ticketSchema, stripUnsentDefaults } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { requirePermission, resolvePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { activeFilter, enforceActiveOr404, rejectIfInactive } from '../lib/softDelete'

const router = createSafeRouter()
router.use(authenticate)

router.get('/', async (req: AuthRequest, res) => {
  const { status, priority, companyId, includeInactive } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'support', 'delete')
  const where = {
    ...activeFilter(includeInactive === 'true' && canManage),
    ...(status && { status: status as any }),
    ...(priority && { priority: priority as any }),
    ...(companyId && { companyId }),
  }
  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.supportTicket.count({ where }),
  ])
  res.json(paginate(tickets, total, pagination))
})

router.get('/:id', async (req: AuthRequest, res) => {
  const { includeInactive } = req.query as Record<string, string>
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'support', 'delete')
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id as string },
    include: {
      company: { include: { contacts: { where: { isActive: true } } } },
      contact: true,
    },
  })
  if (!enforceActiveOr404(ticket, includeInactive === 'true' && canManage, res)) return
  res.json(ticket)
})

router.post('/', requirePermission('support', 'create'), async (req: AuthRequest, res) => {
  const data = ticketSchema.parse(req.body)
  const ticket = await prisma.supportTicket.create({
    data,
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
    },
  })
  await appendEvent('SupportTicket', ticket.id, 'CREATED', `Ticket "${ticket.title}" opened`, req.user?.id)
  res.status(201).json(ticket)
})

router.put('/:id', requirePermission('support', 'edit'), async (req: AuthRequest, res) => {
  const existingTicket = await prisma.supportTicket.findUnique({ where: { id: req.params.id as string } })
  if (!rejectIfInactive(existingTicket, res)) return
  const data = stripUnsentDefaults(ticketSchema.partial().parse(req.body), req.body)
  const ticket = await prisma.supportTicket.update({
    where: { id: req.params.id as string },
    data,
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
    },
  })
  await appendEvent('SupportTicket', ticket.id, 'UPDATED', `Ticket "${ticket.title}" updated`, req.user?.id)
  res.json(ticket)
})

router.patch('/:id/status', requirePermission('support', 'edit'), async (req: AuthRequest, res) => {
  const { status } = req.body as { status: string }
  const resolvedAt = status === 'Resolved' || status === 'Closed' ? new Date() : undefined
  const ticket = await prisma.supportTicket.update({
    where: { id: req.params.id as string },
    data: { status: status as any, ...(resolvedAt && { resolvedAt }) },
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

router.post('/:id/restore', requirePermission('support', 'delete'), async (req: AuthRequest, res) => {
  const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const ticket = await prisma.supportTicket.update({ where: { id: req.params.id as string }, data: { isActive: true } })
  await appendEvent('SupportTicket', ticket.id, 'RESTORED', `Ticket "${ticket.title}" restored`, req.user?.id)
  res.json(ticket)
})

export default router
