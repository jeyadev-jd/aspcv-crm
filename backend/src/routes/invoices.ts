import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { appendEvent } from '../services/timeline'
import { notifyRoles } from '../services/notify'
import { logAudit } from '../services/audit'
import { computeInvoice, type LineItemInput } from '../services/invoiceCalc'
import { determineTaxType, getFinancialYear, validateGstRate } from '../services/taxEngine'
import { generateInvoiceNumber } from '../services/invoiceNumbering'
import { startWorkflow, performAction, getMyPendingApprovals, getWorkflowHistory } from '../services/workflowEngine'
import { checkVersion, sendConflict } from '../lib/concurrency'

const router = createSafeRouter()
router.use(authenticate)

// ─── Validation helpers ──────────────────────────────────────────────────────
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/
const VALID_UNITS = new Set(['NOS', 'HRS', 'KGS', 'MTR', 'LTR', 'SQM', 'CBM', 'PCS', 'SET', 'BAG', 'BOX', 'OTH'])
const VALID_PAYMENT_TERMS = new Set(['IMM', 'NET7', 'NET15', 'NET30', 'NET45', 'NET60', 'ADV', 'MILE', 'CUSTOM'])

interface ValidationError { code: string; message: string; field?: string; severity: 'block' | 'warn' }

function validateInvoiceData(body: Record<string, unknown>, items: Record<string, unknown>[]): ValidationError[] {
  const errors: ValidationError[] = []

  if (!body.customer || !(body.customer as string).trim()) {
    errors.push({ code: 'E-001', message: 'Customer name is required.', field: 'customer', severity: 'block' })
  }
  if (!body.date) {
    errors.push({ code: 'E-008', message: 'Invoice date is required.', field: 'date', severity: 'block' })
  }
  if (!body.placeOfSupply) {
    errors.push({ code: 'E-009', message: 'Place of Supply is required to determine tax type.', field: 'placeOfSupply', severity: 'block' })
  }
  if (body.customerGstin && !GSTIN_RE.test(body.customerGstin as string)) {
    errors.push({ code: 'E-002', message: 'GSTIN format is invalid. Expected: 15 characters, e.g., 33AABCA1234F1Z5.', field: 'customerGstin', severity: 'block' })
  }
  if (!items || items.length === 0) {
    errors.push({ code: 'E-006', message: 'At least one line item is required.', field: 'items', severity: 'block' })
  }

  items?.forEach((item, i) => {
    if (!item.hsnCode) {
      errors.push({ code: 'E-005', message: 'HSN/SAC code is mandatory for all line items.', field: `items[${i}].hsnCode`, severity: 'block' })
    }
    if (item.gstRate !== undefined && !validateGstRate(Number(item.gstRate))) {
      errors.push({ code: 'E-004', message: `GST rate ${item.gstRate}% is not a valid rate. Allowed: 0, 0.25, 3, 5, 12, 18, 28.`, field: `items[${i}].gstRate`, severity: 'block' })
    }
  })

  return errors
}

function computeDueDate(invoiceDate: Date, termCode?: string): Date | null {
  if (!termCode) return null
  const days: Record<string, number> = { IMM: 0, NET7: 7, NET15: 15, NET30: 30, NET45: 45, NET60: 60, ADV: 0 }
  if (days[termCode] !== undefined) {
    const d = new Date(invoiceDate)
    d.setDate(d.getDate() + days[termCode])
    return d
  }
  return null
}

// ─── GET all invoices ────────────────────────────────────────────────────────
router.get('/', requirePermission('invoice', 'read_all'), async (req, res) => {
  const { projectId, companyId, status, invoiceType, financialYear } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
  const where = {
    ...(projectId ? { projectId } : {}),
    ...(companyId ? { companyId } : {}),
    ...(status ? { status: status as any } : {}),
    ...(invoiceType ? { invoiceType: invoiceType as any } : {}),
    ...(financialYear ? { financialYear } : {}),
    ...(pagination.search
      ? { OR: [
          { number: { contains: pagination.search, mode: 'insensitive' as const } },
          { customer: { contains: pagination.search, mode: 'insensitive' as const } },
        ] }
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

// ─── GET single invoice ──────────────────────────────────────────────────────
router.get('/:id', requirePermission('invoice', 'read_all'), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id as string },
    include: { items: true, activities: true, payments: true },
  })
  if (!invoice) return res.status(404).json({ error: 'Not found' })
  res.json(invoice)
})

