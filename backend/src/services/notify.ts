import prisma from '../lib/prisma'

// Roles that should receive project-overrun alerts
const ALERT_ROLES = ['SuperAdmin', 'ProjectHead', 'BusinessHead']

export async function createNotification(opts: {
  userIds: string[]
  type: string
  severity?: 'info' | 'warning' | 'critical'
  title: string
  message: string
  entityType?: string
  entityId?: string
}) {
  if (!opts.userIds.length) return
  await prisma.notification.createMany({
    data: opts.userIds.map(userId => ({
      userId,
      type: opts.type,
      severity: opts.severity ?? 'info',
      title: opts.title,
      message: opts.message,
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
    })),
  })
}

async function alertRecipientIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true, roleName: { in: ALERT_ROLES } },
    select: { id: true },
  })
  return users.map(u => u.id)
}

/**
 * Tiered budget-overrun check. Fires once per tier (50/75/100% of budget spent).
 * `alertTier` on the project records the highest tier already alerted, so we never
 * spam the same threshold twice.
 */
export async function checkProjectOverrun(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project || !project.isActive) return
  const budget = project.budget ?? 0
  const spent = project.actualBudget ?? 0
  const progress = project.progress ?? 0
  if (budget <= 0) return

  const ratio = spent / budget
  const prevTier = project.alertTier ?? 0

  let tier = 0
  if (ratio >= 1) tier = 100
  else if (ratio >= 0.75) tier = 75
  else if (ratio >= 0.5) tier = 50

  // Only alert when a NEW, higher tier is crossed
  if (tier <= prevTier) return

  // Low-progress condition: progress lagging behind spend
  const lowProgress = progress < tier // e.g. spent 75% but progress < 75%
  if (!lowProgress && tier < 100) return // for 50/75 require lagging progress; 100% always alerts

  const severity = tier >= 100 ? 'critical' : tier >= 75 ? 'critical' : 'warning'
  const recipients = await alertRecipientIds()

  await createNotification({
    userIds: recipients,
    type: 'project_overrun',
    severity,
    title: `Budget alert: ${project.title}`,
    message:
      tier >= 100
        ? `Spend has reached ${Math.round(ratio * 100)}% of the ₹${budget.toLocaleString()} budget (progress ${progress}%). Project is over budget.`
        : `Spend has crossed ${tier}% of the ₹${budget.toLocaleString()} budget while progress is only ${progress}%.`,
    entityType: 'Project',
    entityId: project.id,
  })

  await prisma.project.update({ where: { id: project.id }, data: { alertTier: tier } })
}
