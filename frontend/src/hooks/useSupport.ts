import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface TicketAPI {
  id: string
  title: string
  companyId: string
  company: { id: string; name: string }
  contactId?: string | null
  contact?: { id: string; name: string; phone?: string | null } | null
  description?: string | null
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  status: 'Open' | 'InProgress' | 'Resolved' | 'Closed'
  resolvedAt?: string | null
  notes?: string | null
  createdAt: string
}

export const TICKET_STATUS_LABEL: Record<TicketAPI['status'], string> = {
  Open: 'Open',
  InProgress: 'In Progress',
  Resolved: 'Resolved',
  Closed: 'Closed',
}

export const TICKET_STATUSES = Object.keys(TICKET_STATUS_LABEL) as TicketAPI['status'][]
export const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const

export function useTickets(params?: Record<string, string>) {
  const qs = '?' + new URLSearchParams({ pageSize: '1000', ...params }).toString()
  return useQuery<TicketAPI[]>({
    queryKey: ['tickets', params],
    queryFn: () => api.get(`/support${qs}`).then(r => r.data.data),
    staleTime: 30_000,
  })
}

export function useCreateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/support', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useUpdateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      api.put(`/support/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useUpdateTicketStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/support/${id}/status`, { status }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useDeleteTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/support/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })
}
