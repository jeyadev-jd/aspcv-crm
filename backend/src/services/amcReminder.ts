import prisma from '../lib/prisma'
import { createNotification, notifyRoles } from './notify'

/**
 * Daily sweep over completed projects that never got their warranty/AMC terms
 * filled in. Each project is chased once — `amcReminderSentAt` records the ping
 * so the owner isn't re-notified every day for the same gap.
 *
 * Recipients: the assigned PM and the owning department head, falling back to
 * the ProjectHead role when the project has neither.
 */
export async function scanMissingAmcDetails(): Promise<number> {
  const gaps = await prisma.project.findMany({
    where: {
      status: 'Completed',
      isActive: true,
      amcReminderSentAt: null,
      OR: [
        { warrantyEnd: null },
        { warrantyStart: null },
        { warrantyBudgetAllocated: null },
        { warrantyBudgetAllocated: 0 },
      ],
    },
    select: {
      id: true,
      title: true,
      assignedPMId: true,
      department: { select: { headUserId: true } },
    },
    take: 200,
  })

  for (const project of gaps) {
    const recipients = [project.assignedPMId, project.department?.headUserId].filter(Boolean) as string[]
    const payload = {
      type: 'amc_details_missing',
      severity: 'warning' as const,
      title: 'Warranty / AMC details missing',
      message: `Completed project "${project.title}" has no warranty dates or warranty budget recorded. Please complete the AMC details.`,
      entityType: 'Project',
      entityId: project.id,
    }

    if (recipients.length > 0) await createNotification({ userIds: [...new Set(recipients)], ...payload })
    else await notifyRoles(['ProjectHead', 'SuperAdmin'], payload)

    await prisma.project.update({
      where: { id: project.id },
      data: { amcReminderSentAt: new Date() },
    })
  }

  return gaps.length
}
