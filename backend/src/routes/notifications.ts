import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { runNotificationScan } from '../services/notificationScan'
import { runApprovalEscalation } from '../services/approvalEscalation'
import { runAllRules } from '../services/rulesEngine'
import '../services/businessRules' // registers rule handlers as a side effect
import { parsePagination, paginate } from '../lib/pagination'

const router = createSafeRouter()
router.use(authenticate)

const SCAN_INTERVAL_MS = 5 * 60_000
let lastScanAt = 0

// GET /api/notifications/my
router.get('/my', async (req: AuthRequest, res) => {
  if (Date.now() - lastScanAt > SCAN_INTERVAL_MS) {
    lastScanAt = Date.now()
    runNotificationScan().catch(() => {}) // fire-and-forget, don't block this request
    runApprovalEscalation().catch(() => {})
    runAllRules().catch(() => {})
  }

  const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
  const where = { userId: req.user!.id }
  const [notifications, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, read: false } }),
  ])
  res.json({ ...paginate(notifications, total, pagination), unread })
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
