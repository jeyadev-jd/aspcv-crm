import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface ContactEvent {
  id: string
  contactId: string
  type: 'birthday' | 'anniversary' | 'custom'
  title: string
  eventDate: string
  recurring: boolean
  notes?: string
  createdAt: string
}

export function useContactEvents(contactId: string) {
  return useQuery<ContactEvent[]>({
    queryKey: ['contact-events', contactId],
    queryFn: () => api.get(`/contact-events/${contactId}/events`).then(r => r.data),
    enabled: !!contactId,
  })
}

export function useCreateContactEvent(contactId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<ContactEvent, 'id' | 'contactId' | 'createdAt'>) =>
      api.post(`/contact-events/${contactId}/events`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-events', contactId] }),
  })
}

export function useUpdateContactEvent(contactId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<ContactEvent> & { id: string }) =>
      api.patch(`/contact-events/${contactId}/events/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-events', contactId] }),
  })
}

export function useDeleteContactEvent(contactId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (eventId: string) =>
      api.delete(`/contact-events/${contactId}/events/${eventId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-events', contactId] }),
  })
}
