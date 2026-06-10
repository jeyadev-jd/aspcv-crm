import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { companySchema } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

const INCLUDE = { _count: { select: { contacts: true, leads: true } } }

router.get('/', async (req, res) => {
  const { q, customerType } = req.query as Record<string, string>
  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      ...(q && { name: { contains: q, mode: 'insensitive' } }),
      ...(customerType && { customerType: customerType as any }),
    },
    include: INCLUDE,
    orderBy: { name: 'asc' },
  })
  res.json(companies)
})

router.get('/:id', async (req, res) => {
  const company = await prisma.company.findUnique({
    where: { id: req.params.id as string },
    include: { contacts: { where: { isActive: true } }, leads: { where: { isActive: true }, orderBy: { createdAt: 'desc' } } }
  })
  if (!company) { res.status(404).json({ error: 'Not found' }); return }
  res.json(company)
})

router.post('/', async (req: AuthRequest, res) => {
  const data = companySchema.parse(req.body)
  const company = await prisma.company.create({ data: data as any, include: INCLUDE })
  await appendEvent('Company', company.id, 'CREATED', `Company "${company.name}" created`, req.user?.id)
  res.status(201).json(company)
})

router.patch('/:id', async (req: AuthRequest, res) => {
  const data = companySchema.partial().parse(req.body)
  const company = await prisma.company.update({ where: { id: req.params.id as string }, data: data as any, include: INCLUDE })
  await appendEvent('Company', company.id, 'UPDATED', `Company updated`, req.user?.id)
  res.json(company)
})

router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.company.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

export default router
