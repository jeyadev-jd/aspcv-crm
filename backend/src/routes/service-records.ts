import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { appendEvent } from '../services/timeline'
import { parsePagination, paginate } from '../lib/pagination'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const serviceRecordUpdateSchema = z.object({
  productDescription: z.string().optional(),
  installationDate: z.string().optional(),
  warrantyStart: z.string().optional(),
  warrantyEnd: z.string().optional(),
  warrantyMonths: z.number().optional(),
  serviceEngineerId: z.string().optional(),
  serviceCost: z.number().optional(),
  notes: z.string().optional(),
})

const serviceRequestSchema = z.object({
  type: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.string().optional(),
  engineerId: z.string().optional(),
  engineerName: z.string().optional(),
  // Extra crew beyond the primary engineerId — a job can need more than one hand.
  additionalEngineerIds: z.array(z.string()).optional(),
  spareParts: z.array(z.any()).optional(),
  cost: z.number().optional(),
})

const serviceRequestUpdateSchema = z.object({
  status: z.string().optional(),
  engineerId: z.string().optional(),
  engineerName: z.string().optional(),
  spareParts: z.array(z.any()).optional(),
  cost: z.number().optional(),
  resolvedAt: z.string().optional(),
})

router.get('/', requirePermission('service_record', 'read_all'), async (req, res) => {
  try {
    const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
    const [records, total] = await Promise.all([
      prisma.serviceRecord.findMany({
        include: {
          project: { select: { id: true, title: true, company: { select: { name: true } } } },
          serviceRequests: {
            include: { engineers: { include: { user: { select: { id: true, name: true, role: true } } } } },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { [pagination.sort as string]: pagination.order },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.serviceRecord.count(),
    ])
    res.json(paginate(records, total, pagination))
  } catch (e) { res.status(500).json({ error: 'Failed to fetch service records' }) }
})

const WARRANTY_PROJECT_INCLUDE = {
  project: { select: { id: true, title: true, companyId: true, company: { select: { id: true, name: true } } } },
} as const

router.get('/warranty-expiring', requirePermission('service_record', 'read_all'), async (req, res) => {
  try {
    const days = parseInt(String(req.query.days || '30'))
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + days)
    const records = await prisma.serviceRecord.findMany({
      where: { warrantyEnd: { lte: cutoff, gte: new Date() } },
      include: WARRANTY_PROJECT_INCLUDE,
      orderBy: { warrantyEnd: 'asc' },
    })
    res.json(records)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch expiring warranties' }) }
})

// Already past their warranty end date. The expiring list deliberately excludes
// these, so without this endpoint a lapsed warranty disappears from the UI
// entirely on the day it expires.
router.get('/warranty-expired', requirePermission('service_record', 'read_all'), async (req, res) => {
  try {
    const records = await prisma.serviceRecord.findMany({
      where: { warrantyEnd: { lt: new Date() } },
      include: WARRANTY_PROJECT_INCLUDE,
      // Most recently lapsed first — those are the ones still worth chasing.
      orderBy: { warrantyEnd: 'desc' },
    })
    res.json(records)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch expired warranties' }) }
})

router.get('/:id', requirePermission('service_record', 'read_all'), async (req, res) => {
  try {
    const record = await prisma.serviceRecord.findUnique({
      where: { id: (req.params.id as string) },
      include: {
        project: { include: { company: true } },
        serviceRequests: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!record) return res.status(404).json({ error: 'Not found' })
    res.json(record)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch service record' }) }
})

router.put('/:id', requirePermission('service_record', 'edit'), async (req, res) => {
  try {
    const data = serviceRecordUpdateSchema.parse(req.body)
    const record = await prisma.serviceRecord.update({
      where: { id: (req.params.id as string) },
      data: {
        productDescription: data.productDescription,
        installationDate: data.installationDate ? new Date(data.installationDate) : undefined,
        warrantyStart: data.warrantyStart ? new Date(data.warrantyStart) : undefined,
        warrantyEnd: data.warrantyEnd ? new Date(data.warrantyEnd) : undefined,
        warrantyMonths: data.warrantyMonths, serviceEngineerId: data.serviceEngineerId,
        serviceCost: data.serviceCost, notes: data.notes,
      },
    })
    res.json(record)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to update service record' }) }
})

// Service requests (complaints / maintenance)
router.get('/:id/requests', requirePermission('service_record', 'read_all'), async (req, res) => {
  try {
    const requests = await prisma.serviceRequest.findMany({
      where: { serviceRecordId: (req.params.id as string) },
      include: { engineers: { include: { user: { select: { id: true, name: true, role: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(requests)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch service requests' }) }
})

router.post('/:id/requests', requirePermission('service_record', 'create'), async (req: AuthRequest, res) => {
  try {
    const data = serviceRequestSchema.parse(req.body)
    const count = await prisma.serviceRequest.count()
    const refNumber = `SR-${String(count + 1).padStart(4, '0')}`
    // Crew = primary engineerId (if set) + any additional picks, de-duped.
    const crewIds = [...new Set([data.engineerId, ...(data.additionalEngineerIds ?? [])].filter((id): id is string => !!id))]
    const request = await prisma.serviceRequest.create({
      data: {
        refNumber, serviceRecordId: (req.params.id as string),
        type: data.type || 'complaint', title: data.title, description: data.description, priority: data.priority || 'Medium',
        engineerId: data.engineerId, engineerName: data.engineerName,
        engineers: crewIds.length ? { create: crewIds.map(userId => ({ userId, assignedById: req.user?.id })) } : undefined,
        spareParts: data.spareParts ? JSON.stringify(data.spareParts) : undefined,
        cost: data.cost || 0, createdById: req.user?.id,
      },
      include: { engineers: { include: { user: { select: { id: true, name: true, role: true } } } } },
    })
    await appendEvent('ServiceRecord', req.params.id as string, 'REQUEST_CREATED',
      `Service request "${request.title}" (${request.type}) created`, req.user?.id)
    res.status(201).json(request)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to create service request' }) }
})

// Add/remove crew on an existing request, independent of the primary engineerId.
router.post('/requests/:requestId/engineers', requirePermission('service_record', 'edit'), async (req: AuthRequest, res) => {
  const { userId } = req.body as { userId: string }
  if (!userId) { res.status(400).json({ error: 'userId required' }); return }
  const existing = await prisma.serviceRequestEngineer.findUnique({
    where: { serviceRequestId_userId: { serviceRequestId: req.params.requestId as string, userId } },
  })
  if (existing) { res.status(409).json({ error: 'Engineer already assigned to this request' }); return }
  const assignment = await prisma.serviceRequestEngineer.create({
    data: { serviceRequestId: req.params.requestId as string, userId, assignedById: req.user?.id },
    include: { user: { select: { id: true, name: true, role: true } } },
  })
  await appendEvent('ServiceRequest', req.params.requestId as string, 'ENGINEER_ADDED', `${assignment.user.name} added to crew`, req.user?.id)
  res.status(201).json(assignment)
})

router.delete('/requests/:requestId/engineers/:userId', requirePermission('service_record', 'edit'), async (req: AuthRequest, res) => {
  const existing = await prisma.serviceRequestEngineer.findUnique({
    where: { serviceRequestId_userId: { serviceRequestId: req.params.requestId as string, userId: req.params.userId as string } },
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  await prisma.serviceRequestEngineer.delete({ where: { id: existing.id } })
  res.status(204).end()
})

router.put('/requests/:requestId', requirePermission('service_record', 'edit'), async (req: AuthRequest, res) => {
  try {
    const data = serviceRequestUpdateSchema.parse(req.body)
    const updated = await prisma.$transaction(async tx => {
      const request = await tx.serviceRequest.update({
        where: { id: (req.params.requestId as string) },
        data: {
          status: data.status as any, engineerId: data.engineerId, engineerName: data.engineerName,
          spareParts: data.spareParts ? JSON.stringify(data.spareParts) : undefined,
          cost: data.cost, resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : (data.status === 'Resolved' ? new Date() : undefined),
        },
        include: { serviceRecord: true },
      })
      if (data.cost !== undefined && request.serviceRecord?.projectId) {
        const project = await tx.project.findUnique({ where: { id: request.serviceRecord.projectId } })
        if (project) {
          const newServiceCost = (project.serviceCost || 0) + data.cost
          const newTotalExpenses = (project.manufacturingCost || 0) + (project.purchaseCost || 0) + newServiceCost + (project.labourCost || 0) + (project.installationCost || 0)
          await tx.project.update({
            where: { id: request.serviceRecord.projectId },
            data: { serviceCost: newServiceCost, totalExpenses: newTotalExpenses, profit: (project.budget || 0) - newTotalExpenses },
          })
        }
      }
      return request
    })
    if (data.status) {
      await appendEvent('ServiceRecord', updated.serviceRecordId, 'REQUEST_STATUS_CHANGED',
        `Service request "${updated.title}" status changed to ${data.status}`, req.user?.id)
    }
    res.json(updated)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to update service request' }) }
})

/**
 * Delete a service request. ServiceRecords themselves are not deletable — they
 * are derived 1:1 from a completed project and carry the warranty window, so
 * removing one would lose warranty history. Requests are user-created and go.
 *
 * A resolved request whose cost was already rolled into the project's
 * serviceCost is refused: deleting it would leave the project's expense total
 * overstated with no way to trace the difference.
 */
router.delete('/requests/:requestId', requirePermission('service_record', 'delete'), async (req: AuthRequest, res) => {
  const id = req.params.requestId as string
  const existing = await prisma.serviceRequest.findUnique({ where: { id }, select: { id: true, cost: true, resolvedAt: true } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.resolvedAt && existing.cost > 0) {
    res.status(409).json({ error: 'Resolved request with recorded cost — cost is already booked to the project' })
    return
  }
  await prisma.$transaction([
    prisma.serviceRequestEngineer.deleteMany({ where: { serviceRequestId: id } }),
    prisma.serviceRequest.delete({ where: { id } }),
  ])
  res.status(204).end()
})

/** Bulk delete service requests. Same cost guard as the single-row route. */
router.post('/requests/bulk-delete', requirePermission('service_record', 'delete'), async (req: AuthRequest, res) => {
  const { ids } = req.body as { ids?: string[] }
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'ids array required' }); return }

  const rows = await prisma.serviceRequest.findMany({
    where: { id: { in: ids } },
    select: { id: true, refNumber: true, title: true, cost: true, resolvedAt: true },
  })
  const blocked = rows
    .filter(r => r.resolvedAt && r.cost > 0)
    .map(r => ({ id: r.id, title: r.refNumber ?? r.title, reason: 'Cost already booked to the project' }))
  const deletable = rows.filter(r => !(r.resolvedAt && r.cost > 0)).map(r => r.id)

  if (deletable.length) {
    await prisma.$transaction([
      prisma.serviceRequestEngineer.deleteMany({ where: { serviceRequestId: { in: deletable } } }),
      prisma.serviceRequest.deleteMany({ where: { id: { in: deletable } } }),
    ])
  }

  res.json({ deleted: deletable.length, skipped: ids.length - rows.length, blocked })
})

export default router
