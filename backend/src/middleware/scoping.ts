import { resolvePermission } from './permissions'

export async function getScopeFilter(
  userId: string,
  roleName: string,
  resource: string
): Promise<Record<string, unknown>> {
  const canReadAll = await resolvePermission(userId, roleName, resource, 'read_all')
  if (canReadAll) return {}
  const canReadOwn = await resolvePermission(userId, roleName, resource, 'read_own')
  if (canReadOwn) return { createdById: userId }
  // No read permission — return impossible condition
  return { id: '__DENY__' }
}
