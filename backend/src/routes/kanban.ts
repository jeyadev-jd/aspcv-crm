import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const cards = await prisma.kanbanCard.findMany({ orderBy: [{ columnId: 'asc' }, { order: 'asc' }] })
  res.json(cards)
})

router.post('/', requirePermission('kanban', 'create'), async (req, res) => {
  const { title, category, progress, total, date, comments, attachments, columnId, order } = req.body
  const card = await prisma.kanbanCard.create({
    data: { title, category, progress: Number(progress || 0), total: Number(total || 1), date, comments: Number(comments || 0), attachments: Number(attachments || 0), columnId, order: Number(order || 0) },
  })
  res.status(201).json(card)
})

router.put('/:id', requirePermission('kanban', 'edit'), async (req, res) => {
  const { columnId, order, progress } = req.body
  const card = await prisma.kanbanCard.update({
    where: { id: req.params.id as string },
    data: { columnId, order: order !== undefined ? Number(order) : undefined, progress: progress !== undefined ? Number(progress) : undefined },
  })
  res.json(card)
})

router.delete('/:id', requirePermission('kanban', 'delete'), async (req, res) => {
  await prisma.kanbanCard.delete({ where: { id: req.params.id as string } })
  res.status(204).send()
})

export default router
