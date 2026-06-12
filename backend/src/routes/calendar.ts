import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const events = await prisma.calendarEvent.findMany({ orderBy: { date: 'asc' } })
  res.json(events)
})

router.post('/', requirePermission('calendar', 'create'), async (req, res) => {
  const { title, description, date, startTime, endTime, color } = req.body
  const event = await prisma.calendarEvent.create({
    data: { title, description, date: new Date(date), startTime, endTime, color: color || 'blue' },
  })
  res.status(201).json(event)
})

router.put('/:id', requirePermission('calendar', 'edit'), async (req, res) => {
  const { title, description, date, startTime, endTime, color } = req.body
  const event = await prisma.calendarEvent.update({
    where: { id: req.params.id as string },
    data: { title, description, date: date ? new Date(date) : undefined, startTime, endTime, color },
  })
  res.json(event)
})

router.delete('/:id', requirePermission('calendar', 'delete'), async (req, res) => {
  await prisma.calendarEvent.delete({ where: { id: req.params.id as string } })
  res.status(204).send()
})

export default router
