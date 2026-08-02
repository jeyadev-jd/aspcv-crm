import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { Prisma } from '@prisma/client'
import type { Response } from 'express'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const VALID_ENTITY_TYPES = ['Lead', 'Deal', 'Project']

// One user-defined specification field on a scope line. Labels are free-form so
// each product can carry whatever attributes it needs.
const customFieldSchema = z.object({
  label: z.string().min(1),
  value: z.string().nullish(),
})

const scopeItemSchema = z.object({
  entityType: z.enum(['Lead', 'Deal', 'Project']),
  entityId: z.string().min(1),
  name: z.string().min(1),
  specification: z.string().nullish(),
  capacityKw: z.number().nullish(),
  quantity: z.number().positive().default(1),
  unit: z.string().nullish(),
  customFields: z.array(customFieldSchema).default([]),
  notes: z.string().nullish(),
  sortOrder: z.number().int().optional(),
})

// Bulk save sends the whole list back; an `id` marks a row that already exists
// and must be updated in place so its inventory link survives the save.
const bulkRowSchema = scopeItemSchema
  .omit({ entityType: true, entityId: true })
  .extend({ id: z.string().optional() })

// GET /api/scope-items?entityType=Lead&entityId=xxx
router.get('/', async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.query as Record<string, string>
  if (!entityType || !entityId) {
    return res.status(400).json({ error: 'entityType and entityId required' })
  }
  if (!VALID_ENTITY_TYPES.includes(entityType)) {
    return res.status(400).json({ error: `entityType must be one of ${VALID_ENTITY_TYPES.join(', ')}` })
  }
  const items = await prisma.scopeItem.findMany({
    where: { entityType, entityId },
    include: {
      inventoryComponent: { select: { id: true, refNumber: true, name: true, category: true, status: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  res.json(items)
})

router.post('/', async (req: AuthRequest, res) => {
  const data = scopeItemSchema.parse(req.body)
  const item = await prisma.scopeItem.create({
    data: { ...data, createdById: req.user!.id },
  })
  res.status(201).json(item)
})

// Bulk replace — the inline editor sends the whole list on save rather than
// diffing row by row.
router.put('/bulk', async (req: AuthRequest, res) => {
  const { entityType, entityId, items } = req.body as {
    entityType?: string; entityId?: string; items?: unknown[]
  }
  if (!entityType || !entityId) {
    return res.status(400).json({ error: 'entityType and entityId required' })
  }
  if (!VALID_ENTITY_TYPES.includes(entityType)) {
    return res.status(400).json({ error: `entityType must be one of ${VALID_ENTITY_TYPES.join(', ')}` })
  }
  const rows = z.array(bulkRowSchema).parse(items ?? [])

  // Rows carrying an id are updated in place rather than dropped and recreated —
  // a delete-all would silently orphan any inventory allocated to those lines.
  const keepIds = rows.map(r => r.id).filter((id): id is string => !!id)

  await prisma.$transaction(async tx => {
    const doomed = await tx.scopeItem.findMany({
      where: { entityType, entityId, id: { notIn: keepIds } },
      select: { id: true, inventoryComponentId: true },
    })
    // Removing a line that still holds stock returns it to the warehouse first.
    for (const d of doomed) {
      if (d.inventoryComponentId) await unallocate(tx, d.id, req.user!.id)
    }
    await tx.scopeItem.deleteMany({ where: { id: { in: doomed.map(d => d.id) } } })

    for (const [idx, r] of rows.entries()) {
      const { id, ...fields } = r
      const data = { ...fields, sortOrder: r.sortOrder ?? idx }
      if (id && !doomed.some(d => d.id === id)) {
        await tx.scopeItem.update({ where: { id }, data })
      } else {
        await tx.scopeItem.create({
          data: { ...data, entityType, entityId, createdById: req.user!.id },
        })
      }
    }
  })

  const saved = await prisma.scopeItem.findMany({
    where: { entityType, entityId },
    include: {
      inventoryComponent: { select: { id: true, refNumber: true, name: true, category: true, status: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  res.json(saved)
})

router.put('/:id', async (req: AuthRequest, res) => {
  const data = scopeItemSchema.partial().omit({ entityType: true, entityId: true }).parse(req.body)
  const item = await prisma.scopeItem.update({
    where: { id: req.params.id as string },
    data,
  })
  res.json(item)
})

router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.scopeItem.delete({ where: { id: req.params.id as string } })
  res.status(204).end()
})

// ─── Inventory allocation ────────────────────────────────────────────────────
// Links a physical RawComponent to a scope line. Only Project scope lines can
// be fulfilled — a Lead or Deal has no stock movement behind it yet.

/**
 * Links `componentId` to the scope line, decrements warehouse stock, and books
 * the value onto the project — mirroring what POST /inventory-allocations does,
 * but keyed to the specific scope line rather than the project as a whole.
 * Throws tagged errors the caller maps to 400s.
 */
async function allocate(
  tx: Prisma.TransactionClient,
  scopeItemId: string,
  componentId: string,
  userId: string,
  notes?: string | null,
  qtyOverride?: number,
) {
  const item = await tx.scopeItem.findUnique({ where: { id: scopeItemId } })
  if (!item) throw new Error('SCOPE_ITEM_NOT_FOUND')
  if (item.entityType !== 'Project') throw new Error('NOT_A_PROJECT_LINE')
  if (item.inventoryComponentId) throw new Error('LINE_ALREADY_ALLOCATED')

  // One component fulfils at most one line — reject if it is already spoken for.
  const taken = await tx.scopeItem.findFirst({ where: { inventoryComponentId: componentId } })
  if (taken) throw new Error('COMPONENT_ALREADY_ALLOCATED')

  // Defaults to the scope line's own quantity, but the operator can allocate a
  // different amount — e.g. partial fulfilment from limited stock.
  const qty = qtyOverride ?? item.quantity ?? 1
  if (qty <= 0) throw new Error('INVALID_QUANTITY')
  // Atomic conditional decrement — no check-then-act race on stock.
  const dec = await tx.rawComponent.updateMany({
    where: { id: componentId, quantity: { gte: qty } },
    data: { quantity: { decrement: qty } },
  })
  if (dec.count === 0) throw new Error('INSUFFICIENT_STOCK')

  await tx.inventoryAllocation.create({
    data: { rawComponentId: componentId, projectId: item.entityId, quantity: qty, allocatedById: userId, notes },
  })

  const rc = await tx.rawComponent.findUnique({ where: { id: componentId }, select: { price: true } })
  const movedValue = (rc?.price || 0) * qty
  if (movedValue > 0) {
    await tx.project.update({
      where: { id: item.entityId },
      data: { inventoryCost: { increment: movedValue } },
    })
  }
  await tx.componentMovement.create({
    data: {
      componentId,
      type: 'assigned',
      toEntityType: 'project',
      toEntityId: item.entityId,
      performedById: userId,
      notes: notes || `Allocated to scope line "${item.name}"`,
    },
  })

  return tx.scopeItem.update({
    where: { id: scopeItemId },
    data: {
      inventoryComponentId: componentId,
      fulfillmentStatus: 'allocated',
      allocatedAt: new Date(),
      allocatedById: userId,
    },
    include: { inventoryComponent: true },
  })
}

/** Reverses `allocate` — returns stock, backs the value off the project. */
async function unallocate(tx: Prisma.TransactionClient, scopeItemId: string, userId: string) {
  const item = await tx.scopeItem.findUnique({ where: { id: scopeItemId } })
  if (!item) throw new Error('SCOPE_ITEM_NOT_FOUND')
  if (!item.inventoryComponentId) throw new Error('LINE_NOT_ALLOCATED')
  const componentId = item.inventoryComponentId

  // Reverse the live allocation row rather than deleting it — it is the audit trail.
  const alloc = await tx.inventoryAllocation.findFirst({
    where: { rawComponentId: componentId, projectId: item.entityId, reversedAt: null },
    orderBy: { allocatedAt: 'desc' },
  })
  const qty = alloc?.quantity ?? item.quantity ?? 1
  if (alloc) {
    await tx.inventoryAllocation.update({
      where: { id: alloc.id },
      data: { reversedAt: new Date(), reversedById: userId },
    })
  }

  const rc = await tx.rawComponent.update({
    where: { id: componentId },
    data: { quantity: { increment: qty }, status: 'in_stock' },
  })
  const returnedValue = (rc.price || 0) * qty
  if (returnedValue > 0) {
    await tx.project.update({
      where: { id: item.entityId },
      data: { inventoryCost: { decrement: returnedValue } },
    })
  }
  await tx.componentMovement.create({
    data: {
      componentId,
      type: 'returned',
      toEntityType: 'inventory',
      toEntityId: 'raw_materials',
      toEntityName: 'Raw Materials',
      performedById: userId,
      notes: `Unallocated from scope line "${item.name}"`,
    },
  })

  return tx.scopeItem.update({
    where: { id: scopeItemId },
    data: {
      inventoryComponentId: null,
      fulfillmentStatus: 'unallocated',
      allocatedAt: null,
      allocatedById: null,
    },
  })
}

const ALLOCATION_ERRORS: Record<string, string> = {
  SCOPE_ITEM_NOT_FOUND: 'Scope item not found',
  NOT_A_PROJECT_LINE: 'Only Project scope lines can be allocated inventory',
  LINE_ALREADY_ALLOCATED: 'This scope line already has a component allocated',
  COMPONENT_ALREADY_ALLOCATED: 'That component is already allocated to another scope line',
  LINE_NOT_ALLOCATED: 'This scope line has no component allocated',
  INSUFFICIENT_STOCK: 'Insufficient stock for the requested quantity',
  INVALID_QUANTITY: 'Quantity must be greater than zero',
}

// Maps a tagged allocation failure to a 400; anything else is a real bug and
// rethrows for the router's error handler.
function sendAllocationError(res: Response, e: unknown) {
  const msg = (e as Error)?.message
  if (msg && ALLOCATION_ERRORS[msg]) return res.status(400).json({ error: ALLOCATION_ERRORS[msg] })
  throw e
}

// POST /api/scope-items/:id/allocate — link a component to this line
router.post('/:id/allocate', async (req: AuthRequest, res) => {
  const { componentId, notes, quantity } = req.body as { componentId?: string; notes?: string; quantity?: number }
  if (!componentId) return res.status(400).json({ error: 'componentId required' })
  try {
    const updated = await prisma.$transaction(tx =>
      allocate(tx, req.params.id as string, componentId, req.user!.id, notes, quantity),
    )
    res.json(updated)
  } catch (e) { return sendAllocationError(res, e) }
})

// DELETE /api/scope-items/:id/allocate — return the component to stock
router.delete('/:id/allocate', async (req: AuthRequest, res) => {
  try {
    const updated = await prisma.$transaction(tx => unallocate(tx, req.params.id as string, req.user!.id))
    res.json(updated)
  } catch (e) { return sendAllocationError(res, e) }
})

// PATCH /api/scope-items/:id/allocate — swap to a different component atomically
router.patch('/:id/allocate', async (req: AuthRequest, res) => {
  const { componentId, notes, quantity } = req.body as { componentId?: string; notes?: string; quantity?: number }
  if (!componentId) return res.status(400).json({ error: 'componentId required' })
  try {
    const updated = await prisma.$transaction(async tx => {
      const id = req.params.id as string
      const current = await tx.scopeItem.findUnique({ where: { id } })
      if (current?.inventoryComponentId === componentId) throw new Error('LINE_ALREADY_ALLOCATED')
      if (current?.inventoryComponentId) await unallocate(tx, id, req.user!.id)
      return allocate(tx, id, componentId, req.user!.id, notes, quantity)
    })
    res.json(updated)
  } catch (e) { return sendAllocationError(res, e) }
})

export default router
