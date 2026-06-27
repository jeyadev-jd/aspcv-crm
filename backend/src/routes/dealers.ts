import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { z } from 'zod'

const router = Router()
router.use(authenticate)

const contactSchema = z.object({
  name: z.string().min(1),
  designation: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  whatsapp: z.string().optional(),
  isPrimary: z.boolean().optional(),
})

const dealerSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  gstNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  contacts: z.array(contactSchema).optional(),
})

const INCLUDE = { contacts: { orderBy: { isPrimary: 'desc' as const } } }

router.get('/', async (req, res) => {
  const { q } = req.query as Record<string, string>
  const dealers = await prisma.dealer.findMany({
    where: { isActive: true, ...(q && { name: { contains: q, mode: 'insensitive' } }) },
    include: INCLUDE,
    orderBy: { name: 'asc' },
  })
  res.json(dealers)
})

router.get('/:id', async (req, res) => {
  const dealer = await prisma.dealer.findUnique({ where: { id: req.params.id as string }, include: INCLUDE })
  if (!dealer) { res.status(404).json({ error: 'Not found' }); return }
  res.json(dealer)
})

router.post('/', async (req: AuthRequest, res) => {
  const data = dealerSchema.parse(req.body)
  const { contacts, ...rest } = data
  const dealer = await prisma.dealer.create({
    data: {
      ...rest,
      createdById: req.user!.id,
      contacts: contacts?.length ? { create: contacts } : undefined,
    },
    include: INCLUDE,
  })
  res.status(201).json(dealer)
})

router.put('/:id', async (req, res) => {
  const data = dealerSchema.partial().parse(req.body)
  const { contacts, ...rest } = data
  if (contacts) {
    // replace-all contacts (they lack stable IDs from the form)
    await prisma.dealerContact.deleteMany({ where: { dealerId: req.params.id as string } })
  }
  const dealer = await prisma.dealer.update({
    where: { id: req.params.id as string },
    data: {
      ...rest,
      ...(contacts ? { contacts: { create: contacts } } : {}),
    },
    include: INCLUDE,
  })
  res.json(dealer)
})

router.delete('/:id', async (req, res) => {
  await prisma.dealer.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

export default router
