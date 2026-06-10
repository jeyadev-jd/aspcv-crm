import { Router } from 'express'
import prisma from '../lib/prisma'

const router = Router()

router.get('/', async (req, res) => {
  const tasks = await prisma.task.findMany({ orderBy: { createdAt: 'desc' } })
  res.json(tasks)
})

router.post('/', async (req, res) => {
  const { title, status, subtasks, completed, comments, attachments } = req.body
  const task = await prisma.task.create({
    data: { title, status, subtasks: Number(subtasks || 0), completed: Number(completed || 0), comments: Number(comments || 0), attachments: Number(attachments || 0) },
  })
  res.status(201).json(task)
})

router.put('/:id', async (req, res) => {
  const { title, status, checked } = req.body
  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: { title, status, checked },
  })
  res.json(task)
})

router.delete('/:id', async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id } })
  res.status(204).send()
})

export default router
