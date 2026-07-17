import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { contactSchema, stripUnsentDefaults } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { requirePermission, resolvePermission, checkApprovalToken, consumeApprovalToken } from '../middleware/permissions'
import { getScopeFilter } from '../middleware/scoping'
import { parsePagination, paginate } from '../lib/pagination'
import { activeFilter, enforceActiveOr404, rejectIfInactive } from '../lib/softDelete'

const router = createSafeRouter()
router.use(authenticate)

router.get('/', requirePermission('contact', 'read_own'), async (req: AuthRequest, res) => {
  const { companyId, q, includeInactive } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'name')
  const nameFilter = q || pagination.search
  const scope = await getScopeFilter(req.user!.id, req.user!.roleName, 'contact')
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'contact', 'delete')
  const where = {
    ...scope,
    ...activeFilter(includeInactive === 'true' && canManage),
    ...(companyId && { companyId }),
    ...(nameFilter && { name: { contains: nameFilter, mode: 'insensitive' as const } }),
  }
  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: { company: { select: { id: true, name: true } } },
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.contact.count({ where }),
  ])
  res.json(paginate(contacts, total, pagination))
})

router.get('/:id', requirePermission('contact', 'read_own'), async (req: AuthRequest, res) => {
  const { includeInactive } = req.query as Record<string, string>
  const contact = await prisma.contact.findUnique({
    where: { id: req.params.id as string },
    include: { company: true }
  })
  const canReadAll = await resolvePermission(req.user!.id, req.user!.roleName, 'contact', 'read_all')
  if (!canReadAll && contact && contact.createdById !== req.user!.id) { res.status(403).json({ error: 'Insufficient permissions' }); return }
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'contact', 'delete')
  if (!enforceActiveOr404(contact, includeInactive === 'true' && canManage, res)) return
  res.json(contact)
})

router.post('/', requirePermission('contact', 'create'), async (req: AuthRequest, res) => {
  const data = contactSchema.parse(req.body)
  const contact = await prisma.contact.create({
    data: { ...data, createdById: req.user!.id },
    include: { company: { select: { id: true, name: true } } }
  })
  await appendEvent('Contact', contact.id, 'CREATED', `Contact "${contact.name}" created`, req.user?.id)
  res.status(201).json(contact)
})

router.patch('/:id', async (req: AuthRequest, res) => {
  const existing = await prisma.contact.findUnique({ where: { id: req.params.id as string } })
  if (!rejectIfInactive(existing, res)) return
  const { allowed, approvalId } = await checkApprovalToken(req.user!.id, req.user!.roleName, 'contact', req.params.id as string, 'edit')
  if (!allowed) {
    res.status(403).json({ error: 'approval_required', entityType: 'contact', entityId: req.params.id, action: 'edit' })
    return
  }
  const data = stripUnsentDefaults(contactSchema.partial().parse(req.body), req.body)
  const contact = await prisma.contact.update({
    where: { id: req.params.id as string },
    data,
    include: { company: { select: { id: true, name: true } } }
  })
  if (approvalId) await consumeApprovalToken(approvalId)
  await appendEvent('Contact', contact.id, 'UPDATED', `Contact updated`, req.user?.id)
  res.json(contact)
})

router.delete('/:id', async (req: AuthRequest, res) => {
  const existing = await prisma.contact.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.isActive === false) { res.status(204).end(); return } // idempotent
  const { allowed, approvalId } = await checkApprovalToken(req.user!.id, req.user!.roleName, 'contact', req.params.id as string, 'delete')
  if (!allowed) {
    res.status(403).json({ error: 'approval_required', entityType: 'contact', entityId: req.params.id, action: 'delete' })
    return
  }
  await prisma.contact.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  if (approvalId) await consumeApprovalToken(approvalId)
  res.status(204).end()
})

router.post('/:id/restore', requirePermission('contact', 'delete'), async (req: AuthRequest, res) => {
  const existing = await prisma.contact.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const contact = await prisma.contact.update({ where: { id: req.params.id as string }, data: { isActive: true }, include: { company: { select: { id: true, name: true } } } })
  await appendEvent('Contact', contact.id, 'RESTORED', `Contact "${contact.name}" restored`, req.user?.id)
  res.json(contact)
})

export default router
