import { Router } from 'express'
import prisma from '../lib/prisma'

const router = Router()

router.get('/', async (req, res) => {
  const cards = await prisma.kanbanCard.findMany({ orderBy: [{ columnId: 'asc' }, { order: 'asc' }] })
  res.json(cards)
})

router.post('/', async (req, res) => {
  const { title, category, progress, total, date, comments, attachments, columnId, order } = req.body
  const card = await prisma.kanbanCard.create({
    data: { title, category, progress: Number(progress || 0), total: Number(total || 1), date, comments: Number(comments || 0), attachments: Number(attachments || 0), columnId, order: Number(order || 0) },
  })
  res.status(201).json(card)
})

router.put('/:id', async (req, res) => {
  const { columnId, order, progress } = req.body
  const card = await prisma.kanbanCard.update({
    where: { id: req.params.id },
    data: { columnId, order: order !== undefined ? Number(order) : undefined, progress: progress !== undefined ? Number(progress) : undefined },
  })
  res.json(card)
})

router.delete('/:id', async (req, res) => {
  await prisma.kanbanCard.delete({ where: { id: req.params.id } })
  res.status(204).send()
})

export default router
