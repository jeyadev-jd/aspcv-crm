import { Router } from 'express'
import prisma from '../lib/prisma'

const router = Router()

router.get('/', async (req, res) => {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } })
  res.json(products)
})

router.get('/:id', async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } })
  if (!product) return res.status(404).json({ error: 'Not found' })
  res.json(product)
})

router.post('/', async (req, res) => {
  const { name, sku, price, quantity, category, rating, sales, image } = req.body
  const product = await prisma.product.create({
    data: { name, sku, price: Number(price), quantity: Number(quantity), category, rating: Number(rating || 0), sales: Number(sales || 0), image },
  })
  res.status(201).json(product)
})

router.put('/:id', async (req, res) => {
  const { name, sku, price, quantity, category, rating, sales, image } = req.body
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: { name, sku, price: Number(price), quantity: Number(quantity), category, rating: Number(rating), sales: Number(sales), image },
  })
  res.json(product)
})

router.delete('/:id', async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } })
  res.status(204).send()
})

export default router
