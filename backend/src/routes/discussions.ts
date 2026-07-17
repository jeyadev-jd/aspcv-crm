import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { discussionSchema } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { requirePermission } from '../middleware/permissions'

const router = createSafeRouter()
router.use(authenticate)

// GET /api/discussions?entityType=Lead&entityId=xxx
router.get('/', async (req, res) => {
  const { entityType, entityId } = req.query as Record<string, string>
  if (!entityType || !entityId) {
    res.status(400).json({ error: 'entityType and entityId required' })
    return
  }
  const discussions = await prisma.discussion.findMany({
    where: { entityType, entityId },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true } },
          contact: { select: { id: true, name: true } }
        }
      },
      attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true, storageKey: true } }
    },
    orderBy: { scheduledAt: 'desc' }
  })
  res.json(discussions)
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
