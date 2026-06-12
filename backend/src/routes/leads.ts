import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { leadSchema } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { requirePermission, checkApprovalToken, consumeApprovalToken } from '../middleware/permissions'
import { getScopeFilter } from '../middleware/scoping'
import { z } from 'zod'

const router = Router()
router.use(authenticate)

const INCLUDE_FULL = {
  company: { select: { id: true, name: true, customerType: true, region: true, state: true, city: true, area: true, nickname: true, stateCode: true, areaCode: true, cityCode: true } },
  contacts: { orderBy: { isPrimary: 'desc' as const } },
  owners: { include: { user: { select: { id: true, name: true, role: true } } } },
  sources: true,
}

const STATE_CODES: Record<string, string> = {
  'Andhra Pradesh': 'AP', 'Arunachal Pradesh': 'AR', 'Assam': 'AS', 'Bihar': 'BR',
  'Chhattisgarh': 'CG', 'Goa': 'GA', 'Gujarat': 'GJ', 'Haryana': 'HR',
  'Himachal Pradesh': 'HP', 'Jharkhand': 'JH', 'Karnataka': 'KA', 'Kerala': 'KL',
  'Madhya Pradesh': 'MP', 'Maharashtra': 'MH', 'Manipur': 'MN', 'Meghalaya': 'ML',
  'Mizoram': 'MZ', 'Nagaland': 'NL', 'Odisha': 'OD', 'Punjab': 'PB', 'Rajasthan': 'RJ',
  'Sikkim': 'SK', 'Tamil Nadu': 'TN', 'Telangana': 'TS', 'Tripura': 'TR',
  'Uttar Pradesh': 'UP', 'Uttarakhand': 'UK', 'West Bengal': 'WB', 'Delhi': 'DL',
  'Chandigarh': 'CH', 'Puducherry': 'PY', 'Jammu & Kashmir': 'JK', 'Ladakh': 'LA',
}

function buildRefNumber(company: any, serialNo: number): string {
  const nick = (company.nickname || company.name?.slice(0, 4) || 'XX').toUpperCase().replace(/\s+/g, '')
  const sc = company.stateCode || STATE_CODES[company.state || ''] || 'XX'
  const ac = (company.areaCode || company.area?.slice(0, 2) || 'XX').toUpperCase()
  const cc = (company.cityCode || company.city?.slice(0, 2) || 'XX').toUpperCase()
  return `ASPCV ${nick}-${sc}-${ac} ${cc}-${serialNo}`
}

router.get('/', requirePermission('lead', 'read_own'), async (req: AuthRequest, res) => {
  const { status, region, source, companyId, ownerId, stage } = req.query as Record<string, string>
  const scope = await getScopeFilter(req.user!.id, req.user!.roleName, 'lead')
  const leads = await prisma.lead.findMany({
    where: {
      ...scope,
      isActive: true,
      ...(status && { status: status as any }),
      ...(region && { region }),
      ...(source && { source }),
      ...(companyId && { companyId }),
      ...(stage && { stage: stage as any }),
      ...(ownerId && { owners: { some: { userId: ownerId } } }),
    },
    include: INCLUDE_FULL,
    orderBy: { createdAt: 'desc' },
  })
  res.json(leads)
})

router.get('/:id', async (req, res) => {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id as string },
    include: {
      company: true,
      contacts: { orderBy: { isPrimary: 'desc' } },
      owners: { include: { user: { select: { id: true, name: true, role: true } } } },
      sources: true,
      deals: { where: { isActive: true }, select: { id: true, title: true, stage: true } },
    },
  })
  if (!lead) { res.status(404).json({ error: 'Not found' }); return }
  res.json(lead)
})

async function upsertContacts(leadId: string, contacts: any[], companyId?: string) {
  for (const c of contacts) {
    if (c.id) {
      await prisma.leadContact.update({ where: { id: c.id }, data: { name: c.name, designation: c.designation, email: c.email, phone: c.phone, whatsapp: c.whatsapp, isPrimary: c.isPrimary ?? false } })
    } else {
      await prisma.leadContact.create({ data: { leadId, name: c.name, designation: c.designation, email: c.email, phone: c.phone, whatsapp: c.whatsapp, isPrimary: c.isPrimary ?? false } })
    }
    // Sync to global Contact table
    if (companyId && c.name?.trim()) {
      const where = c.email
        ? { companyId_email: { companyId, email: c.email } }
        : undefined
      const data = { name: c.name, designation: c.designation ?? undefined, phone: c.phone ?? undefined, whatsapp: c.whatsapp ?? undefined }
      if (where) {
        await prisma.contact.upsert({
          where,
          update: data,
          create: { companyId, email: c.email, ...data },
        })
      } else {
        // no email — upsert by name
        const existing = await prisma.contact.findFirst({ where: { companyId, name: c.name } })
        if (existing) {
          await prisma.contact.update({ where: { id: existing.id }, data })
        } else {
          await prisma.contact.create({ data: { companyId, ...data } })
        }
      }
    }
  }
}

async function upsertSources(leadId: string, sources: { source: string; sourceName?: string }[]) {
  await prisma.leadSource.deleteMany({ where: { leadId } })
  if (sources.length) {
    await prisma.leadSource.createMany({ data: sources.map(s => ({ leadId, source: s.source, sourceName: s.sourceName })) })
  }
}

