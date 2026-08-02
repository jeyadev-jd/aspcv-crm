import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { discussionSchema } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { requirePermission } from '../middleware/permissions'
import { syncCalendarEvent } from '../services/calendarSync'

const router = createSafeRouter()
router.use(authenticate)

/**
 * A discussion with a next-follow-up date drops a FollowUp event on the calendar
 * and pings everyone on the thread. Re-saving the same discussion moves the
 * existing event rather than piling up duplicates.
 */
async function syncFollowUp(discussion: {
  id: string; title: string; entityType: string; entityId: string
  followUpAt: Date | null; nextActions?: string | null
}, participantUserIds: string[], actorId?: string) {
  if (!discussion.followUpAt) return
  const at = discussion.followUpAt
  await syncCalendarEvent({
    entityType: 'Discussion',
    entityId: discussion.id,
    category: 'FollowUp',
    title: `Follow-up: ${discussion.title}`,
    date: at,
    startTime: at.toISOString().slice(11, 16),
    description: discussion.nextActions
      ? `Next actions: ${discussion.nextActions}`
      : `Follow-up on ${discussion.entityType} discussion "${discussion.title}"`,
    color: 'orange',
    actorId,
    notifyUserIds: participantUserIds,
  })
}

// GET /api/discussions?entityType=Lead&entityId=xxx
// For entityType=Project: also includes discussions from other entities (Deal/Lead)
// that were explicitly linked in via POST /:id/link-project — a Sales Manager's
// optional, anytime choice to surface a discussion thread to the engineering team.
router.get('/', async (req, res) => {
  const { entityType, entityId } = req.query as Record<string, string>
  if (!entityType || !entityId) {
    res.status(400).json({ error: 'entityType and entityId required' })
    return
  }
  const discussions = await prisma.discussion.findMany({
    where: entityType === 'Project'
      ? { OR: [{ entityType, entityId }, { projectLinks: { some: { projectId: entityId } } }] }
      : { entityType, entityId },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true } },
          contact: { select: { id: true, name: true } }
        }
      },
      attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true, storageKey: true, externalUrl: true } },
      projectLinks: { select: { projectId: true } },
    },
    orderBy: { scheduledAt: 'desc' }
  })
  res.json(discussions)
})

// Sales Manager links an existing Deal/Lead discussion onto a Project — optional,
// can be done at handover time or any time after. Non-destructive: the discussion
// keeps its original entityType/entityId, this just makes it also visible there.
router.post('/:id/link-project', requirePermission('discussion', 'edit_own'), async (req: AuthRequest, res) => {
  const { projectId } = req.body as { projectId?: string }
  if (!projectId) { res.status(400).json({ error: 'projectId required' }); return }
  const [discussion, project] = await Promise.all([
    prisma.discussion.findUnique({ where: { id: req.params.id as string } }),
    prisma.project.findUnique({ where: { id: projectId } }),
  ])
  if (!discussion) { res.status(404).json({ error: 'Discussion not found' }); return }
  if (!project) { res.status(404).json({ error: 'Project not found' }); return }
  const link = await prisma.discussionProjectLink.upsert({
    where: { discussionId_projectId: { discussionId: discussion.id, projectId } },
    update: {},
    create: { discussionId: discussion.id, projectId, linkedById: req.user!.id },
  })
  await appendEvent('Project', projectId, 'DISCUSSION_LINKED', `Discussion "${discussion.title}" linked from ${discussion.entityType}`, req.user?.id)
  res.status(201).json(link)
})

router.delete('/:id/link-project/:projectId', requirePermission('discussion', 'edit_own'), async (req: AuthRequest, res) => {
  await prisma.discussionProjectLink.deleteMany({
    where: { discussionId: req.params.id as string, projectId: req.params.projectId as string },
  })
  res.status(204).end()
})

router.get('/:id', async (req, res) => {
  const d = await prisma.discussion.findUnique({
    where: { id: req.params.id as string },
    include: {
      participants: { include: { user: { select: { id: true, name: true } }, contact: { select: { id: true, name: true } } } },
      attachments: true
    }
  })
  if (!d) { res.status(404).json({ error: 'Not found' }); return }
  res.json(d)
})

router.post('/', requirePermission('discussion', 'create'), async (req: AuthRequest, res) => {
  const data = discussionSchema.parse(req.body)
  const { participantUserIds, participantContactIds, entityType, entityId, ...rest } = data
  const discussion = await prisma.discussion.create({
    data: {
      entityType,
      entityId,
      ...rest,
      scheduledAt: rest.scheduledAt ? new Date(rest.scheduledAt) : undefined,
      followUpAt: rest.followUpAt ? new Date(rest.followUpAt) : undefined,
      participants: {
        create: [
          ...(participantUserIds ?? []).map(userId => ({ userId })),
          ...(participantContactIds ?? []).map(contactId => ({ contactId })),
        ]
      }
    },
    include: {
      participants: { include: { user: { select: { id: true, name: true } }, contact: { select: { id: true, name: true } } } }
    }
  })
  await appendEvent(entityType, entityId, 'DISCUSSION_ADDED', `Discussion "${discussion.title}" logged`, req.user?.id)
  await syncFollowUp(discussion, [...new Set([...(participantUserIds ?? []), req.user!.id])], req.user?.id)
  res.status(201).json(discussion)
})

router.patch('/:id', requirePermission('discussion', 'edit_own'), async (req: AuthRequest, res) => {
  const existing = await prisma.discussion.findUnique({
    where: { id: req.params.id as string },
    include: { participants: { where: { userId: req.user!.id } } }
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const isOwn = existing.participants.length > 0
  const isAdmin = ['SuperAdmin', 'Manager', 'ProjectHead', 'BusinessHead'].includes(req.user!.roleName ?? req.user!.role)
  if (!isOwn && !isAdmin) { res.status(403).json({ error: 'Forbidden' }); return }

  const data = discussionSchema.partial().parse(req.body)
  const { participantUserIds, participantContactIds, entityType, entityId, ...rest } = data
  const discussion = await prisma.discussion.update({
    where: { id: req.params.id as string },
    data: {
      ...rest,
      scheduledAt: rest.scheduledAt ? new Date(rest.scheduledAt) : undefined,
      followUpAt: rest.followUpAt ? new Date(rest.followUpAt) : undefined,
    },
    include: { participants: { include: { user: true, contact: true } } }
  })
  const threadUserIds = discussion.participants
    .map(p => p.userId)
    .filter((id): id is string => Boolean(id))
  await syncFollowUp(discussion, [...new Set([...threadUserIds, req.user!.id])], req.user?.id)
  res.json(discussion)
})

router.delete('/:id', async (req: AuthRequest, res) => {
  const d = await prisma.discussion.findUnique({
    where: { id: req.params.id as string },
    include: { participants: { where: { userId: req.user!.id } } }
  })
  if (!d) { res.status(404).json({ error: 'Not found' }); return }
  const isOwn = d.participants.length > 0
  const isAdmin = ['SuperAdmin', 'Manager', 'ProjectHead', 'BusinessHead'].includes(req.user!.roleName ?? req.user!.role)
  if (!isOwn && !isAdmin) { res.status(403).json({ error: 'Forbidden' }); return }
  await prisma.discussion.delete({ where: { id: req.params.id as string } })
  res.status(204).end()
})

export default router
