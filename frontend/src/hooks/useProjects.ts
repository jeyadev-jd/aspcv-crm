import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ProjectAPI {
  id: string
  title: string
  companyId: string
  company: { id: string; name: string }
  dealId?: string | null
  deal?: { id: string; title: string } | null
  status: 'Planning' | 'Active' | 'OnHold' | 'Completed'
  startDate?: string | null
  endDate?: string | null
  budget?: number | null
  actualBudget?: number | null
  progress?: number | null
  alertTier?: number | null
  notes?: string | null
  installations?: { id: string; status: string }[]
  createdAt: string
}

export const STATUS_LABEL: Record<ProjectAPI['status'], string> = {
  Planning: 'Planning',
  Active: 'Active',
  OnHold: 'On Hold',
  Completed: 'Completed',
}

export const PROJECT_STATUSES = Object.keys(STATUS_LABEL) as ProjectAPI['status'][]

export function useProjects(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return useQuery<ProjectAPI[]>({
    queryKey: ['projects', params],
    queryFn: () => api.get(`/projects${qs}`).then(r => r.data),
    staleTime: 30_000,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/projects', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      api.put(`/projects/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProjectStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/projects/${id}/status`, { status }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}
