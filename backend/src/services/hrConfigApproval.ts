import prisma from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { Response } from 'express'
import { notifyRoles } from './notify'
import { appendEvent } from './timeline'

// Gate for HR-config write routes (LeaveType, LateLopRule, SalaryComponent, ...):
// SuperAdmin writes go through immediately (caller proceeds); HR writes are queued
// as a SuperAdmin-only ApprovalRequest instead of touching the table directly.
// Returns true when the caller should proceed with its own direct write.
export async function requireSuperAdminOrQueueApproval(
  req: AuthRequest,
  res: Response,
  entityType: string,
  action: string,
  payload: object,
): Promise<boolean> {
  const roleName = req.user?.roleName ?? ''
  if (roleName === 'SuperAdmin') return true

  if (roleName !== 'HR') {
    res.status(403).json({ error: 'Only HR/Admin can manage this setting' })
    return false
  }

  const ar = await prisma.approvalRequest.create({
    data: {
      requestedById: req.user!.id,
      entityType,
      action,
      entityId: 'config',
      payload,
      status: 'pending',
      escalationTier: 3, // HR config changes go straight to SuperAdmin, no manager chain
    },
  })
  await appendEvent('approval_request', ar.id, 'created',
    `HR requested ${action} on ${entityType} settings`, req.user!.id)
  await notifyRoles(['SuperAdmin'], {
    type: 'approval', severity: 'warning',
    title: 'HR settings change needs approval',
    message: `HR requested to ${action} ${entityType} settings.`,
    entityType: 'approval_request', entityId: ar.id,
  })

  res.status(202).json({ message: 'Change submitted for SuperAdmin approval', approvalRequest: ar })
  return false
}
