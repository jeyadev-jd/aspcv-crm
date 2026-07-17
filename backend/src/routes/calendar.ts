import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { calendarEventSchema } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'

const router = createSafeRouter()
router.use(authenticate)

// Kept as a plain array response (not the paginated {data,page,...} envelope used
// elsewhere) — Dashboard.tsx already consumes GET /calendar as `any[]` directly.
// `limit` bounds the result set for scalability; entityType/entityId/category/from/to
// are additive filters, all optional so existing callers are unaffected.
router.get('/', async (req, res) => {
  const { entityType, entityId, category, from, to, limit } = req.query as Record<string, string>
  const where = {
    ...(entityType && entityId && { entityType, entityId }),
    ...(category && { category: category as any }),
    ...((from || to) && { date: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
  }
  const events = await prisma.calendarEvent.findMany({
    where,
    orderBy: { date: 'asc' },
    take: limit ? Math.min(500, parseInt(limit, 10) || 200) : 200,
  })
  res.json(events)
})

router.post('/', requirePermission('calendar', 'create'), async (req: AuthRequest, res) => {
  const data = calendarEventSchema.parse(req.body)
  const event = await prisma.calendarEvent.create({
    data: { ...data, date: new Date(data.date), color: data.color || 'blue', source: 'Manual', createdById: req.user!.id },
  })
  if (event.entityType && event.entityId) await appendEvent(event.entityType, event.entityId, 'CALENDAR_EVENT_CREATED', `Calendar event "${event.title}" created`, req.user?.id)
  res.status(201).json(event)
})

router.put('/:id', requirePermission('calendar', 'edit'), async (req: AuthRequest, res) => {
  const data = calendarEventSchema.partial().parse(req.body)
  const event = await prisma.calendarEvent.update({
    where: { id: req.params.id as string },
    data: { ...data, date: data.date ? new Date(data.date) : undefined },
  })
  if (event.entityType && event.entityId) await appendEvent(event.entityType, event.entityId, 'CALENDAR_EVENT_UPDATED', `Calendar event "${event.title}" updated`, req.user?.id)
  res.json(event)
})

router.delete('/:id', requirePermission('calendar', 'delete'), async (req: AuthRequest, res) => {
  const event = await prisma.calendarEvent.findUnique({ where: { id: req.params.id as string } })
  if (!event) { res.status(404).json({ error: 'Not found' }); return }
  await prisma.calendarEvent.delete({ where: { id: req.params.id as string } })
  if (event.entityType && event.entityId) await appendEvent(event.entityType, event.entityId, 'CALENDAR_EVENT_DELETED', `Calendar event "${event.title}" deleted`, req.user?.id)
  res.status(204).send()
})

export default router
