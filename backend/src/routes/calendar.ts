import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission, resolvePermission } from '../middleware/permissions'
import { calendarEventSchema } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { createNotification } from '../services/notify'

const router = createSafeRouter()
router.use(authenticate)

/**
 * Which events this user may see:
 *   Everyone   — always visible
 *   Department — visible to members of that department
 *   Private    — visible only to its creator
 * The creator always sees their own events regardless of audience.
 */
function visibilityFilter(userId: string, departmentId: string | null) {
  return {
    OR: [
      { audience: 'Everyone' as const },
      { createdById: userId },
      ...(departmentId ? [{ audience: 'Department' as const, departmentId }] : []),
    ],
  }
}

/**
 * Resolve which department a Department-audience event may target.
 *
 * A client-supplied `departmentId` is only honoured for callers holding
 * calendar:manage — without it the value is ignored entirely and the caller's
 * own department is used. Otherwise any user who can create an event could
 * publish to, and raise notifications for, a department they have no
 * relationship with.
 *
 * Returns the department id, or an error string to return as a 403/400.
 */
async function resolveTargetDepartment(
  req: AuthRequest,
  requested: string | null | undefined,
  ownDepartmentId: string | null,
  fallback: string | null = null,
): Promise<{ departmentId: string } | { error: string; status: number }> {
  if (requested && requested !== ownDepartmentId) {
    const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'calendar', 'manage')
    if (!canManage) {
      return { error: 'You can only schedule department events for your own department', status: 403 }
    }
    const exists = await prisma.department.findFirst({ where: { id: requested, isActive: true }, select: { id: true } })
    if (!exists) return { error: 'Department not found', status: 400 }
    return { departmentId: requested }
  }

  const resolved = requested || ownDepartmentId || fallback
  if (!resolved) {
    return { error: 'You are not assigned to a department — use "Only me" or "Everyone"', status: 400 }
  }
  return { departmentId: resolved }
}

/** Recipients for a newly created event, excluding the creator. */
async function audienceUserIds(
  audience: 'Private' | 'Department' | 'Everyone',
  departmentId: string | null,
  creatorId: string,
): Promise<string[]> {
  if (audience === 'Private') return []
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: creatorId },
      ...(audience === 'Department' ? { departmentId: departmentId ?? '__none__' } : {}),
    },
    select: { id: true },
  })
  return users.map(u => u.id)
}

// Kept as a plain array response (not the paginated {data,page,...} envelope used
// elsewhere) — Dashboard.tsx already consumes GET /calendar as `any[]` directly.
// `limit` bounds the result set for scalability; entityType/entityId/category/from/to
// are additive filters, all optional so existing callers are unaffected.
router.get('/', async (req: AuthRequest, res) => {
  const { entityType, entityId, category, from, to, limit, audience } = req.query as Record<string, string>
  const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { departmentId: true } })
  const where = {
    ...visibilityFilter(req.user!.id, me?.departmentId ?? null),
    ...(entityType && entityId && { entityType, entityId }),
    ...(category && { category: category as any }),
    ...(audience && { audience: audience as any }),
    ...((from || to) && { date: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
  }
  const events = await prisma.calendarEvent.findMany({
    where,
    include: { department: { select: { id: true, name: true } } },
    orderBy: { date: 'asc' },
    take: limit ? Math.min(500, parseInt(limit, 10) || 200) : 200,
  })
  res.json(events)
})

router.post('/', requirePermission('calendar', 'create'), async (req: AuthRequest, res) => {
  const data = calendarEventSchema.parse(req.body)
  const me = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { departmentId: true, name: true },
  })

  let departmentId: string | null = null
  if (data.audience === 'Department') {
    const resolved = await resolveTargetDepartment(req, data.departmentId, me?.departmentId ?? null)
    if ('error' in resolved) { res.status(resolved.status).json({ error: resolved.error }); return }
    departmentId = resolved.departmentId
  }

  const event = await prisma.calendarEvent.create({
    data: {
      ...data,
      departmentId,
      date: new Date(data.date),
      color: data.color || 'blue',
      source: 'Manual',
      createdById: req.user!.id,
    },
    include: { department: { select: { id: true, name: true } } },
  })

  // Fan out to the audience. Fire-and-forget: a notification failure must not
  // fail the event creation the user just confirmed.
  const recipients = await audienceUserIds(data.audience, departmentId, req.user!.id)
  if (recipients.length) {
    const when = event.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    createNotification({
      userIds: recipients,
      type: 'calendar_event',
      severity: 'info',
      title: `New event: ${event.title}`,
      message: `${me?.name ?? 'Someone'} scheduled "${event.title}" on ${when}${event.startTime && event.startTime !== '00:00' ? ` at ${event.startTime}` : ''}.`,
      entityType: 'CalendarEvent',
      entityId: event.id,
    }).catch(() => {})
  }

  if (event.entityType && event.entityId) await appendEvent(event.entityType, event.entityId, 'CALENDAR_EVENT_CREATED', `Calendar event "${event.title}" created`, req.user?.id)
  res.status(201).json(event)
})

router.put('/:id', requirePermission('calendar', 'edit'), async (req: AuthRequest, res) => {
  const data = calendarEventSchema.partial().parse(req.body)
  const existing = await prisma.calendarEvent.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  // Same authorization rule as create: a caller may only retarget the event at
  // their own department unless they hold calendar:manage.
  let departmentId = existing.departmentId
  const audience = data.audience ?? existing.audience
  if (audience === 'Department') {
    const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { departmentId: true } })
    const resolved = await resolveTargetDepartment(
      req,
      data.departmentId,
      me?.departmentId ?? null,
      existing.departmentId,
    )
    if ('error' in resolved) { res.status(resolved.status).json({ error: resolved.error }); return }
    departmentId = resolved.departmentId
  } else {
    departmentId = null
  }

  const event = await prisma.calendarEvent.update({
    where: { id: req.params.id as string },
    data: { ...data, departmentId, date: data.date ? new Date(data.date) : undefined },
    include: { department: { select: { id: true, name: true } } },
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
