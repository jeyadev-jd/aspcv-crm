import { createSafeRouter } from './safeRouter'
import prisma from './prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

type SimpleMasterDelegate = {
  findMany: (args: any) => Promise<any[]>
  upsert: (args: any) => Promise<any>
  findUnique: (args: any) => Promise<any>
  update: (args: any) => Promise<any>
}

/**
 * Factory for the simple {id, name, code?, description?, displayOrder, isActive, createdAt}
 * master-data shape (Region/Country/CommercialModel/LeadSourceMaster/ReasonCode/CapacityUnit/
 * SolutionCategory/SolutionAccessory) — mirrors the existing Department route pattern exactly
 * but generic, so 8 near-identical route files don't get hand-duplicated.
 *
 * Gated on the given resource:action pair — reuses existing permission catalog entries
 * rather than inventing new ones per master table.
 */
export function createMasterDataRouter(delegate: SimpleMasterDelegate, resource: string) {
  const router = createSafeRouter()
  router.use(authenticate)

  router.get('/', async (_req, res) => {
    const rows = await delegate.findMany({ where: { isActive: true }, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] })
    res.json(rows)
  })

  router.post('/', requirePermission(resource, 'edit'), async (req, res) => {
    const { name, code, description, displayOrder } = req.body as { name: string; code?: string; description?: string; displayOrder?: number }
    if (!name?.trim()) { res.status(400).json({ error: 'Name required' }); return }
    const row = await delegate.upsert({
      where: { name: name.trim() },
      update: { isActive: true, code, description, ...(displayOrder !== undefined && { displayOrder }) },
      create: { name: name.trim(), code, description, displayOrder: displayOrder ?? 0 },
    })
    res.status(201).json(row)
  })

  router.patch('/:id', requirePermission(resource, 'edit'), async (req, res) => {
    const { name, code, description, displayOrder } = req.body
    const row = await delegate.update({
      where: { id: req.params.id as string },
      data: { name, code, description, displayOrder },
    })
    res.json(row)
  })

  router.delete('/:id', requirePermission(resource, 'edit'), async (req, res) => {
    const existing = await delegate.findUnique({ where: { id: req.params.id as string } })
    if (!existing) { res.status(404).json({ error: 'Not found' }); return }
    if (existing.isActive === false) { res.status(204).end(); return } // idempotent
    await delegate.update({ where: { id: req.params.id as string }, data: { isActive: false } })
    res.status(204).end()
  })

  router.post('/:id/restore', requirePermission(resource, 'edit'), async (req, res) => {
    const existing = await delegate.findUnique({ where: { id: req.params.id as string } })
    if (!existing) { res.status(404).json({ error: 'Not found' }); return }
    const row = await delegate.update({ where: { id: req.params.id as string }, data: { isActive: true } })
    res.json(row)
  })

  return router
}
