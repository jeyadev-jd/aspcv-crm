import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { leadSchema, stripUnsentDefaults } from '../lib/zod-schemas'
import { appendEvent } from '../services/timeline'
import { logAudit } from '../services/audit'
import { notifyRoles, createNotification } from '../services/notify'
import { requirePermission, resolvePermission, checkApprovalToken, consumeApprovalToken } from '../middleware/permissions'
import { getScopeFilter } from '../middleware/scoping'
import { parsePagination, paginate } from '../lib/pagination'
import { activeFilter, enforceActiveOr404, rejectIfInactive } from '../lib/softDelete'
import { nextLeadNumber } from '../lib/sequences'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const USER_SELECT = { id: true, name: true, role: true }
const NAME_SELECT = { id: true, name: true }

const INCLUDE_FULL = {
  company: { select: { id: true, name: true, customerType: true, region: true, state: true, city: true, area: true, nickname: true, stateCode: true, areaCode: true, cityCode: true } },
  contacts: { orderBy: { isPrimary: 'desc' as const } },
  owners: { include: { user: { select: { id: true, name: true, role: true } } } },
  sources: true,
  department: { select: { id: true, name: true } },
  // Phase 1: expanded relational objects, not just IDs — matches existing department pattern.
  regionRef: { select: NAME_SELECT },
  commercialModel: { select: NAME_SELECT },
  leadSourceRef: { select: NAME_SELECT },
  capacityUnit: { select: NAME_SELECT },
  primaryOwner: { select: USER_SELECT },
  secondaryOwner: { select: USER_SELECT },
  salesManager: { select: USER_SELECT },
  businessHead: { select: USER_SELECT },
  solution: { include: { solution: { include: { category: { select: NAME_SELECT } } }, accessories: { include: { accessory: { select: NAME_SELECT } } } } },
}

// ── Phase 1 sales pipeline: transition rules + mandatory-field gates ──
const PIPELINE_ORDER = [
  'Initial', 'QuestionnaireSent', 'QuestionnaireFollowUp', 'QuestionnaireValidation',
  'TechnicalDiscussion', 'Costing', 'ProposalPreparation', 'ProposalSubmitted',
  'Prospective', 'HighlyProspective', 'Negotiation', 'OrderWon',
] as const
// ProjectDropped can be reached from any non-terminal stage (a deal can die at any point).
const VALID_PIPELINE_STAGES = [...PIPELINE_ORDER, 'ProjectDropped']

function allowedNextPipelineStages(current: string): string[] {
  const idx = PIPELINE_ORDER.indexOf(current as any)
  const next: string[] = ['ProjectDropped']
  if (idx >= 0 && idx < PIPELINE_ORDER.length - 1) next.push(PIPELINE_ORDER[idx + 1])
  // Backward correction always allowed (matches the existing Lead.stage pattern below).
  if (idx > 0) next.push(...PIPELINE_ORDER.slice(0, idx))
  return next
}

// Required lead fields before a stage may be entered — the "mandatory business data" gate.
const REQUIRED_FIELDS_PER_STAGE: Record<string, (lead: any) => string | null> = {
  Costing: lead => (!lead.capacityValue || !lead.capacityUnitId) ? 'Capacity value and unit are required before Costing' : null,
  ProposalPreparation: lead => !lead.estimatedValue ? 'Estimated value is required before Proposal Preparation' : null,
  Negotiation: lead => !lead.primaryOwnerId ? 'A Primary Owner must be assigned before Negotiation' : null,
}

