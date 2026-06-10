import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface TimelineEvent {
  id: string
  entityType: string
  entityId: string
  actorId?: string
  eventType: string
  description: string
  meta?: Record<string, unknown>
  createdAt: string
}

export function useTimeline(entityType: string, entityId: string) {
  return useQuery<TimelineEvent[]>({
    queryKey: ['timeline', entityType, entityId],
    queryFn: () => api.get('/timeline', { params: { entityType, entityId } }).then(r => r.data),
    enabled: !!entityType && !!entityId,
  })
}
