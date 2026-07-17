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
          serviceRequests: { orderBy: { createdAt: 'desc' } },
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

router.get('/warranty-expiring', requirePermission('service_record', 'read_all'), async (req, res) => {
  try {
    const days = parseInt(String(req.query.days || '30'))
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + days)
    const records = await prisma.serviceRecord.findMany({
      where: { warrantyEnd: { lte: cutoff, gte: new Date() } },
      include: { project: { select: { id: true, title: true, company: { select: { name: true } } } } },
      orderBy: { warrantyEnd: 'asc' },
    })
    res.json(records)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch expiring warranties' }) }
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
    const request = await prisma.serviceRequest.create({
      data: {
        refNumber, serviceRecordId: (req.params.id as string),
        type: data.type || 'complaint', title: data.title, description: data.description, priority: data.priority || 'Medium',
        engineerId: data.engineerId, engineerName: data.engineerName,
        spareParts: data.spareParts ? JSON.stringify(data.spareParts) : undefined,
        cost: data.cost || 0, createdById: req.user?.id,
      },
    })
    await appendEvent('ServiceRecord', req.params.id as string, 'REQUEST_CREATED',
      `Service request "${request.title}" (${request.type}) created`, req.user?.id)
    res.status(201).json(request)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to create service request' }) }
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

export default router
