import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'

const router = createSafeRouter()
router.use(authenticate)
router.use(requirePermission('audit_log', 'read_all'))

router.get('/', async (req, res) => {
  const { module, action, userId, q, from, to } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
  const searchTerm = q || pagination.search
  const where: any = {
    ...(module && { module }),
    ...(action && { action }),
    ...(userId && { userId }),
    ...((from || to) && { createdAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    ...(searchTerm && {
      OR: [
        { userName: { contains: searchTerm, mode: 'insensitive' } },
        { module: { contains: searchTerm, mode: 'insensitive' } },
        { entityId: { contains: searchTerm, mode: 'insensitive' } },
        { reason: { contains: searchTerm, mode: 'insensitive' } },
      ],
    }),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { [pagination.sort as string]: pagination.order }, take: pagination.take, skip: pagination.skip }),
    prisma.auditLog.count({ where }),
  ])
  res.json(paginate(logs, total, pagination))
})

router.get('/export', async (req, res) => {
  const { module, action, userId, from, to } = req.query as Record<string, string>
  const where: any = {
    ...(module && { module }),
    ...(action && { action }),
    ...(userId && { userId }),
    ...((from || to) && { createdAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
  }
  const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 5000 })

  const header = ['Timestamp', 'User', 'Role', 'Action', 'Module', 'EntityId', 'Reason', 'IP', 'Browser']
  const rows = logs.map(l => [
    l.createdAt.toISOString(), l.userName ?? '', l.roleName ?? '', l.action, l.module, l.entityId ?? '', l.reason ?? '', l.ipAddress ?? '', (l.userAgent ?? '').replace(/,/g, ';'),
  ])
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"')
  res.send(csv)
})

router.get('/modules', async (_req, res) => {
  const rows = await prisma.auditLog.findMany({ distinct: ['module'], select: { module: true } })
  res.json(rows.map(r => r.module).sort())
})

export default router