// ─── CREATE invoice (Draft) ─────────────────────────────────────────────────
router.post('/', requirePermission('invoice', 'create'), async (req: AuthRequest, res) => {
  const {
    date, customer, invoiceType, amount,
    fromName, fromAddr, toName, toAddr, shippingAddr,
    customerGstin, customerState, customerStateCode, placeOfSupply, typeOfSupply,
    reverseCharge, poNo, poDate, gstRate, paymentTerms, paymentTermCode,
    signatoryId, bankAccountId, companyProfileId, companyId, projectId, dueDate,
    invoiceDiscount, originalInvoiceId, originalInvoiceNo, cnDnReason,
    items, number,
  } = req.body

  // Validation
  const errors = validateInvoiceData(req.body, items || [])
  if (errors.some(e => e.severity === 'block')) {
    return res.status(400).json({ success: false, errors: errors.filter(e => e.severity === 'block') })
  }

  // Get company profile for tax computation
  const companyProfile = companyProfileId
    ? await prisma.companyProfile.findUnique({ where: { id: companyProfileId } })
    : await prisma.companyProfile.findFirst({ where: { isActive: true } })

  const supplierStateCode = companyProfile?.stateCode || '33'
  const pos = placeOfSupply || customerStateCode || '33'

  // Compute line items if items provided with full data
  let computedData: ReturnType<typeof computeInvoice> | undefined
  if (items?.length && items[0].quantity !== undefined) {
    const lineInputs: LineItemInput[] = items.map((i: any) => ({
      itemCode: i.itemCode,
      item: i.item,
      hsnCode: i.hsnCode,
      quantity: Number(i.quantity) || 1,
      unit: i.unit || 'NOS',
      rate: Number(i.rate) || 0,
      discountPct: Number(i.discountPct) || 0,
      gstRate: Number(i.gstRate) ?? Number(gstRate) ?? 18,
      cessRate: Number(i.cessRate) || 0,
      hours: i.hours ? Number(i.hours) : undefined,
    }))
    computedData = computeInvoice(lineInputs, supplierStateCode, pos, reverseCharge || false, Number(invoiceDiscount) || 0)
  }

  const invoiceDate = new Date(date)
  const fy = getFinancialYear(invoiceDate)
  const computedDueDate = dueDate ? new Date(dueDate) : computeDueDate(invoiceDate, paymentTermCode)

  // Generate number for draft or use provided
  const invNumber = number || `DRAFT-${Date.now()}`

  const invoice = await prisma.invoice.create({
    data: {
      number: invNumber,
      date: invoiceDate,
      customer,
      status: 'Draft',
      invoiceType: invoiceType || 'TaxInvoice',
      amount: computedData ? computedData.subTotal : (items?.length
        ? items.reduce((s: number, i: { amount: number }) => s + Number(i.amount), 0)
        : Number(amount) || 0),
      projectId: projectId || undefined,
      companyId: companyId || undefined,
      dueDate: computedDueDate,
      fromName, fromAddr, toName, toAddr, shippingAddr,
      customerGstin, customerState, customerStateCode,
      placeOfSupply: pos,
      supplyType: supplierStateCode === pos ? 'IntraState' : 'InterState',
      typeOfSupply,
      reverseCharge: reverseCharge || false,
      poNo, poDate: poDate ? new Date(poDate) : undefined,
      gstRate: gstRate !== undefined ? Number(gstRate) : 18,
      paymentTerms, paymentTermCode,
      signatoryId: signatoryId || undefined,
      bankAccountId: bankAccountId || undefined,
      companyProfileId: companyProfile?.id || undefined,
      financialYear: fy,
      createdById: req.user?.id,
      originalInvoiceId, originalInvoiceNo, cnDnReason,
      // Computed totals
      subTotal: computedData?.subTotal || 0,
      totalDiscount: computedData?.totalDiscount || 0,
      invoiceDiscount: computedData?.invoiceDiscount || 0,
      totalCgst: computedData?.totalCgst || 0,
      totalSgst: computedData?.totalSgst || 0,
      totalIgst: computedData?.totalIgst || 0,
      totalCess: computedData?.totalCess || 0,
      totalTax: computedData?.totalTax || 0,
      roundOff: computedData?.roundOff || 0,
      grandTotal: computedData?.grandTotal || 0,
      items: {
        create: computedData
          ? computedData.items.map(i => ({
              lineNo: i.lineNo, itemCode: i.itemCode, item: i.item, hsnCode: i.hsnCode,
              quantity: i.quantity, unit: i.unit, rate: i.rate,
              discountPct: i.discountPct, discountAmt: i.discountAmt, taxableValue: i.taxableValue,
              gstRate: i.gstRate, cgstAmt: i.cgstAmt, sgstAmt: i.sgstAmt, igstAmt: i.igstAmt,
              cessRate: i.cessRate, cessAmt: i.cessAmt, lineTotal: i.lineTotal, amount: i.lineTotal,
              hours: i.hours,
            }))
          : (items || []).map((i: any, idx: number) => ({
              lineNo: idx + 1, item: i.item, hsnCode: i.hsnCode,
              rate: i.rate ? Number(i.rate) : 0, quantity: Number(i.quantity) || Number(i.hours) || 1,
              unit: i.unit || 'HRS', hours: i.hours ? Number(i.hours) : undefined,
              amount: Number(i.amount), lineTotal: Number(i.amount), taxableValue: Number(i.amount),
              gstRate: Number(i.gstRate) || Number(gstRate) || 18,
            })),
      },
      activities: { create: [{ text: `Invoice draft created` }] },
    },
    include: { items: true, activities: true },
  })

  await appendEvent('Invoice', invoice.id, 'CREATED', `Invoice draft created for ${invoice.customer}`, req.user?.id)
  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'Invoice',
    entityId: invoice.id, newValue: { number: invoice.number, customer: invoice.customer, grandTotal: invoice.grandTotal },
  })

  res.status(201).json(invoice)
})

