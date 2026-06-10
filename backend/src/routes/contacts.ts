import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { contactSchema } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const { companyId, q } = req.query as Record<string, string>
  const contacts = await prisma.contact.findMany({
    where: {
      isActive: true,
      ...(companyId && { companyId }),
      ...(q && { name: { contains: q, mode: 'insensitive' } }),
    },
    include: { company: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  })
  res.json(contacts)
})

router.get('/:id', async (req, res) => {
  const contact = await prisma.contact.findUnique({
    where: { id: req.params.id as string },
    include: { company: true }
  })
  if (!contact) { res.status(404).json({ error: 'Not found' }); return }
  res.json(contact)
})

router.post('/', async (req: AuthRequest, res) => {
  const data = contactSchema.parse(req.body)
  const contact = await prisma.contact.create({ data, include: { company: { select: { id: true, name: true } } } })
  await appendEvent('Contact', contact.id, 'CREATED', `Contact "${contact.name}" created`, req.user?.id)
  res.status(201).json(contact)
})

router.patch('/:id', async (req: AuthRequest, res) => {
  const data = contactSchema.partial().parse(req.body)
  const contact = await prisma.contact.update({
    where: { id: req.params.id as string },
    data,
    include: { company: { select: { id: true, name: true } } }
  })
  await appendEvent('Contact', contact.id, 'UPDATED', `Contact updated`, req.user?.id)
  res.json(contact)
})

router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.contact.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

export default router
