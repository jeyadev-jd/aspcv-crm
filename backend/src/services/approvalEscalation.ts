import prisma from '../lib/prisma'
import { createNotification } from './notify'
import { appendEvent } from './timeline'

// Escalation chain: tier 0 -> 1 -> 2 -> 3, gated by cumulative days since the
// request was created (matches: Day 1 PM, Day 2 ProjectHead, Day 5 BusinessHead,
// then SuperAdmin as the final backstop with no further escalation).
const TIER_ROLE = ['Manager', 'ProjectHead', 'BusinessHead', 'SuperAdmin'] as const
const TIER_SLA_DAYS = [1, 2, 5] // day threshold to escalate OUT of tier 0, 1, 2 respectively

export function roleForTier(tier: number): string {
  return TIER_ROLE[Math.min(tier, TIER_ROLE.length - 1)]
}

async function recipientsForRole(role: string): Promise<string[]> {
  const users = await prisma.user.findMany({ where: { isActive: true, roleName: role }, select: { id: true } })
  return users.map(u => u.id)
}

export async function runApprovalEscalation() {
  const pending = await prisma.approvalRequest.findMany({
    where: { status: 'pending', escalationTier: { lt: TIER_ROLE.length - 1 } },
    include: { requestedBy: { select: { name: true } } },
  })

  for (const ar of pending) {
    const ageDays = (Date.now() - ar.createdAt.getTime()) / 86400_000
    const slaForCurrentTier = TIER_SLA_DAYS[ar.escalationTier]
    if (slaForCurrentTier === undefined || ageDays < slaForCurrentTier) continue

    const newTier = ar.escalationTier + 1
    const newRole = roleForTier(newTier)

    await prisma.approvalRequest.update({
      where: { id: ar.id },
      data: { escalationTier: newTier, lastEscalatedAt: new Date() },
    })

    const recipients = await recipientsForRole(newRole)
    await createNotification({
      userIds: recipients,
      type: 'approval_escalated',
      severity: newTier >= TIER_ROLE.length - 1 ? 'critical' : 'warning',
      title: `Escalated approval: ${ar.action} on ${ar.entityType}`,
      message: `Request from ${ar.requestedBy.name} (${ar.action} on ${ar.entityType}) had no action for ${Math.floor(ageDays)} day(s) and has escalated to ${newRole}.`,
      entityType: 'approval_request',
      entityId: ar.id,
    })

    await appendEvent('approval_request', ar.id, 'escalated',
      `Escalated to ${newRole} after ${Math.floor(ageDays)} day(s) with no action`)
  }
}
