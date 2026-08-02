import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { logAudit } from '../services/audit'
import { parsePagination, paginate } from '../lib/pagination'
import { applyReimbursementRules, foodSpentOnDay, normalizeType, FOOD_DAILY_CAP } from '../services/reimbursementRules'

const router = createSafeRouter()
router.use(authenticate)

const VALID_ENTITY_TYPES = ['Lead', 'Deal', 'Project', 'Other']

// Proof attachments must be OneDrive/SharePoint links per business rule.
function isValidOneDriveUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host.endsWith('sharepoint.com') || host === '1drv.ms' || host.endsWith('onedrive.live.com')
  } catch {
    return false
  }
}

// Reimbursement types
router.get('/types', async (_req: AuthRequest, res) => {
  const types = await prisma.reimbursementType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  res.json(types)
})

// My reimbursements
router.get('/my', async (req: AuthRequest, res) => {
  const records = await prisma.reimbursement.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  res.json(records)
})

// All reimbursements (admin)
router.get('/all', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR', 'Manager', 'BusinessHead', 'Accountant'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Access denied' })
  }
  const { status, typeCode, entityType, entityId, userId, from, to } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>)
  const where: any = {}
  if (status) where.status = status
  if (typeCode) where.typeCode = typeCode
  if (entityType) where.entityType = entityType
  if (entityId) where.entityId = entityId
  if (userId) where.userId = userId
  if (from || to) {
    where.expenseDate = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to) }),
    }
  }

  const [records, total] = await Promise.all([
    prisma.reimbursement.findMany({
      where,
      include: { user: { select: { id: true, name: true, department: true } } },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.reimbursement.count({ where }),
  ])
  res.json(paginate(records, total, pagination))
})

// Claims attached to one Lead / Deal / Project — powers the Reimbursements tab
// inside those detail panels.
router.get('/entity/:entityType/:entityId', async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.params as Record<string, string>
  if (!VALID_ENTITY_TYPES.includes(entityType)) {
    return res.status(400).json({ error: `entityType must be one of ${VALID_ENTITY_TYPES.join(', ')}` })
  }
  const records = await prisma.reimbursement.findMany({
    where: { entityType, entityId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { expenseDate: 'desc' },
  })
  const totalClaimed = records
    .filter(r => r.status !== 'Rejected')
    .reduce((sum, r) => sum + r.amount, 0)
  res.json({ records, totalClaimed })
})

