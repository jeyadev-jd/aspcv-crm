import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface InstallationAPI {
  id: string
  title: string
  companyId: string
  company: { id: string; name: string }
  projectId?: string | null
  project?: { id: string; title: string } | null
  status: 'Scheduled' | 'InProgress' | 'Completed' | 'OnHold'
  scheduledDate?: string | null
  completedDate?: string | null
  notes?: string | null
  createdAt: string
}

export const INSTALL_STATUS_LABEL: Record<InstallationAPI['status'], string> = {
  Scheduled: 'Scheduled',
  InProgress: 'In Progress',
  Completed: 'Completed',
  OnHold: 'On Hold',
}

export const INSTALL_STATUSES = Object.keys(INSTALL_STATUS_LABEL) as InstallationAPI['status'][]

export function useInstallations(params?: Record<string, string>) {
  const qs = '?' + new URLSearchParams({ pageSize: '1000', ...params }).toString()
  return useQuery<InstallationAPI[]>({
    queryKey: ['installations', params],
    queryFn: () => api.get(`/installations${qs}`).then(r => r.data.data),
    staleTime: 30_000,
  })
}

export function useCreateInstallation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/installations', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installations'] }),
  })
}

export function useUpdateInstallation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      api.put(`/installations/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installations'] }),
  })
}

export function useUpdateInstallationStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/installations/${id}/status`, { status }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installations'] }),
  })
}

export function useDeleteInstallation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/installations/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installations'] }),
  })
}
