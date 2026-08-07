import multer from 'multer'
import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { ENTITY_SPECS, buildWorkbook, buildTemplate, parseUpload, type ParsedRow } from '../services/dataTransfer'

const router = createSafeRouter()
router.use(authenticate)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

/** Import caps the batch so one upload can't tie up the DB indefinitely. */
const MAX_IMPORT_ROWS = 2000

// Each entity maps to the permission that already guards its own routes, so
// export/import can't become a side door around existing access control.
const ENTITY_PERMISSION: Record<string, { resource: string; readAction: string; writeAction: string }> = {
  companies: { resource: 'company', readAction: 'read_all', writeAction: 'create' },
  contacts: { resource: 'contact', readAction: 'read_all', writeAction: 'create' },
  leads: { resource: 'lead', readAction: 'read_all', writeAction: 'create' },
}

function specOr404(entity: string, res: { status: (n: number) => { json: (b: unknown) => unknown } }) {
  if (!ENTITY_SPECS[entity] || !ENTITY_PERMISSION[entity]) {
    res.status(404).json({ error: `Unknown entity: ${entity}` })
    return null
  }
  return ENTITY_SPECS[entity]
}

/** Guards a request using the permission mapped to the entity in the URL. */
function guard(kind: 'read' | 'write') {
  return async (req: AuthRequest, res: never, next: () => void) => {
    const entity = req.params.entity as string
    const perm = ENTITY_PERMISSION[entity]
    if (!perm) return (res as unknown as { status: (n: number) => { json: (b: unknown) => void } })
      .status(404).json({ error: `Unknown entity: ${entity}` })
    const action = kind === 'read' ? perm.readAction : perm.writeAction
    return requirePermission(perm.resource, action)(req, res as never, next)
  }
}

router.get('/:entity/template', guard('read') as never, async (req: AuthRequest, res) => {
  const entity = req.params.entity as string
  if (!specOr404(entity, res)) return
  const { buffer, filename } = await buildTemplate(entity)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(buffer)
})

router.get('/:entity/export', guard('read') as never, async (req: AuthRequest, res) => {
  const entity = req.params.entity as string
  if (!specOr404(entity, res)) return

  let rows: unknown[] = []
  if (entity === 'companies') {
    rows = await prisma.company.findMany({ orderBy: { name: 'asc' } })
  } else if (entity === 'contacts') {
    rows = await prisma.contact.findMany({ include: { company: true }, orderBy: { name: 'asc' } })
  } else if (entity === 'leads') {
    rows = await prisma.lead.findMany({
      include: { company: true, leadSourceRef: true, regionRef: true, department: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  const { buffer, filename } = await buildWorkbook(entity, rows)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(buffer)
})

/** Case-insensitive name lookup used to turn label columns into FK ids. */
async function lookupId(
  table: 'company' | 'leadSourceMaster' | 'region' | 'department',
  name: string | undefined
): Promise<string | null> {
  if (!name) return null
  const found = await (prisma[table] as unknown as {
    findFirst: (a: unknown) => Promise<{ id: string } | null>
  }).findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } })
  return found?.id ?? null
}

interface RowResult { row: number; status: 'created' | 'updated' | 'skipped'; error?: string }

router.post('/:entity/import', guard('write') as never, upload.single('file'), async (req: AuthRequest, res) => {
  const entity = req.params.entity as string
  const spec = specOr404(entity, res)
  if (!spec) return
  // Entities whose columns are all export-only have no supported import path.
  if (spec.fields.every((f) => f.exportOnly)) {
    return res.status(400).json({ error: `${spec.label} are export-only here — use the importer on the ${spec.label} page.` })
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  let parsed: ParsedRow[]
  try {
    parsed = await parseUpload(entity, { buffer: req.file.buffer, originalname: req.file.originalname })
  } catch {
    return res.status(400).json({ error: 'Could not read the file. Upload a .xlsx or .csv export/template.' })
  }

  if (parsed.length === 0) return res.status(400).json({ error: 'The file has no data rows.' })
  if (parsed.length > MAX_IMPORT_ROWS) {
    return res.status(400).json({ error: `Too many rows (${parsed.length}). Split the file into batches of ${MAX_IMPORT_ROWS}.` })
  }

  const results: RowResult[] = []

  for (const row of parsed) {
    if (row.errors.length > 0) {
      results.push({ row: row.rowNumber, status: 'skipped', error: row.errors.join('; ') })
      continue
    }

    try {
      if (entity === 'companies') {
        const name = row.values['name'] as string
        const existing = await prisma.company.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } })
        const data = { ...row.values } as Record<string, unknown>
        if (existing) {
          await prisma.company.update({ where: { id: existing.id }, data })
          results.push({ row: row.rowNumber, status: 'updated' })
        } else {
          await prisma.company.create({ data: data as never })
          results.push({ row: row.rowNumber, status: 'created' })
        }
        continue
      }

      const companyName = row.raw['Company']
      const companyId = await lookupId('company', companyName)
      if (!companyId) {
        results.push({ row: row.rowNumber, status: 'skipped', error: `Company "${companyName}" not found — create it first` })
        continue
      }

      if (entity === 'contacts') {
        const data: Record<string, unknown> = { companyId }
        for (const [k, v] of Object.entries(row.values)) {
          if (k.startsWith('company.')) continue
          data[k] = v
        }
        const email = data['email'] as string | undefined
        // Contact is unique on (companyId, email), so an email match is an update.
        const existing = email
          ? await prisma.contact.findFirst({ where: { companyId, email }, select: { id: true } })
          : null
        if (existing) {
          await prisma.contact.update({ where: { id: existing.id }, data })
          results.push({ row: row.rowNumber, status: 'updated' })
        } else {
          await prisma.contact.create({ data: data as never })
          results.push({ row: row.rowNumber, status: 'created' })
        }
        continue
      }

      if (entity === 'leads') {
        const data: Record<string, unknown> = { companyId, createdById: req.user!.id }
        for (const [k, v] of Object.entries(row.values)) {
          if (k.includes('.')) continue
          data[k] = v
        }
        const sourceId = await lookupId('leadSourceMaster', row.raw['Source'])
        if (sourceId) data['leadSourceId'] = sourceId
        const regionId = await lookupId('region', row.raw['Region'])
        if (regionId) data['regionId'] = regionId
        const deptId = await lookupId('department', row.raw['Department'])
        if (deptId) data['departmentId'] = deptId

        await prisma.lead.create({ data: data as never })
        results.push({ row: row.rowNumber, status: 'created' })
      }
    } catch (err) {
      results.push({
        row: row.rowNumber,
        status: 'skipped',
        error: err instanceof Error ? err.message : 'Failed to save row',
      })
    }
  }

  res.json({
    total: parsed.length,
    created: results.filter((r) => r.status === 'created').length,
    updated: results.filter((r) => r.status === 'updated').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    // Only failures are returned; a fully clean 2000-row import stays a small response.
    errors: results.filter((r) => r.status === 'skipped'),
  })
})

export default router
