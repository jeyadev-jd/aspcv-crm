import { Router } from 'express'
import prisma from '../lib/prisma'

const router = Router()

router.get('/', async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    include: { items: true, activities: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json(invoices)
})

router.get('/:id', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { items: true, activities: true },
  })
  if (!invoice) return res.status(404).json({ error: 'Not found' })
  res.json(invoice)
})

router.post('/', async (req, res) => {
  const { number, date, customer, status, amount, fromName, fromAddr, toName, toAddr, items } = req.body
  const invoice = await prisma.invoice.create({
    data: {
      number, date: new Date(date), customer, status, amount: Number(amount),
      fromName, fromAddr, toName, toAddr,
      items: items ? { create: items } : undefined,
      activities: { create: [{ text: `Created invoice #${number}` }] },
    },
    include: { items: true, activities: true },
  })
  res.status(201).json(invoice)
})

router.put('/:id', async (req, res) => {
  const { status, amount } = req.body
  const invoice = await prisma.invoice.update({
    where: { id: req.params.id },
    data: { status, amount: amount !== undefined ? Number(amount) : undefined },
    include: { items: true, activities: true },
  })
  res.json(invoice)
})

router.delete('/:id', async (req, res) => {
  await prisma.invoice.delete({ where: { id: req.params.id } })
  res.status(204).send()
})

export default router
