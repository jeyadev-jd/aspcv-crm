import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { BulkDeleteResult } from '@/hooks/useSupport'

export interface ProjectAPI {
  id: string
  title: string
  companyId: string
  company: { id: string; name: string }
  dealId?: string | null
  deal?: { id: string; title: string } | null
  leadNumber?: string | null
  status: 'Planning' | 'Active' | 'OnHold' | 'Completed' | 'Cancelled' | 'Engineering' | 'Procurement' | 'Manufacturing' | 'Installation' | 'Testing'
  startDate?: string | null
  endDate?: string | null
  budget?: number | null
  remainingBudget?: number | null
  actualBudget?: number | null
  purchaseCost?: number | null
  manufacturingCost?: number | null
  labourCost?: number | null
  installationCost?: number | null
  serviceCost?: number | null
  totalExpenses?: number | null
  profit?: number | null
  // Technical spec carried from the Deal
  capacityValue?: number | null
  capacityUnitId?: string | null
  capacityUnit?: { id: string; name: string } | null
  tempRangeMin?: number | null
  tempRangeMax?: number | null
  warrantyPeriod?: number | null
  warrantyStart?: string | null
  warrantyEnd?: string | null
  isLocked?: boolean
  completedAt?: string | null
  assignedPMId?: string | null
  assignedSEId?: string | null
  assignedPM?: { id: string; name: string } | null
  assignedSE?: { id: string; name: string } | null
  quotationId?: string | null
  quotation?: { id: string; refNumber: string; title: string } | null
  handoverNotes?: string | null
  handoverOneDriveUrl?: string | null
  progress?: number | null
  /** When false, milestone completion no longer overwrites `progress`. */
  autoProgress?: boolean
  /** Echoed back on update so the server can reject a stale write. */
  updatedAt?: string
  alertTier?: number | null
  notes?: string | null
  departmentId?: string | null
  department?: { id: string; name: string } | null
  installations?: { id: string; status: string }[]
  createdAt: string
}

export const STATUS_LABEL: Record<ProjectAPI['status'], string> = {
  Planning: 'Planning',
  Active: 'Active',
  OnHold: 'On Hold',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  Engineering: 'Engineering',
  Procurement: 'Procurement',
  Manufacturing: 'Manufacturing',
  Installation: 'Installation',
  Testing: 'Testing',
}

export const PROJECT_STATUSES = Object.keys(STATUS_LABEL) as ProjectAPI['status'][]

export function useProjects(params?: Record<string, string>) {
  const qs = '?' + new URLSearchParams({ pageSize: '1000', ...params }).toString()
  return useQuery<ProjectAPI[]>({
    queryKey: ['projects', params],
    queryFn: () => api.get(`/projects${qs}`).then(r => r.data.data),
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

/** Bulk archive. Locked projects come back in `blocked` and are not touched. */
export function useBulkDeleteProjects() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post('/projects/bulk-delete', { ids }).then(r => r.data as BulkDeleteResult),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

// useCompleteProject lives in hooks/useERP.ts — it needs the warranty payload
// (start/end date, budget allocated). A same-named export here would silently
// drop that payload if anything ever imported from this file instead.

export function useCancelProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post(`/projects/${id}/cancel`, { reason }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['components'] })
    },
  })
}

/** Undo a Deal -> Project promotion. Backend refuses (409) once any PO,
 *  invoice, allocation, work order or material request exists on the project. */
export function useRevertProjectToDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/projects/${id}/revert-to-deal`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}
