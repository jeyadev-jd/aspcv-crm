import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { ticketSchema } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { requirePermission } from '../middleware/permissions'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const { status, priority, companyId } = req.query as Record<string, string>
  const tickets = await prisma.supportTicket.findMany({
    where: {
      isActive: true,
      ...(status && { status: status as any }),
      ...(priority && { priority: priority as any }),
      ...(companyId && { companyId }),
    },
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(tickets)
})

router.get('/:id', async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id as string },
    include: {
      company: { include: { contacts: { where: { isActive: true } } } },
      contact: true,
    },
  })
  if (!ticket) { res.status(404).json({ error: 'Not found' }); return }
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
  const data = ticketSchema.partial().parse(req.body)
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
  const ticket = await prisma.supportTicket.update({
    where: { id: req.params.id as string },
    data: { isActive: false },
  })
  await appendEvent('SupportTicket', ticket.id, 'DELETED', `Ticket "${ticket.title}" archived`, req.user?.id)
  res.json({ success: true })
})

export default router
