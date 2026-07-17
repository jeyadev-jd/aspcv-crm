import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = createSafeRouter()
router.use(authenticate)

router.get('/:contactId/events', async (req, res) => {
  const events = await prisma.contactEvent.findMany({
    where: { contactId: req.params.contactId as string },
    orderBy: { eventDate: 'asc' },
  })
  res.json(events)
})

router.post('/:contactId/events', requirePermission('contact', 'edit'), async (req, res) => {
  const { type, title, eventDate, recurring, notes } = req.body
  const event = await prisma.contactEvent.create({
    data: {
      contactId: req.params.contactId as string,
      type: type || 'custom',
      title,
      eventDate: new Date(eventDate),
      recurring: recurring !== false,
      notes: notes || null,
    },
  })
  res.status(201).json(event)
})

router.patch('/:contactId/events/:eventId', requirePermission('contact', 'edit'), async (req, res) => {
  const { type, title, eventDate, recurring, notes } = req.body
  const event = await prisma.contactEvent.update({
    where: { id: req.params.eventId as string },
    data: {
      ...(type && { type }),
      ...(title && { title }),
      ...(eventDate && { eventDate: new Date(eventDate) }),
      ...(recurring !== undefined && { recurring }),
      ...(notes !== undefined && { notes }),
    },
  })
  res.json(event)
})

router.delete('/:contactId/events/:eventId', requirePermission('contact', 'edit'), async (req, res) => {
  await prisma.contactEvent.delete({ where: { id: req.params.eventId as string } })
  res.status(204).end()
})

// Upcoming events across all contacts (for dashboard/reminders)
router.get('/upcoming', async (_req, res) => {
  const events = await prisma.contactEvent.findMany({
    include: { contact: { select: { id: true, name: true, companyId: true } } },
    orderBy: { eventDate: 'asc' },
  })
  res.json(events)
})

export default router
