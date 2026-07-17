import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { appendEvent } from '../services/timeline'
import { notifyRoles } from '../services/notify'

const router = createSafeRouter()
router.use(authenticate)

router.get('/', requirePermission('invoice', 'read_all'), async (req, res) => {
  const { projectId, companyId } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
  const where = {
    ...(projectId ? { projectId } : {}),
    // Invoice has no direct companyId — join through Project, its only owning link.
    ...(companyId ? { project: { companyId } } : {}),
    ...(pagination.search
      ? { OR: [{ number: { contains: pagination.search, mode: 'insensitive' as const } }, { customer: { contains: pagination.search, mode: 'insensitive' as const } }] }
      : {}),
  }
  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { items: true, activities: true, payments: true },
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.invoice.count({ where }),
  ])
  res.json(paginate(invoices, total, pagination))
})

router.get('/:id', requirePermission('invoice', 'read_all'), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id as string },
    include: { items: true, activities: true },
  })
  if (!invoice) return res.status(404).json({ error: 'Not found' })
  res.json(invoice)
})

router.post('/', requirePermission('invoice', 'create'), async (req: AuthRequest, res) => {
  const {
    number, date, customer, status, amount,
    fromName, fromAddr, toName, toAddr,
    customerGstin, customerState, placeOfSupply, typeOfSupply,
    poNo, poDate, gstRate, paymentTerms, signatoryId, bankAccountId, projectId, dueDate, items,
  } = req.body
  const subTotal = items?.length
    ? items.reduce((s: number, i: { amount: number }) => s + Number(i.amount), 0)
    : Number(amount)
  const invoice = await prisma.invoice.create({
    data: {
      number, date: new Date(date), customer, status: status || 'Unpaid', amount: subTotal,
      projectId: projectId || undefined, dueDate: dueDate ? new Date(dueDate) : undefined,
      fromName, fromAddr, toName, toAddr,
      customerGstin, customerState, placeOfSupply, typeOfSupply,
      poNo, poDate: poDate ? new Date(poDate) : undefined,
      gstRate: gstRate !== undefined ? Number(gstRate) : 9,
      paymentTerms, signatoryId: signatoryId || undefined, bankAccountId: bankAccountId || undefined,
      items: items?.length ? { create: items.map((i: { item: string; hsnCode?: string; rate?: number; hours?: number; amount: number }) => ({
        item: i.item, hsnCode: i.hsnCode, rate: i.rate ? Number(i.rate) : undefined,
        hours: i.hours ? Number(i.hours) : undefined, amount: Number(i.amount),
      })) } : undefined,
      activities: { create: [{ text: `Created invoice #${number}` }] },
    },
    include: { items: true, activities: true },
  })
  await appendEvent('Invoice', invoice.id, 'CREATED', `Invoice #${invoice.number} created`, req.user?.id)
  await notifyRoles(['SuperAdmin', 'Accountant'], {
    type: 'invoice', severity: 'info',
    title: `New invoice #${invoice.number}`,
    message: `Invoice #${invoice.number} for ${invoice.customer} (₹${invoice.amount.toLocaleString()}) was created.`,
    entityType: 'Invoice', entityId: invoice.id,
  })
  res.status(201).json(invoice)
})

router.put('/:id', requirePermission('invoice', 'edit'), async (req: AuthRequest, res) => {
  const {
    status, amount, customer, date, toAddr,
    customerGstin, customerState, placeOfSupply, typeOfSupply,
    poNo, poDate, gstRate, paymentTerms, signatoryId, bankAccountId, projectId, dueDate, items,
  } = req.body
  // When items are supplied, recompute amount from their sum server-side so it can't go stale
  // relative to the newly-recreated items (client-sent `amount` is ignored in that case).
  const computedAmount = items !== undefined
    ? items.reduce((s: number, i: { amount: number }) => s + Number(i.amount), 0)
    : (amount !== undefined ? Number(amount) : undefined)

  const invoice = await prisma.$transaction(async tx => {
    if (items !== undefined) {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: req.params.id as string } })
    }
    const existing = status !== undefined
      ? await tx.invoice.findUnique({ where: { id: req.params.id as string }, select: { status: true } })
      : null
    return tx.invoice.update({
      where: { id: req.params.id as string },
      data: {
        status, customer, toAddr,
        paidAt: status === 'Paid' && existing?.status !== 'Paid' ? new Date() : undefined,
        amount: computedAmount,
        date: date ? new Date(date) : undefined,
        projectId: projectId !== undefined ? (projectId || null) : undefined,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
        customerGstin, customerState, placeOfSupply, typeOfSupply,
        poNo, poDate: poDate ? new Date(poDate) : undefined,
        gstRate: gstRate !== undefined ? Number(gstRate) : undefined,
        paymentTerms, signatoryId: signatoryId || undefined, bankAccountId: bankAccountId || undefined,
        items: items?.length ? { create: items.map((i: { item: string; hsnCode?: string; rate?: number; hours?: number; amount: number }) => ({
          item: i.item, hsnCode: i.hsnCode, rate: i.rate ? Number(i.rate) : undefined,
          hours: i.hours ? Number(i.hours) : undefined, amount: Number(i.amount),
        })) } : undefined,
      },
      include: { items: true, activities: true },
    })
  })
  await appendEvent('Invoice', invoice.id, 'UPDATED', `Invoice #${invoice.number} updated${invoice.status === 'Paid' ? ' — marked Paid' : ''}`, req.user?.id)
  res.json(invoice)
})