// ─── UPDATE draft invoice ───────────────────────────────────────────────────
router.put('/:id', requirePermission('invoice', 'edit'), async (req: AuthRequest, res) => {
  const existing = await prisma.invoice.findUnique({ where: { id: req.params.id as string } })
  if (!existing) return res.status(404).json({ error: 'Not found' })

  // BR-01: Cannot edit after approval
  if (!['Draft', 'Unpaid', 'Scheduled', 'Processing'].includes(existing.status)) {
    return res.status(403).json({ error: 'Invoice cannot be edited after approval. Issue a Credit Note or Debit Note.' })
  }

  // Financial record — a silently-lost concurrent edit is the worst case here.
  const stale = checkVersion(existing, req.body.expectedUpdatedAt)
  if (stale) { sendConflict(res, stale.current, 'invoice'); return }

  const {
    status, amount, customer, date, toAddr, shippingAddr,
    customerGstin, customerState, customerStateCode, placeOfSupply, typeOfSupply,
    reverseCharge, poNo, poDate, gstRate, paymentTerms, paymentTermCode,
    signatoryId, bankAccountId, projectId, companyId, dueDate, invoiceDiscount, items,
  } = req.body

  // Get company profile for recalc
  const companyProfile = existing.companyProfileId
    ? await prisma.companyProfile.findUnique({ where: { id: existing.companyProfileId } })
    : await prisma.companyProfile.findFirst({ where: { isActive: true } })

  const supplierStateCode = companyProfile?.stateCode || '33'
  const pos = placeOfSupply || existing.placeOfSupply || '33'

  let computedData: ReturnType<typeof computeInvoice> | undefined
  if (items !== undefined && items.length > 0 && items[0].quantity !== undefined) {
    const lineInputs: LineItemInput[] = items.map((i: any) => ({
      itemCode: i.itemCode, item: i.item, hsnCode: i.hsnCode,
      quantity: Number(i.quantity) || 1, unit: i.unit || 'NOS', rate: Number(i.rate) || 0,
      discountPct: Number(i.discountPct) || 0,
      gstRate: Number(i.gstRate) ?? Number(gstRate) ?? 18,
      cessRate: Number(i.cessRate) || 0, hours: i.hours ? Number(i.hours) : undefined,
    }))
    computedData = computeInvoice(lineInputs, supplierStateCode, pos, reverseCharge ?? existing.reverseCharge, Number(invoiceDiscount) || 0)
  }

  const computedAmount = computedData
    ? computedData.subTotal
    : (items !== undefined ? items.reduce((s: number, i: { amount: number }) => s + Number(i.amount), 0) : undefined)

  const invoice = await prisma.$transaction(async tx => {
    if (items !== undefined) {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: req.params.id as string } })
    }
    return tx.invoice.update({
      where: { id: req.params.id as string },
      data: {
        status: status || undefined, customer, toAddr, shippingAddr,
        amount: computedAmount ?? (amount !== undefined ? Number(amount) : undefined),
        date: date ? new Date(date) : undefined,
        projectId: projectId !== undefined ? (projectId || null) : undefined,
        companyId: companyId !== undefined ? (companyId || null) : undefined,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
        customerGstin, customerState, customerStateCode,
        placeOfSupply: pos !== existing.placeOfSupply ? pos : undefined,
        supplyType: pos ? (supplierStateCode === pos ? 'IntraState' : 'InterState') : undefined,
        typeOfSupply, reverseCharge,
        poNo, poDate: poDate ? new Date(poDate) : undefined,
        gstRate: gstRate !== undefined ? Number(gstRate) : undefined,
        paymentTerms, paymentTermCode,
        signatoryId: signatoryId || undefined, bankAccountId: bankAccountId || undefined,
        // Computed totals
        ...(computedData ? {
          subTotal: computedData.subTotal, totalDiscount: computedData.totalDiscount,
          invoiceDiscount: computedData.invoiceDiscount, totalCgst: computedData.totalCgst,
          totalSgst: computedData.totalSgst, totalIgst: computedData.totalIgst,
          totalCess: computedData.totalCess, totalTax: computedData.totalTax,
          roundOff: computedData.roundOff, grandTotal: computedData.grandTotal,
        } : {}),
        items: computedData
          ? { create: computedData.items.map(i => ({
              lineNo: i.lineNo, itemCode: i.itemCode, item: i.item, hsnCode: i.hsnCode,
              quantity: i.quantity, unit: i.unit, rate: i.rate,
              discountPct: i.discountPct, discountAmt: i.discountAmt, taxableValue: i.taxableValue,
              gstRate: i.gstRate, cgstAmt: i.cgstAmt, sgstAmt: i.sgstAmt, igstAmt: i.igstAmt,
              cessRate: i.cessRate, cessAmt: i.cessAmt, lineTotal: i.lineTotal, amount: i.lineTotal,
              hours: i.hours,
            })) }
          : (items?.length ? { create: items.map((i: any, idx: number) => ({
              lineNo: idx + 1, item: i.item, hsnCode: i.hsnCode,
              rate: i.rate ? Number(i.rate) : 0, quantity: Number(i.quantity) || Number(i.hours) || 1,
              unit: i.unit || 'HRS', hours: i.hours ? Number(i.hours) : undefined,
              amount: Number(i.amount), lineTotal: Number(i.amount), taxableValue: Number(i.amount),
              gstRate: Number(i.gstRate) || Number(gstRate) || 18,
            })) } : undefined),
      },
      include: { items: true, activities: true, payments: true },
    })
  })

  await appendEvent('Invoice', invoice.id, 'UPDATED', `Invoice #${invoice.number} updated`, req.user?.id)
  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'update', module: 'Invoice',
    entityId: invoice.id, oldValue: { status: existing.status }, newValue: { status: invoice.status },
  })

  res.json(invoice)
})

