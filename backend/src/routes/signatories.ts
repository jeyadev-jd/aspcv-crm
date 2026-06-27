import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

router.get('/', async (_req, res) => {
  const rows = await prisma.signatory.findMany({ orderBy: { createdAt: 'asc' } })
  res.json(rows)
})

router.post('/', async (req, res) => {
  const { name, designation, signatureData, isDefault } = req.body
  if (!name) { res.status(400).json({ error: 'name required' }); return }
  if (isDefault) await prisma.signatory.updateMany({ data: { isDefault: false } })
  const row = await prisma.signatory.create({ data: { name, designation, signatureData, isDefault: !!isDefault } })
  res.status(201).json(row)
})

router.patch('/:id', async (req, res) => {
  const { name, designation, signatureData, isDefault } = req.body
  if (isDefault) await prisma.signatory.updateMany({ data: { isDefault: false } })
  const row = await prisma.signatory.update({ where: { id: req.params.id as string }, data: { name, designation, signatureData, isDefault } })
  res.json(row)
})

router.delete('/:id', async (req, res) => {
  await prisma.signatory.delete({ where: { id: req.params.id as string } })
  res.status(204).send()
})

export default router
