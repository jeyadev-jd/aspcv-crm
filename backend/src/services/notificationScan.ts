import prisma from '../lib/prisma'
import { createNotification } from './notify'

const LOW_STOCK_THRESHOLD = 5
const SERVICE_DUE_WINDOW_DAYS = 30
const DEDUPE_WINDOW_HOURS = 24

async function alreadyNotifiedRecently(type: string, entityId: string): Promise<boolean> {
  const since = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 3600_000)
  const existing = await prisma.notification.findFirst({ where: { type, entityId, createdAt: { gte: since } } })
  return !!existing
}

async function inventoryRecipientIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true, roleName: { in: ['SuperAdmin', 'Manager', 'ProjectHead'] } },
    select: { id: true },
  })
  return users.map(u => u.id)
}

async function serviceRecipientIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true, roleName: { in: ['SuperAdmin', 'ProjectHead', 'BusinessHead'] } },
    select: { id: true },
  })
  return users.map(u => u.id)
}

// Low stock: raw components below threshold, not already assigned/consumed
export async function checkLowStock() {
  const components = await prisma.rawComponent.findMany({
    where: { status: 'in_stock', quantity: { lte: LOW_STOCK_THRESHOLD, gt: 0 } },
  })
  if (!components.length) return
  const recipients = await inventoryRecipientIds()
  for (const c of components) {
    if (await alreadyNotifiedRecently('low_stock', c.id)) continue
    await createNotification({
      userIds: recipients,
      type: 'low_stock',
      severity: (c.quantity ?? 0) <= 2 ? 'critical' : 'warning',
      title: `Low stock: ${c.name}`,
      message: `Only ${c.quantity} ${c.unit ?? 'unit(s)'} left of ${c.name} (${c.refNumber}).`,
      entityType: 'RawComponent',
      entityId: c.id,
    })
  }
}

// Service/warranty due: ServiceRecord warranties expiring within the window
export async function checkServiceDue() {
  const cutoff = new Date(Date.now() + SERVICE_DUE_WINDOW_DAYS * 86400_000)
  const records = await prisma.serviceRecord.findMany({
    where: { warrantyEnd: { lte: cutoff, gte: new Date() } },
    include: { project: { select: { title: true } } },
  })
  if (!records.length) return
  const recipients = await serviceRecipientIds()
  for (const r of records) {
    if (await alreadyNotifiedRecently('service_due', r.id)) continue
    const daysLeft = Math.ceil((r.warrantyEnd!.getTime() - Date.now()) / 86400_000)
    await createNotification({
      userIds: recipients,
      type: 'service_due',
      severity: daysLeft <= 7 ? 'critical' : 'warning',
      title: `Warranty expiring: ${r.project.title}`,
      message: `Warranty for "${r.project.title}" expires in ${daysLeft} day(s).`,
      entityType: 'ServiceRecord',
      entityId: r.id,
    })
  }
}

// Overdue Kanban cards: past due date, not archived/done, notify assignees
export async function checkOverdueCards() {
  const cards = await prisma.kanbanCard.findMany({
    where: { isArchived: false, dueDate: { lt: new Date() }, column: { isDoneColumn: false } },
    include: { assignees: { select: { userId: true } } },
  })
  for (const c of cards) {
    if (!c.assignees.length) continue
    if (await alreadyNotifiedRecently('task_overdue', c.id)) continue
    await createNotification({
      userIds: c.assignees.map(a => a.userId),
      type: 'task_overdue',
      severity: 'warning',
      title: `Overdue: ${c.title}`,
      message: `"${c.title}" was due on ${c.dueDate!.toLocaleDateString('en-IN')}.`,
      entityType: 'KanbanCard',
      entityId: c.id,
    })
  }
}

export async function runNotificationScan() {
  await Promise.all([checkLowStock(), checkServiceDue(), checkOverdueCards()])
}
