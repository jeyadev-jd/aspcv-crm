import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const { entityType, entityId, limit = '50' } = req.query as Record<string, string>
  if (!entityType || !entityId) {
    res.status(400).json({ error: 'entityType and entityId required' })
    return
  }
  const events = await prisma.timelineEvent.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit, 10),
  })
  res.json(events)
})

export default router
