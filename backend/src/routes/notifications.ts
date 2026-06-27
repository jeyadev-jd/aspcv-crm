import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/notifications/my
router.get('/my', async (req: AuthRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  const unread = notifications.filter(n => !n.read).length
  res.json({ notifications, unread })
})

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req: AuthRequest, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id as string, userId: req.user!.id },
    data: { read: true },
  })
  res.json({ success: true })
})

// PATCH /api/notifications/read-all
router.patch('/read-all/mark', async (req: AuthRequest, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, read: false },
    data: { read: true },
  })
  res.json({ success: true })
})

// DELETE /api/notifications/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.notification.deleteMany({ where: { id: req.params.id as string, userId: req.user!.id } })
  res.status(204).end()
})

export default router
