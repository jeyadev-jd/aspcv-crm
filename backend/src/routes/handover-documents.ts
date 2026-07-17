import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = createSafeRouter()
router.use(authenticate)

router.get('/', requirePermission('handover_document', 'read_all'), async (req, res) => {
  try {
    const docs = await prisma.handoverDocument.findMany({
      include: { salesOrder: { include: { company: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(docs)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch handover documents' }) }
})

router.get('/:id', requirePermission('handover_document', 'read_all'), async (req, res) => {
  try {
    const doc = await prisma.handoverDocument.findUnique({
      where: { id: (req.params.id as string) },
      include: { salesOrder: { include: { company: true, quotation: { include: { items: true } } } } },
    })
    if (!doc) return res.status(404).json({ error: 'Not found' })
    res.json(doc)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch handover document' }) }
})

router.put('/:id', requirePermission('handover_document', 'edit'), async (req, res) => {
  try {
    const { projectName, customerDetails, budget, warrantyPeriod, productDetails, deliveryDate, scope, attachments, notes } = req.body
    const doc = await prisma.handoverDocument.update({
      where: { id: (req.params.id as string) },
      data: { projectName, customerDetails, budget, warrantyPeriod, productDetails, deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined, scope, attachments, notes },
    })
    res.json(doc)
  } catch (e) { res.status(500).json({ error: 'Failed to update handover document' }) }
})

// PM accepts handover → create Project, optionally assign SE
router.post('/:id/accept', requirePermission('handover_document', 'approve'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { assignedSEId } = req.body
    const doc = await prisma.handoverDocument.findUnique({
      where: { id: (req.params.id as string) },
      include: { salesOrder: { include: { company: true } } },
    })
    if (!doc) return res.status(404).json({ error: 'Not found' })
    if (doc.status !== 'pending') return res.status(400).json({ error: 'Already processed' })

    const [updatedDoc, project] = await prisma.$transaction([
      prisma.handoverDocument.update({
        where: { id: (req.params.id as string) },
        data: { status: 'accepted', acceptedById: userId, acceptedAt: new Date() },
      }),
      prisma.project.create({
        data: {
          title: doc.projectName,
          companyId: doc.salesOrder.companyId,
          salesOrderId: doc.salesOrderId,
          budget: doc.budget,
          remainingBudget: doc.budget,
          warrantyPeriod: doc.warrantyPeriod,
          status: 'Planning',
          assignedPMId: userId,
          assignedSEId: assignedSEId ?? null,
          createdById: userId,
        },
      }),
    ])

    res.json({ handoverDoc: updatedDoc, project })
  } catch (e) { res.status(500).json({ error: 'Failed to accept handover' }) }
})

router.post('/:id/reject', requirePermission('handover_document', 'approve'), async (req, res) => {
  try {
    const existing = await prisma.handoverDocument.findUnique({ where: { id: (req.params.id as string) } })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    if (existing.status !== 'pending') return res.status(400).json({ error: 'Already processed — cannot reject a document that is already accepted or rejected' })
    const doc = await prisma.handoverDocument.update({
      where: { id: (req.params.id as string) },
      data: { status: 'rejected' },
    })
    res.json(doc)
  } catch (e) { res.status(500).json({ error: 'Failed to reject handover' }) }
})

export default router
