import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type CalendarEventCategory = 'FollowUp' | 'Meeting' | 'Installation' | 'Commissioning' | 'EngineerVisit' | 'WarrantyExpiry' | 'AMCRenewal' | 'ServiceVisit' | 'CustomerReview' | 'ProjectMilestone' | 'Other'

/** Who sees the event, and who gets notified when it is created. */
export type CalendarAudience = 'Private' | 'Department' | 'Everyone'

export const AUDIENCE_LABEL: Record<CalendarAudience, string> = {
  Private: 'Only me',
  Department: 'My department',
  Everyone: 'Everyone',
}

export const AUDIENCE_HINT: Record<CalendarAudience, string> = {
  Private: 'Visible only to you. Nobody is notified.',
  Department: 'Visible to your department. Everyone in it is notified.',
  Everyone: 'Visible to all users. Everyone is notified.',
}

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
  audience: CalendarAudience
  departmentId?: string | null
  department?: { id: string; name: string } | null
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
