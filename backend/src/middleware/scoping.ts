import { resolvePermission } from './permissions'

export async function getScopeFilter(
  userId: string,
  roleName: string,
  resource: string
): Promise<Record<string, unknown>> {
  const canReadAll = await resolvePermission(userId, roleName, resource, 'read_all')
  if (canReadAll) return {}
  const canReadOwn = await resolvePermission(userId, roleName, resource, 'read_own')
  if (!canReadOwn) return { id: '__DENY__' }

  switch (resource) {
    case 'lead':
    case 'deal':
      // leads/deals where user is an assigned owner (primary or secondary)
      return { owners: { some: { userId } } }
    case 'company':
      // companies where user owns at least one active lead
      return { leads: { some: { owners: { some: { userId } }, isActive: true } } }
    default:
      return { createdById: userId }
  }
}
