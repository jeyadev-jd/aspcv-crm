import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { installationSchema, stripUnsentDefaults } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { requirePermission, resolvePermission } from '../middleware/permissions'
import { getScopeFilter } from '../middleware/scoping'
import { parsePagination, paginate } from '../lib/pagination'
import { activeFilter, enforceActiveOr404, rejectIfInactive } from '../lib/softDelete'
import { syncCalendarEvent, removeCalendarEvent } from '../services/calendarSync'

const router = createSafeRouter()
router.use(authenticate)

router.get('/', requirePermission('installation', 'read_own'), async (req: AuthRequest, res) => {
  const { status, companyId, projectId, includeInactive } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
  const scope = await getScopeFilter(req.user!.id, req.user!.roleName, 'installation')
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'installation', 'delete')
  const where = {
    ...scope,
    ...activeFilter(includeInactive === 'true' && canManage),
    ...(status && { status: status as any }),
    ...(companyId && { companyId }),
    ...(projectId && { projectId }),
  }
  const [installations, total] = await Promise.all([
    prisma.installation.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.installation.count({ where }),
  ])
  res.json(paginate(installations, total, pagination))
})

router.get('/:id', requirePermission('installation', 'read_own'), async (req: AuthRequest, res) => {
  const { includeInactive } = req.query as Record<string, string>
  const installation = await prisma.installation.findUnique({
    where: { id: req.params.id as string },
    include: {
      company: { select: { id: true, name: true } },
      project: { select: { id: true, title: true } },
    },
  })
  const canReadAll = await resolvePermission(req.user!.id, req.user!.roleName, 'installation', 'read_all')
  if (!canReadAll && installation && installation.createdById !== req.user!.id) { res.status(403).json({ error: 'Insufficient permissions' }); return }
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'installation', 'delete')
  if (!enforceActiveOr404(installation, includeInactive === 'true' && canManage, res)) return
  res.json(installation)
})

router.post('/', requirePermission('installation', 'create'), async (req: AuthRequest, res) => {
  const data = installationSchema.parse(req.body)
  const installation = await prisma.installation.create({
    data: {
      ...data,
      createdById: req.user!.id,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
      completedDate: data.completedDate ? new Date(data.completedDate) : undefined,
    },
    include: { company: { select: { id: true, name: true } } },
  })
  await appendEvent('Installation', installation.id, 'CREATED', `Installation "${installation.title}" created`, req.user?.id)
  if (installation.scheduledDate) {
    await syncCalendarEvent({
      entityType: 'Installation', entityId: installation.id, category: 'Installation',
      title: `Installation: ${installation.title}`, date: installation.scheduledDate,
      description: installation.notes ?? undefined, actorId: req.user?.id,
    })
  }
  res.status(201).json(installation)
})

router.put('/:id', requirePermission('installation', 'edit'), async (req: AuthRequest, res) => {
  const existingInst = await prisma.installation.findUnique({ where: { id: req.params.id as string } })
  if (!rejectIfInactive(existingInst, res)) return
  const data = stripUnsentDefaults(installationSchema.partial().parse(req.body), req.body)
  const installation = await prisma.installation.update({
    where: { id: req.params.id as string },
    data: {
      ...data,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
      completedDate: data.completedDate ? new Date(data.completedDate) : undefined,
    },
    include: { company: { select: { id: true, name: true } } },
  })
  await appendEvent('Installation', installation.id, 'UPDATED', `Installation "${installation.title}" updated`, req.user?.id)
  if (installation.scheduledDate) {
    await syncCalendarEvent({
      entityType: 'Installation', entityId: installation.id, category: 'Installation',
      title: `Installation: ${installation.title}`, date: installation.scheduledDate,
      description: installation.notes ?? undefined, actorId: req.user?.id,
    })
  } else {
    await removeCalendarEvent('Installation', installation.id, 'Installation')
  }
  res.json(installation)
})

router.patch('/:id/status', requirePermission('installation', 'edit'), async (req: AuthRequest, res) => {
  const { status } = req.body as { status: string }
  const installation = await prisma.installation.update({
    where: { id: req.params.id as string },
    data: { status: status as any },
  })
  await appendEvent('Installation', installation.id, 'STATUS_CHANGED', `Status changed to ${status}`, req.user?.id)
  res.json(installation)
})

router.delete('/:id', requirePermission('installation', 'delete'), async (req: AuthRequest, res) => {
  const existing = await prisma.installation.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.isActive === false) { res.json({ success: true }); return } // idempotent
  const installation = await prisma.installation.update({
    where: { id: req.params.id as string },
    data: { isActive: false },
  })
  await appendEvent('Installation', installation.id, 'DELETED', `Installation archived`, req.user?.id)
  await removeCalendarEvent('Installation', installation.id, 'Installation')
  res.json({ success: true })
})

router.post('/:id/restore', requirePermission('installation', 'delete'), async (req: AuthRequest, res) => {
  const existing = await prisma.installation.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const installation = await prisma.installation.update({ where: { id: req.params.id as string }, data: { isActive: true } })
  await appendEvent('Installation', installation.id, 'RESTORED', `Installation "${installation.title}" restored`, req.user?.id)
  res.json(installation)
})

export default router