// Record a payment against an invoice — recomputes paidAmount + status (Paid / PartiallyPaid).
router.post('/:id/payments', requirePermission('invoice', 'edit'), async (req: AuthRequest, res) => {
  const { amount, method, notes } = req.body as { amount: number; method?: string; notes?: string }
  if (!amount || amount <= 0) { res.status(400).json({ error: 'amount must be > 0' }); return }

  const invoice = await prisma.$transaction(async tx => {
    const existing = await tx.invoice.findUnique({ where: { id: req.params.id as string } })
    if (!existing) throw new Error('NOT_FOUND')
    await tx.payment.create({
      data: { invoiceId: existing.id, amount: Number(amount), method: method ?? null, recordedById: req.user!.id, notes: notes ?? null },
    })
    const newPaid = existing.paidAmount + Number(amount)
    const newStatus = newPaid >= existing.amount ? 'Paid' : newPaid > 0 ? 'PartiallyPaid' : existing.status
    return tx.invoice.update({
      where: { id: existing.id },
      data: { paidAmount: newPaid, status: newStatus, paidAt: newStatus === 'Paid' ? new Date() : existing.paidAt },
      include: { items: true, activities: true, payments: true },
    })
  }).catch(e => { if (e.message === 'NOT_FOUND') return null; throw e })

  if (!invoice) { res.status(404).json({ error: 'Not found' }); return }
  await appendEvent('Invoice', invoice.id, 'PAYMENT_RECORDED', `Payment of ₹${Number(amount).toLocaleString()} recorded on invoice #${invoice.number}`, req.user?.id, { amount })
  if (invoice.status === 'Paid') {
    await notifyRoles(['SuperAdmin', 'Accountant'], {
      type: 'invoice', severity: 'info',
      title: `Invoice #${invoice.number} fully paid`,
      message: `Invoice #${invoice.number} for ${invoice.customer} is now fully paid.`,
      entityType: 'Invoice', entityId: invoice.id,
    })
  }
  res.json(invoice)
})

router.patch('/:id/send', requirePermission('invoice', 'edit'), async (req: AuthRequest, res) => {
  const invoice = await prisma.invoice.update({ where: { id: req.params.id as string }, data: { status: 'Sent' }, include: { items: true, activities: true, payments: true } })
  await appendEvent('Invoice', invoice.id, 'SENT', `Invoice #${invoice.number} sent`, req.user?.id)
  res.json(invoice)
})

router.patch('/:id/cancel', requirePermission('invoice', 'delete'), async (req: AuthRequest, res) => {
  const invoice = await prisma.invoice.update({ where: { id: req.params.id as string }, data: { status: 'Cancelled' }, include: { items: true, activities: true, payments: true } })
  await appendEvent('Invoice', invoice.id, 'CANCELLED', `Invoice #${invoice.number} cancelled`, req.user?.id)
  res.json(invoice)
})

router.delete('/:id', requirePermission('invoice', 'delete'), async (req: AuthRequest, res) => {
  const existing = await prisma.invoice.findUnique({ where: { id: req.params.id as string } })
  await prisma.invoice.delete({ where: { id: req.params.id as string } })
  if (existing) await appendEvent('Invoice', existing.id, 'DELETED', `Invoice #${existing.number} deleted`, req.user?.id)
  res.status(204).send()
})

export default router