// Shared by both the legacy status-driven promotion and the new pipeline-stage promotion —
// one Lead→Deal creation path, no duplicated business logic.
async function promoteLeadToDeal(tx: any, lead: any, actorId?: string) {
  const existingDeal = await tx.deal.findFirst({ where: { leadId: lead.id, isActive: true } })
  if (existingDeal) return null
  return tx.deal.create({
    data: {
      companyId: lead.companyId, leadId: lead.id, title: lead.title, stage: 'LeadIn',
      notes: `Auto-promoted from Lead (Order Won)`,
      // Deal inherits region/commercial model/ownership from the Lead automatically.
      regionId: lead.regionId ?? undefined,
      commercialModelId: lead.commercialModelId ?? undefined,
      departmentId: lead.departmentId ?? undefined,
      assignedPMId: lead.primaryOwnerId ?? undefined,
      owners: lead.primaryOwnerId ? { create: { userId: lead.primaryOwnerId, role: 'primary' } } : undefined,
    },
    include: { company: { select: { id: true, name: true } } },
  })
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
  const { status, region, source, regionId, commercialModelId, pipelineStage, companyId, ownerId, stage, includeInactive } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
  const scope = await getScopeFilter(req.user!.id, req.user!.roleName, 'lead')
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'lead', 'delete')
  const where = {
    ...scope,
    ...activeFilter(includeInactive === 'true' && canManage),
    ...(status && { status: status as any }),
    ...(region && { regionRef: { name: region } }),
    ...(source && { leadSourceRef: { name: source } }),
    ...(regionId && { regionId }),
    ...(commercialModelId && { commercialModelId }),
    ...(pipelineStage && { pipelineStage: pipelineStage as any }),
    ...(companyId && { companyId }),
    ...(stage && { stage: stage as any }),
    ...(ownerId && { owners: { some: { userId: ownerId } } }),
    ...(pagination.search && { title: { contains: pagination.search, mode: 'insensitive' as const } }),
  }
  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: INCLUDE_FULL,
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.lead.count({ where }),
  ])
  res.json(paginate(leads, total, pagination))
})

router.get('/:id', requirePermission('lead', 'read_own'), async (req: AuthRequest, res) => {
  const { includeInactive } = req.query as Record<string, string>
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id as string },
    include: {
      ...INCLUDE_FULL,
      company: true,
      deals: { where: { isActive: true }, select: { id: true, title: true, stage: true } },
    },
  })
  const canReadAll = await resolvePermission(req.user!.id, req.user!.roleName, 'lead', 'read_all')
  if (!canReadAll && lead && !lead.owners.some(o => o.userId === req.user!.id)) { res.status(403).json({ error: 'Insufficient permissions' }); return }
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'lead', 'delete')
  if (!enforceActiveOr404(lead, includeInactive === 'true' && canManage, res)) return
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

