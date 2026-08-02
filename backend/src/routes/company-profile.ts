import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = createSafeRouter()
router.use(authenticate)

// The letterhead on every invoice PDF is driven by this record, so any
// authenticated user needs to read it; only admins may change it.
router.get('/', async (_req: AuthRequest, res) => {
  const profiles = await prisma.companyProfile.findMany({ orderBy: { createdAt: 'asc' } })
  res.json(profiles)
})

router.get('/active', async (_req: AuthRequest, res) => {
  const profile = await prisma.companyProfile.findFirst({ where: { isActive: true } })
  res.json(profile)
})

const FIELDS = [
  'companyName', 'legalName', 'registeredAddr', 'branchAddr', 'gstin', 'pan', 'cin',
  'udyam', 'iec', 'state', 'stateCode', 'country', 'email', 'phone', 'website',
  'logoUrl', 'sealUrl', 'branchCode', 'invoicePrefix', 'declarationText', 'termsText',
] as const

const REQUIRED = ['companyName', 'legalName', 'registeredAddr', 'gstin', 'pan', 'state', 'stateCode', 'email', 'phone'] as const

function pick(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {}
  for (const f of FIELDS) if (body[f] !== undefined) data[f] = body[f]
  return data
}

router.post('/', requirePermission('role_admin', 'manage'), async (req: AuthRequest, res) => {
  const missing = REQUIRED.filter(f => !String((req.body as any)?.[f] ?? '').trim())
  if (missing.length) {
    res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` })
    return
  }

  const data = pick(req.body as Record<string, unknown>)
  // Only one profile may be active — a second active row would make the
  // "which letterhead?" lookup in invoices.ts non-deterministic.
  const makeActive = (req.body as any).isActive !== false
  if (makeActive) await prisma.companyProfile.updateMany({ data: { isActive: false } })

  const profile = await prisma.companyProfile.create({
    data: { ...(data as any), isActive: makeActive },
  })
  res.status(201).json(profile)
})

router.patch('/:id', requirePermission('role_admin', 'manage'), async (req: AuthRequest, res) => {
  const existing = await prisma.companyProfile.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Company profile not found' }); return }

  const data = pick(req.body as Record<string, unknown>)
  for (const f of REQUIRED) {
    if (data[f] !== undefined && !String(data[f]).trim()) {
      res.status(400).json({ error: `${f} cannot be empty` })
      return
    }
  }

  if ((req.body as any).isActive === true) {
    await prisma.companyProfile.updateMany({ data: { isActive: false } })
    data.isActive = true
  }

  const profile = await prisma.companyProfile.update({
    where: { id: req.params.id as string },
    data: data as any,
  })
  res.json(profile)
})

router.delete('/:id', requirePermission('role_admin', 'manage'), async (req: AuthRequest, res) => {
  const existing = await prisma.companyProfile.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Company profile not found' }); return }

  const invoiceCount = await prisma.invoice.count({ where: { companyProfileId: existing.id } })
  if (invoiceCount > 0) {
    res.status(409).json({ error: `Cannot delete — ${invoiceCount} invoice(s) reference this profile` })
    return
  }

  await prisma.companyProfile.delete({ where: { id: existing.id } })
  res.status(204).end()
})

export default router
