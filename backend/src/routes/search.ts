import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { resolvePermission } from '../middleware/permissions'

const router = createSafeRouter()
router.use(authenticate)

const PER_TYPE = 5

export interface SearchHit {
  id: string
  type: 'Lead' | 'Contact' | 'Account' | 'Deal' | 'Project' | 'Ticket' | 'Invoice'
  title: string
  sub: string
  route: string
}

/**
 * Global search across the live dataset. Each entity type is only queried when
 * the caller can actually read it, so results never leak records the user
 * would be denied on click-through.
 */
router.get('/', async (req: AuthRequest, res) => {
  const q = String(req.query.q ?? '').trim()
  if (q.length < 2) { res.json([]); return }

  const { id: userId, roleName } = req.user!
  const can = (resource: string, action: string) => resolvePermission(userId, roleName, resource, action)

  const [canLead, canContact, canCompany, canDeal, canProject, canSupport, canInvoice] = await Promise.all([
    can('lead', 'read_own'), can('contact', 'read_own'), can('company', 'read_all'),
    can('deal', 'read_own'), can('project', 'read_own'), can('support', 'read_all'),
    can('invoice', 'read_all'),
  ])

  const like = { contains: q, mode: 'insensitive' as const }
  const results: SearchHit[] = []

  await Promise.all([
    canLead ? prisma.lead.findMany({
      where: { isActive: true, OR: [{ title: like }, { leadNumber: like }] },
      take: PER_TYPE, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, status: true, company: { select: { name: true } } },
    }).then(rows => rows.forEach(r => results.push({
      id: r.id, type: 'Lead', title: r.title,
      sub: [r.company?.name, r.status].filter(Boolean).join(' · '), route: '/leads',
    }))) : null,

    canContact ? prisma.contact.findMany({
      where: { isActive: true, OR: [{ name: like }, { email: like }, { phone: like }] },
      take: PER_TYPE, orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, designation: true, company: { select: { name: true } } },
    }).then(rows => rows.forEach(r => results.push({
      id: r.id, type: 'Contact', title: r.name,
      sub: [r.designation, r.company?.name].filter(Boolean).join(' · '), route: '/contacts',
    }))) : null,

    canCompany ? prisma.company.findMany({
      where: { isActive: true, OR: [{ name: like }, { nickname: like }] },
      take: PER_TYPE, orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, industry: true },
    }).then(rows => rows.forEach(r => results.push({
      id: r.id, type: 'Account', title: r.name,
      sub: r.industry ?? 'Account', route: `/customers/${r.id}`,
    }))) : null,

    canDeal ? prisma.deal.findMany({
      where: { isActive: true, OR: [{ title: like }, { leadNumber: like }] },
      take: PER_TYPE, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, stage: true, value: true, company: { select: { name: true } } },
    }).then(rows => rows.forEach(r => results.push({
      id: r.id, type: 'Deal', title: r.title,
      sub: [r.company?.name, r.stage].filter(Boolean).join(' · '), route: '/deals',
    }))) : null,

    canProject ? prisma.project.findMany({
      where: { isActive: true, OR: [{ title: like }, { leadNumber: like }] },
      take: PER_TYPE, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, status: true, company: { select: { name: true } } },
    }).then(rows => rows.forEach(r => results.push({
      id: r.id, type: 'Project', title: r.title,
      sub: [r.company?.name, r.status].filter(Boolean).join(' · '), route: '/projects',
    }))) : null,

    canSupport ? prisma.supportTicket.findMany({
      where: { isActive: true, title: like },
      take: PER_TYPE, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, status: true, priority: true },
    }).then(rows => rows.forEach(r => results.push({
      id: r.id, type: 'Ticket', title: r.title,
      sub: [r.priority, r.status].filter(Boolean).join(' · '), route: '/support',
    }))) : null,

    canInvoice ? prisma.invoice.findMany({
      where: { OR: [{ number: like }, { customer: like }] },
      take: PER_TYPE, orderBy: { createdAt: 'desc' },
      select: { id: true, number: true, customer: true, status: true },
    }).then(rows => rows.forEach(r => results.push({
      id: r.id, type: 'Invoice', title: `#${r.number}`,
      sub: [r.customer, r.status].filter(Boolean).join(' · '), route: '/invoices',
    }))) : null,
  ])

  // Exact prefix matches first — a user typing a full name expects it on top.
  const lower = q.toLowerCase()
  results.sort((a, b) => {
    const aStarts = a.title.toLowerCase().startsWith(lower) ? 0 : 1
    const bStarts = b.title.toLowerCase().startsWith(lower) ? 0 : 1
    return aStarts - bStarts
  })

  res.json(results)
})

export default router
