import prisma from '../lib/prisma'

export async function appendEvent(
  entityType: string,
  entityId: string,
  eventType: string,
  description: string,
  actorId?: string,
  meta?: Record<string, unknown>
) {
  return prisma.timelineEvent.create({
    data: { entityType, entityId, eventType, description, actorId, meta: meta as any }
  })
}
