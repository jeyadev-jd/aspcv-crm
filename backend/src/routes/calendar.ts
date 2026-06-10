import { Router } from 'express'
import prisma from '../lib/prisma'

const router = Router()

router.get('/', async (req, res) => {
  const events = await prisma.calendarEvent.findMany({ orderBy: { date: 'asc' } })
  res.json(events)
})

router.post('/', async (req, res) => {
  const { title, description, date, startTime, endTime, color } = req.body
  const event = await prisma.calendarEvent.create({
    data: { title, description, date: new Date(date), startTime, endTime, color: color || 'blue' },
  })
  res.status(201).json(event)
})

router.put('/:id', async (req, res) => {
  const { title, description, date, startTime, endTime, color } = req.body
  const event = await prisma.calendarEvent.update({
    where: { id: req.params.id },
    data: { title, description, date: date ? new Date(date) : undefined, startTime, endTime, color },
  })
  res.json(event)
})

router.delete('/:id', async (req, res) => {
  await prisma.calendarEvent.delete({ where: { id: req.params.id } })
  res.status(204).send()
})

export default router
