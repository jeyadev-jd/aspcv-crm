import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { appendEvent } from '../services/timeline'
import { notifyRoles, createNotification } from '../services/notify'
import { nextInvoiceNumber } from '../lib/sequences'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const amcSchema = z.object({
  companyId: z.string().min(1),
  projectId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  value: z.number().default(0),
  visitFrequency: z.enum(['Monthly', 'Quarterly', 'HalfYearly', 'Yearly']).default('Quarterly'),
  maxVisits: z.number().int().default(4),
  notes: z.string().optional(),
})

const visitSchema = z.object({
  scheduledAt: z.string(),
  technicianId: z.string().optional(),
  notes: z.string().optional(),
})

const INCLUDE = {
  company: { select: { id: true, name: true } },
  project: { select: { id: true, title: true } },
  visits: { orderBy: { scheduledAt: 'asc' as const } },
  _count: { select: { visits: true } },
}

router.get('/', requirePermission('amc', 'read_all'), async (req, res) => {
  const { status, companyId } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'endDate')
  const where: any = {}
  if (status) where.status = status
  if (companyId) where.companyId = companyId
  const [agreements, total] = await Promise.all([
    prisma.aMCAgreement.findMany({
      where,
      include: INCLUDE,
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.aMCAgreement.count({ where }),
  ])
  res.json(paginate(agreements, total, pagination))
})

router.get('/expiring', requirePermission('amc', 'read_all'), async (req, res) => {
  const days = parseInt(req.query.days as string || '30')
  const cutoff = new Date(Date.now() + days * 86400_000)
  const agreements = await prisma.aMCAgreement.findMany({
    where: { status: 'Active', endDate: { lte: cutoff } },
    include: INCLUDE,
    orderBy: { endDate: 'asc' },
  })
  res.json(agreements)
})

router.get('/:id', requirePermission('amc', 'read_all'), async (req, res) => {
  const amc = await prisma.aMCAgreement.findUnique({
    where: { id: req.params.id as string },
    include: { ...INCLUDE, invoices: { select: { id: true, number: true, date: true, grandTotal: true, status: true } } },
  })
  if (!amc) { res.status(404).json({ error: 'Not found' }); return }
  res.json(amc)
})

router.post('/', requirePermission('amc', 'create'), async (req: AuthRequest, res) => {
  const data = amcSchema.parse(req.body)
  const rows = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('invoice_number_seq')`
  const refNumber = `AMC-${new Date().getFullYear()}-${rows[0].nextval.toString().padStart(4, '0')}`
  const amc = await prisma.aMCAgreement.create({
    data: {
      refNumber,
      companyId: data.companyId,
      projectId: data.projectId ?? null,
      title: data.title,
      description: data.description ?? null,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      value: data.value,
      visitFrequency: data.visitFrequency,
      maxVisits: data.maxVisits,
      notes: data.notes ?? null,
      createdById: req.user?.id,
    },
    include: INCLUDE,
  })
  await appendEvent('AMCAgreement', amc.id, 'CREATED', `AMC "${amc.title}" created for ${amc.company.name}`, req.user?.id)
  res.status(201).json(amc)
})

router.patch('/:id', requirePermission('amc', 'edit'), async (req: AuthRequest, res) => {
  const data = amcSchema.partial().parse(req.body)
  const amc = await prisma.aMCAgreement.update({
    where: { id: req.params.id as string },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
    include: INCLUDE,
  })
  res.json(amc)
})

// Renew AMC — creates a new agreement linked to this one
router.post('/:id/renew', requirePermission('amc', 'create'), async (req: AuthRequest, res) => {
  const existing = await prisma.aMCAgreement.findUnique({
    where: { id: req.params.id as string },
    include: { company: true },
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const data = amcSchema.parse(req.body)
  const rows = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('invoice_number_seq')`
  const refNumber = `AMC-${new Date().getFullYear()}-${rows[0].nextval.toString().padStart(4, '0')}`

  const [renewed] = await prisma.$transaction([
    prisma.aMCAgreement.create({
      data: {
        refNumber,
        companyId: existing.companyId,
        projectId: existing.projectId,
        title: data.title || existing.title,
        description: data.description ?? existing.description,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        value: data.value ?? existing.value,
        visitFrequency: data.visitFrequency ?? existing.visitFrequency,
        maxVisits: data.maxVisits ?? existing.maxVisits,
        notes: data.notes ?? null,
        renewedFromId: existing.id,
        createdById: req.user?.id,
      },
    }),
    prisma.aMCAgreement.update({
      where: { id: existing.id },
      data: { status: 'Renewed' },
    }),
  ])
  await appendEvent('AMCAgreement', existing.id, 'RENEWED', `AMC renewed as ${refNumber}`, req.user?.id)
  res.status(201).json(renewed)
})

// Generate invoice for AMC
router.post('/:id/invoice', requirePermission('amc', 'edit'), async (req: AuthRequest, res) => {
  const amc = await prisma.aMCAgreement.findUnique({
    where: { id: req.params.id as string },
    include: { company: true },
  })
  if (!amc) { res.status(404).json({ error: 'Not found' }); return }
  const invoiceNumber = await nextInvoiceNumber('AMC')
  const invoice = await prisma.invoice.create({
    data: {
      number: invoiceNumber,
      date: new Date(),
      customer: amc.company.name,
      status: 'Draft',
      amount: amc.value,
      grandTotal: amc.value,
      subTotal: amc.value,
      amcAgreementId: amc.id,
      companyId: amc.companyId,
      fromName: 'Aspiration Cleantech Ventures Pvt.Ltd.',
      toName: amc.company.name,
      items: {
        create: [{
          item: `Annual Maintenance Contract — ${amc.title}`,
          hours: 1,
          rate: amc.value,
          amount: amc.value,
        }],
      },
      activities: {
        create: [{ text: `Invoice auto-generated from AMC ${amc.refNumber}` }],
      },
    },
  })
  await appendEvent('AMCAgreement', amc.id, 'INVOICE_GENERATED', `Invoice ${invoiceNumber} generated`, req.user?.id)
  res.status(201).json(invoice)
})

// Visits
router.get('/:id/visits', requirePermission('amc', 'read_all'), async (req, res) => {
  const visits = await prisma.aMCVisit.findMany({
    where: { agreementId: req.params.id as string },
    orderBy: { scheduledAt: 'asc' },
  })
  res.json(visits)
})

router.post('/:id/visits', requirePermission('amc', 'edit'), async (req: AuthRequest, res) => {
  const data = visitSchema.parse(req.body)
  const amc = await prisma.aMCAgreement.findUnique({
    where: { id: req.params.id as string },
    include: { _count: { select: { visits: true } } },
  })
  if (!amc) { res.status(404).json({ error: 'Not found' }); return }
  if (amc._count.visits >= amc.maxVisits) {
    res.status(400).json({ error: `Maximum ${amc.maxVisits} visits already scheduled for this AMC` })
    return
  }
  const visit = await prisma.aMCVisit.create({
    data: {
      agreementId: req.params.id as string,
      scheduledAt: new Date(data.scheduledAt),
      technicianId: data.technicianId ?? null,
      notes: data.notes ?? null,
    },
  })
  res.status(201).json(visit)
})

router.patch('/visits/:visitId', requirePermission('amc', 'edit'), async (req: AuthRequest, res) => {
  const { status, completedAt, notes, reportUrl } = req.body
  const visit = await prisma.aMCVisit.update({
    where: { id: req.params.visitId as string },
    data: {
      status,
      completedAt: completedAt ? new Date(completedAt) : undefined,
      notes,
      reportUrl,
    },
  })
  res.json(visit)
})

router.delete('/:id', requirePermission('amc', 'edit'), async (req, res) => {
  const existing = await prisma.aMCAgreement.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.status === 'Active') {
    res.status(409).json({ error: 'Cannot delete an active AMC — cancel it first' })
    return
  }
  await prisma.aMCAgreement.update({ where: { id: req.params.id as string }, data: { status: 'Cancelled' } })
  res.status(204).end()
})

export default router
