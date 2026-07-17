import prisma from '../lib/prisma'

export async function logAudit(opts: {
  userId?: string
  userName?: string
  roleName?: string
  action: string
  module: string
  entityId?: string
  oldValue?: unknown
  newValue?: unknown
  reason?: string
  ipAddress?: string
  userAgent?: string
}) {
  await prisma.auditLog.create({
    data: {
      userId: opts.userId,
      userName: opts.userName,
      roleName: opts.roleName,
      action: opts.action,
      module: opts.module,
      entityId: opts.entityId,
      oldValue: opts.oldValue as any,
      newValue: opts.newValue as any,
      reason: opts.reason,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    },
  })
}
