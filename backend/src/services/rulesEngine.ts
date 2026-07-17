import prisma from '../lib/prisma'
import { createNotification } from './notify'
import { appendEvent } from './timeline'
import { logAudit } from './audit'

export type RuleSeverity = 'info' | 'warning' | 'critical'

export interface RuleTrigger {
  entityType: string
  entityId: string
  tierKey: string // dedup/cooldown key within this rule, e.g. "75", "overdue_15d"
  severity: RuleSeverity
  title: string
  message: string
}

export interface RuleConfig {
  recipientRoles: string[]
  cooldownHours?: number
  [key: string]: unknown
}

export type RuleHandler = (config: RuleConfig) => Promise<RuleTrigger[]>

const handlers = new Map<string, RuleHandler>()

export function registerRule(key: string, handler: RuleHandler) {
  handlers.set(key, handler)
}

async function recipientsForRoles(roles: string[]): Promise<string[]> {
  if (!roles.length) return []
  const users = await prisma.user.findMany({ where: { isActive: true, roleName: { in: roles } }, select: { id: true } })
  return users.map(u => u.id)
}

// A tier is "in cooldown" if it already fired for this exact entity+tierKey within
// the configured window — prevents re-notifying every 5-minute scan tick.
async function inCooldown(ruleId: string, entityType: string, entityId: string, tierKey: string, cooldownHours: number): Promise<boolean> {
  const since = new Date(Date.now() - cooldownHours * 3600_000)
  const existing = await prisma.ruleTriggerLog.findFirst({
    where: { ruleId, entityType, entityId, tierKey, firedAt: { gte: since } },
  })
  return !!existing
}

export async function runAllRules() {
  const rules = await prisma.businessRule.findMany({ where: { enabled: true } })
  for (const rule of rules) {
    const handler = handlers.get(rule.key)
    if (!handler) continue
    const config = rule.config as unknown as RuleConfig
    const cooldownHours = config.cooldownHours ?? 24

    let triggers: RuleTrigger[]
    try {
      triggers = await handler(config)
    } catch {
      continue // one bad rule shouldn't kill the whole scan
    }

    for (const t of triggers) {
      if (await inCooldown(rule.id, t.entityType, t.entityId, t.tierKey, cooldownHours)) continue

      const recipients = await recipientsForRoles(config.recipientRoles ?? [])

      await prisma.ruleTriggerLog.create({
        data: { ruleId: rule.id, entityType: t.entityType, entityId: t.entityId, tierKey: t.tierKey, severity: t.severity, message: t.message },
      })

      if (recipients.length) {
        await createNotification({
          userIds: recipients,
          type: rule.key,
          severity: t.severity,
          title: t.title,
          message: t.message,
          entityType: t.entityType,
          entityId: t.entityId,
        })
      }

      await appendEvent(t.entityType, t.entityId, `rule_${rule.key}`, t.message)

      await logAudit({
        action: 'rule_trigger',
        module: rule.module,
        entityId: t.entityId,
        reason: `${rule.name}: ${t.tierKey}`,
        newValue: { severity: t.severity, message: t.message },
      })
    }
  }
}
