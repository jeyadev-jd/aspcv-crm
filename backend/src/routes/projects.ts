import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { projectSchema } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const { status, companyId, dealId } = req.query as Record<string, string>
  const projects = await prisma.project.findMany({
    where: {
      isActive: true,
      ...(status && { status: status as any }),
      ...(companyId && { companyId }),
      ...(dealId && { dealId }),
    },
    include: {
      company: { select: { id: true, name: true } },
      deal: { select: { id: true, title: true } },
      installations: { where: { isActive: true }, select: { id: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(projects)
})

router.get('/:id', async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id as string },
    include: {
      company: { include: { contacts: { where: { isActive: true } } } },
      deal: { select: { id: true, title: true } },
      installations: { where: { isActive: true } },
    },
  })
  if (!project) { res.status(404).json({ error: 'Not found' }); return }
  res.json(project)
})

router.post('/', async (req: AuthRequest, res) => {
  const data = projectSchema.parse(req.body)
  const project = await prisma.project.create({
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
    include: { company: { select: { id: true, name: true } } },
  })
  await appendEvent('Project', project.id, 'CREATED', `Project "${project.title}" created`, req.user?.id)
  res.status(201).json(project)
})

router.put('/:id', async (req: AuthRequest, res) => {
  const data = projectSchema.partial().parse(req.body)
  const project = await prisma.project.update({
    where: { id: req.params.id as string },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
    include: { company: { select: { id: true, name: true } } },
  })
  await appendEvent('Project', project.id, 'UPDATED', `Project "${project.title}" updated`, req.user?.id)
  res.json(project)
})

router.patch('/:id/status', async (req: AuthRequest, res) => {
  const { status } = req.body as { status: string }
  const project = await prisma.project.update({
    where: { id: req.params.id as string },
    data: { status: status as any },
  })
  await appendEvent('Project', project.id, 'STATUS_CHANGED', `Status changed to ${status}`, req.user?.id)
  res.json(project)
})

router.delete('/:id', async (req: AuthRequest, res) => {
  const project = await prisma.project.update({
    where: { id: req.params.id as string },
    data: { isActive: false },
  })
  await appendEvent('Project', project.id, 'DELETED', `Project "${project.title}" archived`, req.user?.id)
  res.json({ success: true })
})

export default router
