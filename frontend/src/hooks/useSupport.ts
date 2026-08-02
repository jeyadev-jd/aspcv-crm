import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface TicketAPI {
  id: string
  ticketNumber?: string | null
  title: string
  companyId: string
  company: { id: string; name: string }
  contactId?: string | null
  contact?: { id: string; name: string; phone?: string | null } | null
  projectId?: string | null
  project?: { id: string; title: string; leadNumber?: string | null; status: string } | null
  installationId?: string | null
  installation?: { id: string; title: string; status: string } | null
  assignedToId?: string | null
  assignedTo?: { id: string; name: string; email?: string | null } | null
  description?: string | null
  category?: TicketCategory | null
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  status: 'Open' | 'InProgress' | 'Resolved' | 'Closed'
  dueDate?: string | null
  firstResponseAt?: string | null
  resolvedAt?: string | null
  closedAt?: string | null
  notes?: string | null
  createdAt: string
}

export interface TicketStats {
  byStatus: { status: TicketAPI['status']; count: number }[]
  byPriority: { priority: TicketAPI['priority']; count: number }[]
  byCategory: { category: string; count: number }[]
  overdue: number
  unassigned: number
  avgResolutionHours: number | null
  /** Null when nothing has been resolved yet — render "not enough data", not 0%. */
  slaCompliancePct: number | null
  slaSampleSize: number
}

export const TICKET_STATUS_LABEL: Record<TicketAPI['status'], string> = {
  Open: 'Open',
  InProgress: 'In Progress',
  Resolved: 'Resolved',
  Closed: 'Closed',
}

export const TICKET_STATUSES = Object.keys(TICKET_STATUS_LABEL) as TicketAPI['status'][]
export const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const

export const TICKET_CATEGORIES = [
  'Installation', 'Warranty', 'AMC', 'Performance', 'Billing', 'Other',
] as const
export type TicketCategory = (typeof TICKET_CATEGORIES)[number]

/** Mirrors SLA_HOURS in backend/src/services/ticketNumbering.ts. */
export const SLA_HOURS: Record<TicketAPI['priority'], number> = {
  Critical: 4, High: 24, Medium: 72, Low: 168,
}

/** Open/in-progress ticket whose due date has passed. */
export function isOverdue(t: TicketAPI): boolean {
  if (!t.dueDate) return false
  if (t.status === 'Resolved' || t.status === 'Closed') return false
  return new Date(t.dueDate) < new Date()
}

/** Hours remaining against the SLA; negative once breached. Null without a due date. */
export function hoursToDue(t: TicketAPI): number | null {
  if (!t.dueDate) return null
  return (new Date(t.dueDate).getTime() - Date.now()) / 3_600_000
}

export function useTickets(params?: Record<string, string>) {
  const qs = '?' + new URLSearchParams({ pageSize: '1000', ...params }).toString()
  return useQuery<TicketAPI[]>({
    queryKey: ['tickets', params],
    queryFn: () => api.get(`/support${qs}`).then(r => r.data.data),
    staleTime: 30_000,
  })
}

export function useTicketStats() {
  return useQuery<TicketStats>({
    queryKey: ['tickets', 'stats'],
    queryFn: () => api.get('/support/stats').then(r => r.data),
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

export function useAssignTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, assignedToId }: { id: string; assignedToId: string | null }) =>
      api.patch(`/support/${id}/assign`, { assignedToId }).then(r => r.data),
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

/** Result shape shared by every bulk-delete endpoint. */
export interface BulkDeleteResult {
  deleted: number
  skipped: number
  blocked?: { id: string; title: string; reason: string }[]
}

export function useBulkDeleteTickets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post('/support/bulk-delete', { ids }).then(r => r.data as BulkDeleteResult),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })
}