// ─── Submit for approval ────────────────────────────────────────────────────
router.patch('/:id/submit', requirePermission('invoice', 'create'), async (req: AuthRequest, res) => {
  const existing = await prisma.invoice.findUnique({ where: { id: req.params.id as string }, include: { items: true } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (existing.status !== 'Draft') return res.status(400).json({ error: 'Only Draft invoices can be submitted for approval.' })

  // Validate completeness
  const errors = validateInvoiceData(existing as any, existing.items as any)
  if (errors.some(e => e.severity === 'block')) {
    return res.status(400).json({ success: false, errors: errors.filter(e => e.severity === 'block') })
  }

  const invoice = await prisma.invoice.update({
    where: { id: existing.id },
    data: { status: 'PendingApproval', activities: { create: [{ text: 'Submitted for approval' }] } },
    include: { items: true, activities: true, payments: true },
  })

  await appendEvent('Invoice', invoice.id, 'SUBMITTED', `Invoice submitted for approval`, req.user?.id)
  await notifyRoles(['SuperAdmin', 'Accountant'], {
    type: 'invoice', severity: 'info',
    title: `Invoice approval required`,
    message: `Invoice for ${invoice.customer} (₹${invoice.grandTotal.toLocaleString()}) needs approval.`,
    entityType: 'Invoice', entityId: invoice.id,
  })

  res.json(invoice)
})

// ─── Approve invoice ────────────────────────────────────────────────────────
router.patch('/:id/approve', requirePermission('invoice', 'approve'), async (req: AuthRequest, res) => {
  const existing = await prisma.invoice.findUnique({ where: { id: req.params.id as string } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (existing.status !== 'PendingApproval') return res.status(400).json({ error: 'Only PendingApproval invoices can be approved.' })

  // Generate invoice number at approval
  const companyProfile = existing.companyProfileId
    ? await prisma.companyProfile.findUnique({ where: { id: existing.companyProfileId } })
    : await prisma.companyProfile.findFirst({ where: { isActive: true } })

  const gstin = companyProfile?.gstin || '33AAPCAI794H1ZH'
  const invoiceNumber = await generateInvoiceNumber(
    gstin,
    existing.invoiceType,
    existing.date,
    companyProfile?.invoicePrefix ?? undefined,
    companyProfile?.branchCode ?? undefined,
  )

  const invoice = await prisma.invoice.update({
    where: { id: existing.id },
    data: {
      status: 'Generated',
      number: invoiceNumber,
      approvedBy: req.user?.id,
      approvedAt: new Date(),
      generatedAt: new Date(),
      activities: { create: [{ text: `Approved and generated as #${invoiceNumber}` }] },
    },
    include: { items: true, activities: true, payments: true },
  })

  await appendEvent('Invoice', invoice.id, 'APPROVED', `Invoice approved and numbered #${invoiceNumber}`, req.user?.id)
  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'approve', module: 'Invoice',
    entityId: invoice.id, newValue: { number: invoiceNumber },
  })
  await notifyRoles(['SuperAdmin', 'Accountant'], {
    type: 'invoice', severity: 'info',
    title: `Invoice #${invoiceNumber} generated`,
    message: `Invoice #${invoiceNumber} for ${invoice.customer} (₹${invoice.grandTotal.toLocaleString()}) is ready.`,
    entityType: 'Invoice', entityId: invoice.id,
  })

  res.json(invoice)
})

// ─── Reject invoice ─────────────────────────────────────────────────────────
router.patch('/:id/reject', requirePermission('invoice', 'approve'), async (req: AuthRequest, res) => {
  const { reason } = req.body
  if (!reason?.trim()) return res.status(400).json({ error: 'Rejection reason is mandatory.' })

  const existing = await prisma.invoice.findUnique({ where: { id: req.params.id as string } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (existing.status !== 'PendingApproval') return res.status(400).json({ error: 'Only PendingApproval invoices can be rejected.' })

  const invoice = await prisma.invoice.update({
    where: { id: existing.id },
    data: { status: 'Draft', activities: { create: [{ text: `Rejected: ${reason}` }] } },
    include: { items: true, activities: true, payments: true },
  })

  await appendEvent('Invoice', invoice.id, 'REJECTED', `Invoice rejected: ${reason}`, req.user?.id)
  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'reject', module: 'Invoice',
    entityId: invoice.id, reason,
  })

  res.json(invoice)
})

// ─── Send invoice ───────────────────────────────────────────────────────────
router.patch('/:id/send', requirePermission('invoice', 'edit'), async (req: AuthRequest, res) => {
  const existing = await prisma.invoice.findUnique({ where: { id: req.params.id as string } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (!['Generated', 'Sent', 'Unpaid'].includes(existing.status)) {
    return res.status(400).json({ error: 'Invoice must be Generated before sending.' })
  }

  const invoice = await prisma.invoice.update({
    where: { id: existing.id },
    data: {
      status: existing.status === 'Generated' ? 'Sent' : existing.status,
      sentAt: new Date(),
      activities: { create: [{ text: 'Invoice sent to customer' }] },
    },
    include: { items: true, activities: true, payments: true },
  })

  await appendEvent('Invoice', invoice.id, 'SENT', `Invoice #${invoice.number} sent`, req.user?.id)
  res.json(invoice)
})

// ─── Record payment ─────────────────────────────────────────────────────────
router.post('/:id/payments', requirePermission('invoice', 'edit'), async (req: AuthRequest, res) => {
  const { amount, method, notes } = req.body as { amount: number; method?: string; notes?: string }
  if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be > 0' })

  const invoice = await prisma.$transaction(async tx => {
    const existing = await tx.invoice.findUnique({ where: { id: req.params.id as string } })
    if (!existing) throw new Error('NOT_FOUND')

    // BR-07: Only certain statuses allow payments
    if (!['Sent', 'PartiallyPaid', 'Overdue', 'Unpaid', 'Generated'].includes(existing.status)) {
      throw new Error('INVALID_STATUS')
    }

    const balance = existing.grandTotal > 0 ? existing.grandTotal - existing.paidAmount : existing.amount - existing.paidAmount

    // BR-06: Payment cannot exceed grand total
    if (Number(amount) > balance + 0.01) {
      throw new Error('EXCEEDS_BALANCE')
    }

    await tx.payment.create({
      data: { invoiceId: existing.id, amount: Number(amount), method: method ?? null, recordedById: req.user!.id, notes: notes ?? null },
    })

    const newPaid = existing.paidAmount + Number(amount)
    const invoiceTotal = existing.grandTotal > 0 ? existing.grandTotal : existing.amount
    const newStatus = newPaid >= invoiceTotal ? 'Paid' : newPaid > 0 ? 'PartiallyPaid' : existing.status

    return tx.invoice.update({
      where: { id: existing.id },
      data: {
        paidAmount: newPaid,
        status: newStatus,
        paidAt: newStatus === 'Paid' ? new Date() : existing.paidAt,
        activities: { create: [{ text: `Payment of ₹${Number(amount).toLocaleString()} recorded` }] },
      },
      include: { items: true, activities: true, payments: true },
    })
  }).catch(e => {
    if (e.message === 'NOT_FOUND') return null
    if (e.message === 'INVALID_STATUS') return 'INVALID_STATUS'
    if (e.message === 'EXCEEDS_BALANCE') return 'EXCEEDS_BALANCE'
    throw e
  })

  if (invoice === null) return res.status(404).json({ error: 'Not found' })
  if (invoice === 'INVALID_STATUS') return res.status(400).json({ error: 'Payments can only be recorded against sent or partially paid invoices.' })
  if (invoice === 'EXCEEDS_BALANCE') return res.status(400).json({ error: `Payment of ₹${amount} exceeds outstanding balance.` })

  await appendEvent('Invoice', (invoice as any).id, 'PAYMENT_RECORDED', `Payment of ₹${Number(amount).toLocaleString()} recorded`, req.user?.id, { amount })
  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'update', module: 'Invoice',
    entityId: (invoice as any).id, newValue: { payment: amount, method },
  })

  if ((invoice as any).status === 'Paid') {
    await notifyRoles(['SuperAdmin', 'Accountant'], {
      type: 'invoice', severity: 'info',
      title: `Invoice #${(invoice as any).number} fully paid`,
      message: `Invoice #${(invoice as any).number} for ${(invoice as any).customer} is now fully paid.`,
      entityType: 'Invoice', entityId: (invoice as any).id,
    })
  }

  res.json(invoice)
})

// ─── Cancel invoice ─────────────────────────────────────────────────────────
router.patch('/:id/cancel', requirePermission('invoice', 'delete'), async (req: AuthRequest, res) => {
  const { reason } = req.body
  if (!reason?.trim()) return res.status(400).json({ error: 'Cancellation reason is mandatory.' })

  const existing = await prisma.invoice.findUnique({ where: { id: req.params.id as string } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (existing.status === 'Cancelled' || existing.status === 'Closed') {
    return res.status(400).json({ error: 'Invoice is already cancelled or closed.' })
  }

  const invoice = await prisma.invoice.update({
    where: { id: existing.id },
    data: {
      status: 'Cancelled',
      cancelledBy: req.user?.id,
      cancelledAt: new Date(),
      cancelReason: reason,
      activities: { create: [{ text: `Cancelled: ${reason}` }] },
    },
    include: { items: true, activities: true, payments: true },
  })

  await appendEvent('Invoice', invoice.id, 'CANCELLED', `Invoice #${invoice.number} cancelled: ${reason}`, req.user?.id)
  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'delete', module: 'Invoice',
    entityId: invoice.id, reason, oldValue: { status: existing.status },
  })

  res.json(invoice)
})

// ─── Close invoice ──────────────────────────────────────────────────────────
router.patch('/:id/close', requirePermission('invoice', 'approve'), async (req: AuthRequest, res) => {
  const existing = await prisma.invoice.findUnique({ where: { id: req.params.id as string } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (existing.status !== 'Paid') return res.status(400).json({ error: 'Only fully paid invoices can be closed.' })

  const invoice = await prisma.invoice.update({
    where: { id: existing.id },
    data: { status: 'Closed', closedAt: new Date(), activities: { create: [{ text: 'Invoice closed' }] } },
    include: { items: true, activities: true, payments: true },
  })

  await appendEvent('Invoice', invoice.id, 'CLOSED', `Invoice #${invoice.number} closed`, req.user?.id)
  res.json(invoice)
})

// ─── Recalculate totals (utility endpoint) ──────────────────────────────────
router.post('/calculate', authenticate, async (req, res) => {
  const { items, supplierStateCode, placeOfSupply, reverseCharge, invoiceDiscount } = req.body
  if (!items?.length) return res.status(400).json({ error: 'items required' })

  const lineInputs: LineItemInput[] = items.map((i: any) => ({
    item: i.item || '', hsnCode: i.hsnCode, quantity: Number(i.quantity) || 1,
    unit: i.unit || 'NOS', rate: Number(i.rate) || 0, discountPct: Number(i.discountPct) || 0,
    gstRate: Number(i.gstRate) || 18, cessRate: Number(i.cessRate) || 0,
  }))

  const result = computeInvoice(lineInputs, supplierStateCode || '33', placeOfSupply || '33', reverseCharge || false, Number(invoiceDiscount) || 0)
  res.json(result)
})

// ─── Delete draft invoice ───────────────────────────────────────────────────
router.delete('/:id', requirePermission('invoice', 'delete'), async (req: AuthRequest, res) => {
  const existing = await prisma.invoice.findUnique({ where: { id: req.params.id as string } })
  if (!existing) return res.status(404).json({ error: 'Not found' })

  // Only drafts can be hard-deleted; everything else must be cancelled
  if (!['Draft'].includes(existing.status)) {
    return res.status(403).json({ error: 'Only Draft invoices can be deleted. Use cancel for generated invoices.' })
  }

  await prisma.invoice.delete({ where: { id: req.params.id as string } })
  await appendEvent('Invoice', existing.id, 'DELETED', `Invoice draft deleted`, req.user?.id)
  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'delete', module: 'Invoice',
    entityId: existing.id, oldValue: { number: existing.number, customer: existing.customer },
  })
  res.status(204).send()
})

/**
 * Bulk delete. Mirrors the single-row rule exactly: only Draft invoices may be
 * removed, everything else must go through cancel so the numbering sequence and
 * audit trail stay intact. Non-drafts are reported in `blocked` rather than
 * failing the whole request.
 */
router.post('/bulk-delete', requirePermission('invoice', 'delete'), async (req: AuthRequest, res) => {
  const { ids } = req.body as { ids?: string[] }
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'ids array required' }); return }

  const targets = await prisma.invoice.findMany({
    where: { id: { in: ids } },
    select: { id: true, number: true, customer: true, status: true },
  })
  const drafts = targets.filter(t => t.status === 'Draft')
  const blocked = targets
    .filter(t => t.status !== 'Draft')
    .map(t => ({ id: t.id, title: t.number, reason: `${t.status} — use cancel instead` }))

  for (const inv of drafts) {
    await prisma.invoice.delete({ where: { id: inv.id } })
    await appendEvent('Invoice', inv.id, 'DELETED', 'Invoice draft deleted', req.user?.id)
    await logAudit({
      userId: req.user?.id, userName: req.user?.roleName, action: 'delete', module: 'Invoice',
      entityId: inv.id, oldValue: { number: inv.number, customer: inv.customer },
    })
  }

  res.json({ deleted: drafts.length, skipped: ids.length - targets.length, blocked })
})

