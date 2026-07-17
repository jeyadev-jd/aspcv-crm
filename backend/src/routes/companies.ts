import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { companySchema, stripUnsentDefaults } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { requirePermission, resolvePermission, checkApprovalToken, consumeApprovalToken } from '../middleware/permissions'
import { getScopeFilter } from '../middleware/scoping'
import { parsePagination, paginate } from '../lib/pagination'
import { activeFilter, enforceActiveOr404, rejectIfInactive } from '../lib/softDelete'

const router = createSafeRouter()
router.use(authenticate)

const INCLUDE = { _count: { select: { contacts: true, leads: true } } }

router.get('/', requirePermission('company', 'read_all'), async (req: AuthRequest, res) => {
  const { q, customerType, includeInactive } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'name')
  const nameFilter = q || pagination.search
  const scope = await getScopeFilter(req.user!.id, req.user!.roleName, 'company')
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'company', 'delete')
  const where = {
    ...scope,
    ...activeFilter(includeInactive === 'true' && canManage),
    ...(nameFilter && { name: { contains: nameFilter, mode: 'insensitive' as const } }),
    ...(customerType && { customerType: customerType as any }),
  }
  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: INCLUDE,
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.company.count({ where }),
  ])
  res.json(paginate(companies, total, pagination))
})

router.get('/:id', requirePermission('company', 'read_all'), async (req: AuthRequest, res) => {
  const { includeInactive } = req.query as Record<string, string>
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'company', 'delete')
  const company = await prisma.company.findUnique({
    where: { id: req.params.id as string },
    include: { contacts: { where: { isActive: true } }, leads: { where: { isActive: true }, orderBy: { createdAt: 'desc' } } }
  })
  if (!enforceActiveOr404(company, includeInactive === 'true' && canManage, res)) return
  res.json(company)
})

router.post('/', requirePermission('company', 'create'), async (req: AuthRequest, res) => {
  const data = companySchema.parse(req.body)
  const company = await prisma.company.create({ data: data as any, include: INCLUDE })
  await appendEvent('Company', company.id, 'CREATED', `Company "${company.name}" created`, req.user?.id)
  res.status(201).json(company)
})

router.patch('/:id', requirePermission('company', 'edit'), async (req: AuthRequest, res) => {
  const existing = await prisma.company.findUnique({ where: { id: req.params.id as string } })
  if (!rejectIfInactive(existing, res)) return
  const { allowed, approvalId } = await checkApprovalToken(req.user!.id, req.user!.roleName, 'company', req.params.id as string, 'edit')
  if (!allowed) { res.status(403).json({ error: 'approval_required', entityType: 'company', entityId: req.params.id, action: 'edit' }); return }
  const data = stripUnsentDefaults(companySchema.partial().parse(req.body), req.body)
  const company = await prisma.company.update({ where: { id: req.params.id as string }, data: data as any, include: INCLUDE })
  if (approvalId) await consumeApprovalToken(approvalId)
  await appendEvent('Company', company.id, 'UPDATED', `Company updated`, req.user?.id)
  res.json(company)
})

router.delete('/:id', requirePermission('company', 'delete'), async (req: AuthRequest, res) => {
  const existing = await prisma.company.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.isActive === false) { res.status(204).end(); return } // idempotent — already archived
  const { allowed, approvalId } = await checkApprovalToken(req.user!.id, req.user!.roleName, 'company', req.params.id as string, 'delete')
  if (!allowed) { res.status(403).json({ error: 'approval_required', entityType: 'company', entityId: req.params.id, action: 'delete' }); return }
  await prisma.company.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  if (approvalId) await consumeApprovalToken(approvalId)
  res.status(204).end()
})

router.post('/:id/restore', requirePermission('company', 'delete'), async (req: AuthRequest, res) => {
  const existing = await prisma.company.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const company = await prisma.company.update({ where: { id: req.params.id as string }, data: { isActive: true }, include: INCLUDE })
  await appendEvent('Company', company.id, 'RESTORED', `Company "${company.name}" restored`, req.user?.id)
  res.json(company)
})

export default router