// Any caller (e.g. CSV import) that still sends raw region/commercialType/source strings
// instead of FK ids gets them resolved to the matching master row — STRICT lookup only.
// No auto-create: an unrecognized name is a 400, not a new master row, so master data stays
// admin-curated and doesn't silently accumulate typos/duplicates from bulk imports.
async function resolveLegacyFKs(fields: { region?: string; commercialType?: string; source?: string; regionId?: string; commercialModelId?: string; leadSourceId?: string }) {
  const out: { regionId?: string; commercialModelId?: string; leadSourceId?: string } = {}
  if (fields.region && !fields.regionId) {
    const r = await prisma.region.findUnique({ where: { name: fields.region } })
    if (!r) throw Object.assign(new Error(`Unknown region "${fields.region}" — add it under Admin > Master Data first`), { status: 400 })
    out.regionId = r.id
  }
  if (fields.commercialType && !fields.commercialModelId) {
    const m = await prisma.commercialModel.findUnique({ where: { name: fields.commercialType } })
    if (!m) throw Object.assign(new Error(`Unknown commercial type "${fields.commercialType}" — add it under Admin > Master Data first`), { status: 400 })
    out.commercialModelId = m.id
  }
  if (fields.source && !fields.leadSourceId) {
    const s = await prisma.leadSourceMaster.findUnique({ where: { name: fields.source } })
    if (!s) throw Object.assign(new Error(`Unknown lead source "${fields.source}" — add it under Admin > Master Data first`), { status: 400 })
    out.leadSourceId = s.id
  }
  return out
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
  const leadNumber = await nextLeadNumber()
  const reverseFks = await resolveLegacyFKs(rest)
  const { region: _region, commercialType: _commercialType, source: _source, ...leadFields } = { ...rest, ...reverseFks }

  const company = await prisma.company.findUnique({ where: { id: rest.companyId } })

  const lead = await prisma.lead.create({
    data: {
      ...leadFields,
      serialNo,
      leadNumber,
      createdById: req.user!.id,
      closeDate: rest.closeDate ? new Date(rest.closeDate) : undefined,
      leadDate: rest.leadDate ? new Date(rest.leadDate) : new Date(),
      ownerAssignedAt: rest.primaryOwnerId ? new Date() : undefined,
      ownerChangedBy: rest.primaryOwnerId ? req.user!.id : undefined,
      owners: req.user ? { create: { userId: req.user.id, role: 'primary' } } : undefined,
      stageHistory: { create: { stage: 'Initial', changedBy: req.user?.id } },
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
  const existingLead = await prisma.lead.findUnique({ where: { id: req.params.id as string } })
  if (!rejectIfInactive(existingLead, res)) return
  const { allowed, approvalId } = await checkApprovalToken(req.user!.id, req.user!.roleName, 'lead', req.params.id as string, 'edit')
  if (!allowed) {
    res.status(403).json({ error: 'approval_required', entityType: 'lead', entityId: req.params.id, action: 'edit' })
    return
  }
  const { contacts, sources, leadNumber: _ignoredLeadNumber, ...rest } = stripUnsentDefaults(leadSchema.partial().parse(req.body), req.body)
  const ownerFieldsChanged = ['primaryOwnerId', 'secondaryOwnerId', 'salesManagerId', 'businessHeadId'].some(k => k in rest)
  const reverseFks = await resolveLegacyFKs(rest)
  const { region: _region2, commercialType: _commercialType2, source: _source2, ...leadFields } = { ...rest, ...reverseFks }
  const lead = await prisma.lead.update({
    where: { id: req.params.id as string },
    data: {
      ...leadFields,
      closeDate: rest.closeDate ? new Date(rest.closeDate) : undefined,
      leadDate: rest.leadDate ? new Date(rest.leadDate) : undefined,
      ...(ownerFieldsChanged && { ownerAssignedAt: new Date(), ownerChangedBy: req.user!.id }),
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
  const existing = await prisma.lead.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.isActive === false) { res.status(204).end(); return } // idempotent
  const { allowed, approvalId } = await checkApprovalToken(req.user!.id, req.user!.roleName, 'lead', req.params.id as string, 'delete')
  if (!allowed) {
    res.status(403).json({ error: 'approval_required', entityType: 'lead', entityId: req.params.id, action: 'delete' })
    return
  }
  await prisma.lead.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  if (approvalId) await consumeApprovalToken(approvalId)
  res.status(204).end()
})

router.post('/:id/restore', requirePermission('lead', 'delete'), async (req: AuthRequest, res) => {
  const existing = await prisma.lead.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const lead = await prisma.lead.update({ where: { id: req.params.id as string }, data: { isActive: true }, include: INCLUDE_FULL })
  await appendEvent('Lead', lead.id, 'RESTORED', `Lead "${lead.title}" restored`, req.user?.id)
  res.json(lead)
})

// Lead contacts CRUD
router.delete('/:id/contacts/:contactId', requirePermission('lead', 'edit'), async (req: AuthRequest, res) => {
  await prisma.leadContact.delete({ where: { id: req.params.contactId as string } })
  res.status(204).end()
})

// Owner management
const ownerSchema = z.object({ userId: z.string(), role: z.string().default('secondary') })

router.post('/:id/owners', requirePermission('lead', 'edit'), async (req: AuthRequest, res) => {
  const { userId, role } = ownerSchema.parse(req.body)
  const owner = await prisma.leadOwner.upsert({
    where: { leadId_userId: { leadId: req.params.id as string, userId } },
    update: { role },
    create: { leadId: req.params.id as string, userId, role },
    include: { user: { select: { id: true, name: true, role: true } } }
  })
  res.status(201).json(owner)
})

router.delete('/:id/owners/:userId', requirePermission('lead', 'edit'), async (req, res) => {
  await prisma.leadOwner.deleteMany({ where: { leadId: req.params.id as string, userId: req.params.userId as string } })
  res.status(204).end()
})

// Stage/status change
const VALID_LEAD_STATUSES = ['Enquiry', 'ProspectiveLead', 'ProjectHold', 'Hibernated', 'OrderWon', 'OrderLost']
// Enquiry -> ProspectiveLead -> ProjectHold/Hibernated -> OrderWon/OrderLost. Reopen from lost only.
const ALLOWED_LEAD_STATUS_TRANSITIONS: Record<string, string[]> = {
  Enquiry: ['ProspectiveLead', 'Hibernated', 'OrderLost'],
  ProspectiveLead: ['ProjectHold', 'Hibernated', 'OrderWon', 'OrderLost'],
  ProjectHold: ['ProspectiveLead', 'Hibernated', 'OrderLost'],
  Hibernated: ['ProspectiveLead', 'OrderLost'],
  OrderWon: [],
  OrderLost: ['ProspectiveLead'],
}

router.patch('/:id/status', requirePermission('lead', 'edit'), async (req: AuthRequest, res) => {
  const { status } = req.body as { status: string }
  if (!VALID_LEAD_STATUSES.includes(status)) return res.status(400).json({ error: `Invalid status: ${status}` })

  const existing = await prisma.lead.findUnique({ where: { id: req.params.id as string } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const allowed = ALLOWED_LEAD_STATUS_TRANSITIONS[existing.status] ?? []
  if (!allowed.includes(status)) return res.status(400).json({ error: `Cannot move lead from ${existing.status} to ${status}` })

  const { lead, promotedDeal } = await prisma.$transaction(async tx => {
    const lead = await tx.lead.update({ where: { id: req.params.id as string }, data: { status: status as any } })
    const promotedDeal = status === 'OrderWon' ? await promoteLeadToDeal(tx, lead, req.user?.id) : null
    return { lead, promotedDeal }
  })

  await appendEvent('Lead', lead.id, 'STATUS_CHANGED', `Status changed to ${status}`, req.user?.id)
  if (promotedDeal) await appendEvent('Deal', promotedDeal.id, 'CREATED', `Deal auto-created from Lead "${lead.title}"`, req.user?.id)
  res.json({ lead, promotedDeal })
})

const VALID_LIFECYCLE_STAGES = ['Lead', 'QualifiedLead', 'Deal', 'Project', 'Installation', 'Support']
const LIFECYCLE_STAGE_ORDER = VALID_LIFECYCLE_STAGES

router.patch('/:id/stage', requirePermission('lead', 'edit'), async (req: AuthRequest, res) => {
  const { stage } = req.body as { stage: string }
  if (!VALID_LIFECYCLE_STAGES.includes(stage)) return res.status(400).json({ error: `Invalid stage: ${stage}` })

  const existing = await prisma.lead.findUnique({ where: { id: req.params.id as string } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const currentIdx = LIFECYCLE_STAGE_ORDER.indexOf(existing.stage)
  const nextIdx = LIFECYCLE_STAGE_ORDER.indexOf(stage)
  // Allow moving forward one step at a time, or backward any amount (correction)
  if (nextIdx > currentIdx + 1) return res.status(400).json({ error: `Cannot skip from ${existing.stage} directly to ${stage}` })

  const lead = await prisma.lead.update({ where: { id: req.params.id as string }, data: { stage: stage as any } })
  await appendEvent('Lead', lead.id, 'STAGE_CHANGED', `Stage advanced to ${stage}`, req.user?.id)
  res.json(lead)
})

// ── Phase 1: sales pipeline stage transition ──
// Separate from /status and /stage above (those are pre-existing, untouched, still relied
// on by Deal/Project/reports). This is the new 13-stage pipeline with mandatory-field gates.
router.patch('/:id/pipeline-stage', requirePermission('lead', 'edit'), async (req: AuthRequest, res) => {
  const { stage, remarks } = req.body as { stage: string; remarks?: string }
  if (!VALID_PIPELINE_STAGES.includes(stage as any)) { res.status(400).json({ error: `Invalid pipeline stage: ${stage}` }); return }

  const existing = await prisma.lead.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const allowed = allowedNextPipelineStages(existing.pipelineStage)
  if (!allowed.includes(stage)) {
    res.status(400).json({ error: `Cannot move lead from ${existing.pipelineStage} to ${stage}` })
    return
  }
  const gateError = REQUIRED_FIELDS_PER_STAGE[stage]?.(existing)
  if (gateError) { res.status(400).json({ error: gateError }); return }

  const now = new Date()
  const { lead, promotedDeal } = await prisma.$transaction(async tx => {
    // Close the previous open history row, open a new one.
    await tx.leadStageHistory.updateMany({
      where: { leadId: existing.id, exitedAt: null },
      data: { exitedAt: now },
    })
    await tx.leadStageHistory.create({
      data: { leadId: existing.id, stage: stage as any, enteredAt: now, remarks, changedBy: req.user!.id },
    })

    // pipelineStage OrderWon/ProjectDropped one-way syncs the pre-existing `status` field
    // so every existing status-driven consumer (Deal auto-promotion incl.) keeps working.
    const statusSync = stage === 'OrderWon' ? 'OrderWon' : stage === 'ProjectDropped' ? 'OrderLost' : undefined
    const lead = await tx.lead.update({
      where: { id: existing.id },
      data: { pipelineStage: stage as any, ...(statusSync && { status: statusSync as any }) },
      include: INCLUDE_FULL,
    })

    const promotedDeal = stage === 'OrderWon' ? await promoteLeadToDeal(tx, lead, req.user?.id) : null
    return { lead, promotedDeal }
  })

  await appendEvent('Lead', lead.id, 'PIPELINE_STAGE_CHANGED', `Pipeline stage advanced to ${stage}`, req.user?.id, { from: existing.pipelineStage, to: stage, remarks })
  await logAudit({ userId: req.user?.id, roleName: req.user?.roleName, action: 'PIPELINE_STAGE_CHANGED', module: 'lead', entityId: lead.id, oldValue: { pipelineStage: existing.pipelineStage }, newValue: { pipelineStage: stage } })
  if (lead.primaryOwnerId) {
    await createNotification({
      userIds: [lead.primaryOwnerId], type: 'lead_pipeline', severity: 'info',
      title: `Lead ${lead.leadNumber ?? lead.title} moved to ${stage}`,
      message: `Pipeline stage advanced to ${stage}.`,
      entityType: 'Lead', entityId: lead.id,
    })
  }
  if (promotedDeal) {
    await appendEvent('Deal', promotedDeal.id, 'CREATED', `Deal auto-created from Lead "${lead.title}"`, req.user?.id)
    await notifyRoles(['SuperAdmin', 'BusinessHead'], {
      type: 'deal', severity: 'info',
      title: `Lead ${lead.leadNumber ?? lead.title} won`,
      message: `Lead reached Order Won and was promoted to a Deal.`,
      entityType: 'Deal', entityId: promotedDeal.id,
    })
  }
  res.json({ lead, promotedDeal })
})

router.get('/:id/stage-history', requirePermission('lead', 'read_own'), async (req: AuthRequest, res) => {
  const history = await prisma.leadStageHistory.findMany({
    where: { leadId: req.params.id as string },
    orderBy: { enteredAt: 'asc' },
  })
  const withDuration = history.map(h => ({
    ...h,
    durationMs: (h.exitedAt ?? new Date()).getTime() - h.enteredAt.getTime(),
  }))
  res.json(withDuration)
})

export default router
