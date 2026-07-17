import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type CalendarEventCategory = 'FollowUp' | 'Meeting' | 'Installation' | 'Commissioning' | 'EngineerVisit' | 'WarrantyExpiry' | 'AMCRenewal' | 'ServiceVisit' | 'CustomerReview' | 'ProjectMilestone' | 'Other'

export interface CalendarEventAPI {
  id: string
  title: string
  description?: string | null
  date: string
  startTime: string
  endTime: string
  color: string
  entityType?: string | null
  entityId?: string | null
  category?: CalendarEventCategory | null
  source: 'Manual' | 'Auto'
  createdById?: string | null
  createdAt: string
}

const KEY = 'calendarEvents'

export function useCalendarEvents(params?: { entityType?: string; entityId?: string; category?: string; from?: string; to?: string; limit?: number }) {
  return useQuery<CalendarEventAPI[]>({
    queryKey: [KEY, params],
    queryFn: () => api.get('/calendar', { params }).then(r => r.data),
    enabled: !params?.entityType || !!params?.entityId,
  })
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/calendar', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) => api.put(`/calendar/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
