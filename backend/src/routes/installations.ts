import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { installationSchema } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { requirePermission } from '../middleware/permissions'
import { getScopeFilter } from '../middleware/scoping'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('installation', 'read_own'), async (req: AuthRequest, res) => {
  const { status, companyId, projectId } = req.query as Record<string, string>
  const scope = await getScopeFilter(req.user!.id, req.user!.roleName, 'installation')
  const installations = await prisma.installation.findMany({
    where: {
      ...scope,
      isActive: true,
      ...(status && { status: status as any }),
      ...(companyId && { companyId }),
      ...(projectId && { projectId }),
    },
    include: {
      company: { select: { id: true, name: true } },
      project: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(installations)
})

router.get('/:id', async (req, res) => {
  const installation = await prisma.installation.findUnique({
    where: { id: req.params.id as string },
    include: {
      company: { select: { id: true, name: true } },
      project: { select: { id: true, title: true } },
    },
  })
  if (!installation) { res.status(404).json({ error: 'Not found' }); return }
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
  res.status(201).json(installation)
})

router.put('/:id', requirePermission('installation', 'edit'), async (req: AuthRequest, res) => {
  const data = installationSchema.partial().parse(req.body)
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
  const installation = await prisma.installation.update({
    where: { id: req.params.id as string },
    data: { isActive: false },
  })
  await appendEvent('Installation', installation.id, 'DELETED', `Installation archived`, req.user?.id)
  res.json({ success: true })
})

export default router
