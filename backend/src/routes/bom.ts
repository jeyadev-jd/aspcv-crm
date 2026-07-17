import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const bomItemSchema = z.object({
  itemName: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  estimatedCost: z.number().optional(),
  supplier: z.string().optional(),
  remarks: z.string().optional(),
})

const bomSchema = z.object({
  projectId: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(bomItemSchema).optional(),
})

router.get('/', requirePermission('bom', 'read_all'), async (req, res) => {
  try {
    const { projectId } = req.query
    const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
    const where = projectId ? { projectId: String(projectId) } : {}
    const [boms, total] = await Promise.all([
      prisma.bOM.findMany({
        where,
        include: {
          project: { select: { id: true, title: true } },
          items: true,
        },
        orderBy: { [pagination.sort as string]: pagination.order },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.bOM.count({ where }),
    ])
    res.json(paginate(boms, total, pagination))
  } catch (e) { res.status(500).json({ error: 'Failed to fetch BOMs' }) }
})

router.get('/:id', requirePermission('bom', 'read_all'), async (req, res) => {
  try {
    const bom = await prisma.bOM.findUnique({
      where: { id: (req.params.id as string) },
      include: { project: true, items: true, purchaseOrders: true },
    })
    if (!bom) return res.status(404).json({ error: 'Not found' })
    res.json(bom)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch BOM' }) }
})

router.post('/', requirePermission('bom', 'create'), async (req: AuthRequest, res) => {
  try {
    const data = bomSchema.parse(req.body)
    const count = await prisma.bOM.count()
    const refNumber = `BOM-${String(count + 1).padStart(4, '0')}`
    const bom = await prisma.bOM.create({
      data: {
        refNumber, projectId: data.projectId, notes: data.notes,
        createdById: req.user?.id,
        items: {
          create: (data.items || []).map(i => ({
            itemName: i.itemName, description: i.description,
            quantity: i.quantity || 1, unit: i.unit,
            estimatedCost: i.estimatedCost, supplier: i.supplier, remarks: i.remarks,
          })),
        },
      },
      include: { items: true },
    })
    res.status(201).json(bom)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to create BOM' }) }
})

router.put('/:id', requirePermission('bom', 'edit'), async (req, res) => {
  try {
    const data = bomSchema.partial().parse(req.body)
    const bom = await prisma.$transaction(async tx => {
      if (data.items) {
        await tx.bOMItem.deleteMany({ where: { bomId: (req.params.id as string) } })
        await tx.bOMItem.createMany({
          data: data.items.map(i => ({
            bomId: (req.params.id as string), itemName: i.itemName, description: i.description,
            quantity: i.quantity || 1, unit: i.unit,
            estimatedCost: i.estimatedCost, supplier: i.supplier, remarks: i.remarks,
          })),
        })
      }
      return tx.bOM.update({
        where: { id: (req.params.id as string) },
        data: { notes: data.notes },
        include: { items: true },
      })
    })
    res.json(bom)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to update BOM' }) }
})

// SE submits BOM for PM review
router.post('/:id/submit', requirePermission('bom', 'submit'), async (req, res) => {
  try {
    const existing = await prisma.bOM.findUnique({ where: { id: (req.params.id as string) } })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    if (existing.status !== 'Draft') return res.status(400).json({ error: `Cannot submit a BOM in ${existing.status} status` })
    const bom = await prisma.bOM.update({
      where: { id: (req.params.id as string) },
      data: { status: 'Submitted' },
    })
    res.json(bom)
  } catch (e) { res.status(500).json({ error: 'Failed to submit BOM' }) }
})

// PM approves BOM
router.post('/:id/approve', requirePermission('bom', 'approve'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.bOM.findUnique({ where: { id: (req.params.id as string) } })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    if (existing.status !== 'Submitted') return res.status(400).json({ error: `Cannot approve a BOM in ${existing.status} status — must be Submitted first` })
    const bom = await prisma.bOM.update({
      where: { id: (req.params.id as string) },
      data: { status: 'Approved', verifiedById: req.user?.id, verifiedAt: new Date() },
    })
    res.json(bom)
  } catch (e) { res.status(500).json({ error: 'Failed to approve BOM' }) }
})

// PM rejects BOM
router.post('/:id/reject', requirePermission('bom', 'approve'), async (req, res) => {
  try {
    const existing = await prisma.bOM.findUnique({ where: { id: (req.params.id as string) } })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    if (existing.status !== 'Submitted') return res.status(400).json({ error: `Cannot reject a BOM in ${existing.status} status — must be Submitted first` })
    const bom = await prisma.bOM.update({
      where: { id: (req.params.id as string) },
      data: { status: 'Rejected' },
    })
    res.json(bom)
  } catch (e) { res.status(500).json({ error: 'Failed to reject BOM' }) }
})

// Send BOM to Procurement
router.post('/:id/send-to-procurement', requirePermission('bom', 'approve'), async (req, res) => {
  try {
    const existing = await prisma.bOM.findUnique({ where: { id: (req.params.id as string) } })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    if (existing.status !== 'Approved') return res.status(400).json({ error: `Cannot send a BOM in ${existing.status} status to procurement — must be Approved first` })
    const [bom] = await prisma.$transaction([
      prisma.bOM.update({
        where: { id: (req.params.id as string) },
        data: { status: 'SentToProcurement' },
      }),
      prisma.project.update({
        where: { id: existing.projectId },
        data: { status: 'Procurement' },
      }),
    ])
    res.json(bom)
  } catch (e) { res.status(500).json({ error: 'Failed to send BOM to procurement' }) }
})

router.delete('/:id', requirePermission('bom', 'delete'), async (req, res) => {
  try {
    await prisma.bOM.delete({ where: { id: (req.params.id as string) } })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: 'Failed to delete BOM — it may have linked purchase orders' }) }
})

export default router
