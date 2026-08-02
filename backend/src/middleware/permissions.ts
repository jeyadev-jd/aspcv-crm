import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import prisma from '../lib/prisma'
import { getCached, setCached } from '../services/permissions-cache'

export async function resolvePermission(
  userId: string,
  roleName: string,
  resource: string,
  action: string
): Promise<boolean> {
  if (roleName === 'SuperAdmin') return true

  const cached = getCached(userId, resource, action)
  if (cached !== undefined) return cached

  // 1. User-level override (highest priority)
  const override = await prisma.userPermissionOverride.findUnique({
    where: { userId_resource_action: { userId, resource, action } },
  })
  if (override !== null) {
    setCached(userId, resource, action, override.allowed)
    return override.allowed
  }

  // 2. Role-level permission
  const rolePerm = await prisma.rolePermission.findFirst({
    where: {
      roleDefinition: { name: roleName },
      resource,
      action,
      allowed: true,
    },
  })
  let allowed = rolePerm !== null

  // `read_all` is a superset of `read_own` — a role permitted to read every
  // record is implicitly permitted to read its own. Routes that list a full
  // collection are gated on `read_own` in several places, so without this a
  // role granted only `read_all` (the common case) gets wrongly denied.
  if (!allowed && action === 'read_own') {
    const readAllPerm = await prisma.rolePermission.findFirst({
      where: { roleDefinition: { name: roleName }, resource, action: 'read_all', allowed: true },
    })
    allowed = readAllPerm !== null
  }

  setCached(userId, resource, action, allowed)
  return allowed
}

export function requirePermission(resource: string, action: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }
    const allowed = await resolvePermission(req.user.id, req.user.roleName, resource, action)
    if (!allowed) {
      res.status(403).json({ error: 'Insufficient permissions', resource, action })
      return
    }
    next()
  }
}

export async function checkApprovalToken(
  userId: string,
  roleName: string,
  entityType: string,
  entityId: string,
  // Beyond plain edit/delete this also gates ownership changes such as
  // 'assign', 'add_engineer' and 'remove_engineer'.
  action: string
): Promise<{ allowed: boolean; approvalId?: string }> {
  if (roleName === 'SuperAdmin') return { allowed: true }

  const approval = await prisma.approvalRequest.findFirst({
    where: {
      requestedById: userId,
      entityType,
      entityId,
      action,
      status: 'approved',
      expiresAt: { gt: new Date() },
    },
  })
  if (!approval) return { allowed: false }
  return { allowed: true, approvalId: approval.id }
}

export async function consumeApprovalToken(approvalId: string): Promise<boolean> {
  const result = await prisma.approvalRequest.updateMany({
    where: { id: approvalId, status: 'approved', expiresAt: { gt: new Date() } },
    data: { status: 'used' },
  })
  return result.count > 0
}
