import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const tasks = await prisma.task.findMany({ orderBy: { createdAt: 'desc' } })
  res.json(tasks)
})

router.post('/', requirePermission('task', 'create'), async (req, res) => {
  const { title, status, subtasks, completed, comments, attachments } = req.body
  const task = await prisma.task.create({
    data: { title, status, subtasks: Number(subtasks || 0), completed: Number(completed || 0), comments: Number(comments || 0), attachments: Number(attachments || 0) },
  })
  res.status(201).json(task)
})

router.put('/:id', requirePermission('task', 'edit'), async (req, res) => {
  const { title, status, checked } = req.body
  const task = await prisma.task.update({
    where: { id: req.params.id as string },
    data: { title, status, checked },
  })
  res.json(task)
})

router.delete('/:id', requirePermission('task', 'delete'), async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id as string } })
  res.status(204).send()
})

export default router
