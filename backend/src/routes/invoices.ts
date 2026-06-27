import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    include: { items: true, activities: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json(invoices)
})

router.get('/:id', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id as string },
    include: { items: true, activities: true },
  })
  if (!invoice) return res.status(404).json({ error: 'Not found' })
  res.json(invoice)
})

router.post('/', requirePermission('invoice', 'create'), async (req, res) => {
  const {
    number, date, customer, status, amount,
    fromName, fromAddr, toName, toAddr,
    customerGstin, customerState, placeOfSupply, typeOfSupply,
    poNo, poDate, gstRate, paymentTerms, signatoryId, items,
  } = req.body
  const subTotal = items?.length
    ? items.reduce((s: number, i: { amount: number }) => s + Number(i.amount), 0)
    : Number(amount)
  const invoice = await prisma.invoice.create({
    data: {
      number, date: new Date(date), customer, status: status || 'Unpaid', amount: subTotal,
      fromName, fromAddr, toName, toAddr,
      customerGstin, customerState, placeOfSupply, typeOfSupply,
      poNo, poDate: poDate ? new Date(poDate) : undefined,
      gstRate: gstRate !== undefined ? Number(gstRate) : 9,
      paymentTerms, signatoryId: signatoryId || undefined,
      items: items?.length ? { create: items.map((i: { item: string; hsnCode?: string; rate?: number; hours?: number; amount: number }) => ({
        item: i.item, hsnCode: i.hsnCode, rate: i.rate ? Number(i.rate) : undefined,
        hours: i.hours ? Number(i.hours) : undefined, amount: Number(i.amount),
      })) } : undefined,
      activities: { create: [{ text: `Created invoice #${number}` }] },
    },
    include: { items: true, activities: true },
  })
  res.status(201).json(invoice)
})

router.put('/:id', requirePermission('invoice', 'edit'), async (req, res) => {
  const {
    status, amount, customer, date, toAddr,
    customerGstin, customerState, placeOfSupply, typeOfSupply,
    poNo, poDate, gstRate, paymentTerms, signatoryId, items,
  } = req.body
  if (items !== undefined) {
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: req.params.id as string } })
  }
  const invoice = await prisma.invoice.update({
    where: { id: req.params.id as string },
    data: {
      status, customer, toAddr,
      amount: amount !== undefined ? Number(amount) : undefined,
      date: date ? new Date(date) : undefined,
      customerGstin, customerState, placeOfSupply, typeOfSupply,
      poNo, poDate: poDate ? new Date(poDate) : undefined,
      gstRate: gstRate !== undefined ? Number(gstRate) : undefined,
      paymentTerms, signatoryId: signatoryId || undefined,
      items: items?.length ? { create: items.map((i: { item: string; hsnCode?: string; rate?: number; hours?: number; amount: number }) => ({
        item: i.item, hsnCode: i.hsnCode, rate: i.rate ? Number(i.rate) : undefined,
        hours: i.hours ? Number(i.hours) : undefined, amount: Number(i.amount),
      })) } : undefined,
    },
    include: { items: true, activities: true },
  })
  res.json(invoice)
})

router.delete('/:id', requirePermission('invoice', 'delete'), async (req, res) => {
  await prisma.invoice.delete({ where: { id: req.params.id as string } })
  res.status(204).send()
})

export default router