// ─── Workflow Endpoints ─────────────────────────────────────────────────────

// Submit invoice for approval
router.post('/:id/submit', async (req: AuthRequest, res) => {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: req.params.id as string } })

  if (invoice.status !== 'Draft' && invoice.status !== 'Returned') {
    return res.status(400).json({ error: 'Only Draft or Returned invoices can be submitted' })
  }

  if (invoice.createdById !== req.user?.id) {
    return res.status(403).json({ error: 'Only document creator can submit' })
  }

  const instance = await startWorkflow(invoice.id)
  await appendEvent('Invoice', invoice.id, 'SUBMITTED', 'Invoice submitted for approval', req.user?.id)
  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'submit', module: 'Invoice',
    entityId: invoice.id, newValue: { workflowInstanceId: instance.id },
  })

  res.json({ message: 'Invoice submitted for approval', workflowInstanceId: instance.id, status: instance.status })
})

// Approve/Reject/Return/Delegate action
router.patch('/:id/workflow-action', async (req: AuthRequest, res) => {
  const { action, comments, delegateToId } = req.body
  if (!action || !['Approve', 'Reject', 'Return', 'Delegate', 'Reassign', 'Escalate'].includes(action)) {
    return res.status(400).json({ error: 'Valid action required: Approve, Reject, Return, Delegate' })
  }

  const instance = await prisma.workflowInstance.findUnique({
    where: { invoiceId: req.params.id as string },
  })
  if (!instance) return res.status(404).json({ error: 'No workflow instance for this invoice' })

  const result = await performAction(
    instance.id,
    req.user!.id,
    action,
    comments,
    delegateToId,
    req.ip,
  )

  await appendEvent('Invoice', req.params.id as string, action.toUpperCase(), comments || `Invoice ${action.toLowerCase()}d`, req.user?.id)
  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: action.toLowerCase(), module: 'Invoice',
    entityId: req.params.id as string, newValue: { result },
  })

  res.json(result)
})

// My pending approvals
router.get('/workflow/pending', async (req: AuthRequest, res) => {
  const pending = await getMyPendingApprovals(req.user!.id)
  res.json(pending)
})

// Workflow history for invoice
router.get('/:id/workflow-history', async (req: AuthRequest, res) => {
  const history = await getWorkflowHistory(req.params.id as string)
  res.json(history || { message: 'No workflow started for this invoice' })
})

// Document type configs list
router.get('/config/document-types', async (_req: AuthRequest, res) => {
  const configs = await prisma.documentTypeConfig.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' },
  })
  res.json(configs)
})

export default router
