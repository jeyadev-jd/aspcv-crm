import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { contactSchema } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { requirePermission, checkApprovalToken, consumeApprovalToken } from '../middleware/permissions'
import { getScopeFilter } from '../middleware/scoping'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('contact', 'read_own'), async (req: AuthRequest, res) => {
  const { companyId, q } = req.query as Record<string, string>
  const scope = await getScopeFilter(req.user!.id, req.user!.roleName, 'contact')
  const contacts = await prisma.contact.findMany({
    where: {
      ...scope,
      isActive: true,
      ...(companyId && { companyId }),
      ...(q && { name: { contains: q, mode: 'insensitive' } }),
    },
    include: { company: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  })
  res.json(contacts)
})

router.get('/:id', async (req, res) => {
  const contact = await prisma.contact.findUnique({
    where: { id: req.params.id as string },
    include: { company: true }
  })
  if (!contact) { res.status(404).json({ error: 'Not found' }); return }
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
  const { allowed, approvalId } = await checkApprovalToken(req.user!.id, req.user!.roleName, 'contact', req.params.id as string, 'edit')
  if (!allowed) {
    res.status(403).json({ error: 'approval_required', entityType: 'contact', entityId: req.params.id, action: 'edit' })
    return
  }
  const data = contactSchema.partial().parse(req.body)
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
  const { allowed, approvalId } = await checkApprovalToken(req.user!.id, req.user!.roleName, 'contact', req.params.id as string, 'delete')
  if (!allowed) {
    res.status(403).json({ error: 'approval_required', entityType: 'contact', entityId: req.params.id, action: 'delete' })
    return
  }
  await prisma.contact.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  if (approvalId) await consumeApprovalToken(approvalId)
  res.status(204).end()
})

export default router