// Submit reimbursement
router.post('/', async (req: AuthRequest, res) => {
  const {
    typeCode, title, itemName, gst, description, amount, receiptUrl, receiptUrls,
    expenseDate, entityType, entityId, fuelVehicleType, distanceKm, isOutOfStation,
  } = req.body
  if (!typeCode || !title || !expenseDate) {
    return res.status(400).json({ error: 'typeCode, title, expenseDate required' })
  }

  const type = await prisma.reimbursementType.findUnique({ where: { code: typeCode } })
  if (!type) return res.status(400).json({ error: 'Invalid reimbursement type' })

  // Accept either the legacy single link or the new multi-link array.
  const links: string[] = Array.isArray(receiptUrls)
    ? receiptUrls.filter((u: unknown): u is string => typeof u === 'string' && u.trim().length > 0)
    : receiptUrl ? [receiptUrl] : []

  if (type.requiresReceipt && links.length === 0) {
    return res.status(400).json({ error: 'Receipt required for this type' })
  }
  const badLink = links.find(u => !isValidOneDriveUrl(u))
  if (badLink) {
    return res.status(400).json({ error: `Receipt must be a valid OneDrive or SharePoint link: ${badLink}` })
  }

  if (entityType && !VALID_ENTITY_TYPES.includes(entityType)) {
    return res.status(400).json({ error: `entityType must be one of ${VALID_ENTITY_TYPES.join(', ')}` })
  }
  if (entityType && entityType !== 'Other' && !entityId) {
    return res.status(400).json({ error: 'entityId is required when entityType is Lead, Deal or Project' })
  }

  const parsedDate = new Date(expenseDate)
  if (Number.isNaN(parsedDate.getTime())) return res.status(400).json({ error: 'Invalid expenseDate' })

  const rule = await applyReimbursementRules({
    typeCode,
    amount: parseFloat(amount ?? 0),
    expenseDate: parsedDate,
    fuelVehicleType,
    distanceKm: distanceKm != null ? parseFloat(distanceKm) : null,
    isOutOfStation: Boolean(isOutOfStation),
  })
  if (!rule.ok) return res.status(400).json({ error: rule.error })

  // The ₹500/day food cap is per day, not per claim — check the running total.
  if (normalizeType(typeCode) === 'food') {
    const already = await foodSpentOnDay(req.user!.id, parsedDate)
    if (already + rule.amount > FOOD_DAILY_CAP) {
      return res.status(400).json({
        error: `Food claims are capped at ₹${FOOD_DAILY_CAP} per day. Already claimed ₹${already} for this date.`,
      })
    }
  }

  if (type.maxLimit && rule.amount > type.maxLimit) {
    return res.status(400).json({ error: `Amount exceeds limit of ₹${type.maxLimit}` })
  }

  const record = await prisma.reimbursement.create({
    data: {
      userId: req.user!.id,
      typeCode,
      title,
      itemName: itemName || null,
      gst: gst !== undefined && gst !== null ? parseFloat(gst) : null,
      description: description || null,
      amount: rule.amount,
      receiptUrl: links[0] ?? null,
      receiptUrls: links,
      entityType: entityType || null,
      entityId: entityType && entityType !== 'Other' ? entityId : null,
      fuelVehicleType: fuelVehicleType || null,
      distanceKm: distanceKm != null ? parseFloat(distanceKm) : null,
      isOutOfStation: Boolean(isOutOfStation),
      expenseDate: parsedDate,
      status: rule.status,
      submittedAt: new Date(),
    },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'Reimbursement',
    entityId: record.id, newValue: { type: typeCode, amount, title },
  })

  res.status(201).json(record)
})

// Approve
router.patch('/:id/approve', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR', 'Manager', 'BusinessHead', 'Accountant'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Not authorized' })
  }
  const record = await prisma.reimbursement.findUniqueOrThrow({ where: { id: req.params.id as string } })
  if (record.userId === req.user!.id) return res.status(400).json({ error: 'Cannot approve own reimbursement' })

  // Medical claims are parked at PendingManagementApproval and only management clears them.
  if (record.status === 'PendingManagementApproval'
      && !['SuperAdmin', 'BusinessHead'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'This claim requires management approval' })
  }

  await prisma.reimbursement.update({
    where: { id: record.id },
    data: { status: 'Approved', approvedById: req.user!.id, approvedAt: new Date() },
  })
  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'approve', module: 'Reimbursement',
    entityId: record.id, newValue: { amount: record.amount },
  })
  res.json({ message: 'Reimbursement approved' })
})

// Reject
router.patch('/:id/reject', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR', 'Manager', 'BusinessHead'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Not authorized' })
  }
  const { reason } = req.body
  if (!reason) return res.status(400).json({ error: 'Rejection reason required' })

  await prisma.reimbursement.update({
    where: { id: req.params.id as string },
    data: { status: 'Rejected', rejectedReason: reason },
  })
  res.json({ message: 'Reimbursement rejected' })
})

// Mark paid
router.patch('/:id/paid', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'Accountant'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Only finance can mark paid' })
  }
  const { paymentRef } = req.body
  await prisma.reimbursement.update({
    where: { id: req.params.id as string },
    data: { status: 'Paid', paidAt: new Date(), paymentRef: paymentRef || null },
  })
  res.json({ message: 'Reimbursement marked as paid' })
})

export default router
