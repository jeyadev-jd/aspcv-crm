import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const overrideSchema = z.object({
  userId: z.string().min(1),
  locationId: z.string().min(1),
  validFrom: z.string(),
  validUntil: z.string(),
  reason: z.string().optional(),
})

// List all active overrides (admin view)
router.get('/', requirePermission('attendance', 'manage'), async (req, res) => {
  const { userId } = req.query as Record<string, string>
  const where: any = {}
  if (userId) where.userId = userId
  const overrides = await prisma.attendanceLocationOverride.findMany({
    where,
    include: {
      location: { select: { id: true, name: true, address: true } },
    },
    orderBy: { validFrom: 'desc' },
  })
  res.json(overrides)
})

// Get active override for specific user+date (used by checkin route)
router.get('/active', requirePermission('attendance', 'checkin'), async (req: AuthRequest, res) => {
  const { userId, date } = req.query as Record<string, string>
  const targetUser = userId || req.user!.id
  const targetDate = date ? new Date(date) : new Date()

  const override = await prisma.attendanceLocationOverride.findFirst({
    where: {
      userId: targetUser,
      validFrom: { lte: targetDate },
      validUntil: { gte: targetDate },
    },
    include: { location: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json(override)
})

router.post('/', requirePermission('attendance', 'manage'), async (req: AuthRequest, res) => {
  const data = overrideSchema.parse(req.body)

  // Check for overlapping override for same user
  const clash = await prisma.attendanceLocationOverride.findFirst({
    where: {
      userId: data.userId,
      validFrom: { lte: new Date(data.validUntil) },
      validUntil: { gte: new Date(data.validFrom) },
    },
  })
  if (clash) {
    res.status(409).json({ error: 'An overlapping location override already exists for this user in that date range' })
    return
  }

  const override = await prisma.attendanceLocationOverride.create({
    data: {
      userId: data.userId,
      locationId: data.locationId,
      validFrom: new Date(data.validFrom),
      validUntil: new Date(data.validUntil),
      reason: data.reason ?? null,
      createdById: req.user?.id,
    },
    include: { location: { select: { id: true, name: true } } },
  })
  res.status(201).json(override)
})

router.patch('/:id', requirePermission('attendance', 'manage'), async (req, res) => {
  const data = overrideSchema.partial().parse(req.body)
  const override = await prisma.attendanceLocationOverride.update({
    where: { id: req.params.id as string },
    data: {
      ...data,
      validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
      validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
    },
    include: { location: { select: { id: true, name: true } } },
  })
  res.json(override)
})

router.delete('/:id', requirePermission('attendance', 'manage'), async (req, res) => {
  await prisma.attendanceLocationOverride.delete({ where: { id: req.params.id as string } })
  res.status(204).end()
})

export default router