router.post('/', requirePermission('lead', 'create'), async (req: AuthRequest, res) => {
  const { contacts, sources, ...rest } = leadSchema.parse(req.body)

  const { _max } = await prisma.lead.aggregate({ _max: { serialNo: true } })
  const serialNo = (_max.serialNo ?? 0) + 1

  const company = await prisma.company.findUnique({ where: { id: rest.companyId } })

  const lead = await prisma.lead.create({
    data: {
      ...rest,
      serialNo,
      createdById: req.user!.id,
      closeDate: rest.closeDate ? new Date(rest.closeDate) : undefined,
      leadDate: rest.leadDate ? new Date(rest.leadDate) : new Date(),
      owners: req.user ? { create: { userId: req.user.id, role: 'primary' } } : undefined,
    },
    include: INCLUDE_FULL,
  })

  const refNumber = buildRefNumber(company || {}, serialNo)
  await prisma.lead.update({ where: { id: lead.id }, data: { refNumber } })

  if (contacts?.length) await upsertContacts(lead.id, contacts, rest.companyId)
  if (sources?.length) await upsertSources(lead.id, sources)

  await appendEvent('Lead', lead.id, 'CREATED', `Lead "${lead.title}" created`, req.user?.id)
  const full = await prisma.lead.findUnique({ where: { id: lead.id }, include: INCLUDE_FULL })
  res.status(201).json(full)
})

router.patch('/:id', async (req: AuthRequest, res) => {
  const { allowed, approvalId } = await checkApprovalToken(req.user!.id, req.user!.roleName, 'lead', req.params.id as string, 'edit')
  if (!allowed) {
    res.status(403).json({ error: 'approval_required', entityType: 'lead', entityId: req.params.id, action: 'edit' })
    return
  }
  const { contacts, sources, ...rest } = leadSchema.partial().parse(req.body)
  const lead = await prisma.lead.update({
    where: { id: req.params.id as string },
    data: {
      ...rest,
      closeDate: rest.closeDate ? new Date(rest.closeDate) : undefined,
      leadDate: rest.leadDate ? new Date(rest.leadDate) : undefined,
    },
    include: INCLUDE_FULL,
  })
  if (contacts?.length) await upsertContacts(lead.id, contacts, lead.companyId)
  if (sources !== undefined) await upsertSources(lead.id, sources ?? [])

  // Re-generate refNumber (assign serialNo first if missing)
  let serialNo = lead.serialNo
  if (!serialNo) {
    const { _max } = await prisma.lead.aggregate({ _max: { serialNo: true } })
    serialNo = (_max.serialNo ?? 0) + 1
  }
  const company = await prisma.company.findUnique({ where: { id: lead.companyId } })
  if (company) {
    const refNumber = buildRefNumber(company, serialNo)
    await prisma.lead.update({ where: { id: lead.id }, data: { refNumber, serialNo } })
  }

  if (approvalId) await consumeApprovalToken(approvalId)
  await appendEvent('Lead', lead.id, 'UPDATED', `Lead updated`, req.user?.id)
  const full = await prisma.lead.findUnique({ where: { id: lead.id }, include: INCLUDE_FULL })
  res.json(full)
})

router.delete('/:id', async (req: AuthRequest, res) => {
  const { allowed, approvalId } = await checkApprovalToken(req.user!.id, req.user!.roleName, 'lead', req.params.id as string, 'delete')
  if (!allowed) {
    res.status(403).json({ error: 'approval_required', entityType: 'lead', entityId: req.params.id, action: 'delete' })
    return
  }
  await prisma.lead.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  if (approvalId) await consumeApprovalToken(approvalId)
  res.status(204).end()
})

// Lead contacts CRUD
router.delete('/:id/contacts/:contactId', async (req: AuthRequest, res) => {
  await prisma.leadContact.delete({ where: { id: req.params.contactId as string } })
  res.status(204).end()
})

// Owner management
const ownerSchema = z.object({ userId: z.string(), role: z.string().default('secondary') })

router.post('/:id/owners', async (req: AuthRequest, res) => {
  const { userId, role } = ownerSchema.parse(req.body)
  const owner = await prisma.leadOwner.upsert({
    where: { leadId_userId: { leadId: req.params.id as string, userId } },
    update: { role },
    create: { leadId: req.params.id as string, userId, role },
    include: { user: { select: { id: true, name: true, role: true } } }
  })
  res.status(201).json(owner)
})

router.delete('/:id/owners/:userId', async (req, res) => {
  await prisma.leadOwner.deleteMany({ where: { leadId: req.params.id as string, userId: req.params.userId as string } })
  res.status(204).end()
})

// Stage/status change
router.patch('/:id/status', async (req: AuthRequest, res) => {
  const { status } = req.body as { status: string }
  const lead = await prisma.lead.update({ where: { id: req.params.id as string }, data: { status: status as any } })
  await appendEvent('Lead', lead.id, 'STATUS_CHANGED', `Status changed to ${status}`, req.user?.id)

  let promotedDeal = null
  if (status === 'OrderWon') {
    const existing = await prisma.deal.findFirst({ where: { leadId: lead.id, isActive: true } })
    if (!existing) {
      promotedDeal = await prisma.deal.create({
        data: { companyId: lead.companyId, leadId: lead.id, title: lead.title, stage: 'LeadIn', notes: `Auto-promoted from Lead (Order Won)` },
        include: { company: { select: { id: true, name: true } } },
      })
      await appendEvent('Deal', promotedDeal.id, 'CREATED', `Deal auto-created from Lead "${lead.title}"`, req.user?.id)
    }
  }
  res.json({ lead, promotedDeal })
})

router.patch('/:id/stage', async (req: AuthRequest, res) => {
  const { stage } = req.body as { stage: string }
  const lead = await prisma.lead.update({ where: { id: req.params.id as string }, data: { stage: stage as any } })
  await appendEvent('Lead', lead.id, 'STAGE_CHANGED', `Stage advanced to ${stage}`, req.user?.id)
  res.json(lead)
})

export default router
