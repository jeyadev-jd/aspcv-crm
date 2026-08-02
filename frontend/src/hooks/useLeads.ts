import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { BulkDeleteResult } from '@/hooks/useSupport'

export interface LeadOwner {
  id: string
  userId: string
  role: string
  user: { id: string; name: string; role: string }
}

export interface LeadContact {
  id: string
  leadId: string
  name: string
  designation?: string
  email?: string
  phone?: string
  whatsapp?: string
  isPrimary: boolean
}

export interface LeadSourceEntry {
  id: string
  leadId: string
  source: string
  sourceName?: string
}

export interface NamedRef { id: string; name: string }

export interface LeadStageHistoryEntry {
  id: string
  leadId: string
  stage: string
  enteredAt: string
  exitedAt?: string | null
  remarks?: string | null
  changedBy?: string | null
  durationMs: number
}

export interface Lead {
  id: string
  companyId: string
  company: {
    id: string; name: string; customerType?: string
    region?: string; state?: string; city?: string; area?: string
    nickname?: string; stateCode?: string; areaCode?: string; cityCode?: string
  }
  title: string
  // Phase 1 master-data FKs (source of truth)
  regionId?: string
  regionRef?: NamedRef | null
  commercialModelId?: string
  commercialModel?: NamedRef | null
  leadSourceId?: string
  leadSourceRef?: NamedRef | null
  productId?: string
  estimatedValue?: number
  closeDate?: string
  leadDate?: string
  serialNo?: number
  refNumber?: string
  leadNumber?: string
  monthlyRemarks?: string
  stage: string
  status: string
  // Phase 1 sales pipeline — separate from `status`/`stage` above
  pipelineStage: string
  notes?: string
  departmentId?: string
  department?: { id: string; name: string } | null
  // Phase 1 ownership tiers
  primaryOwnerId?: string
  primaryOwner?: { id: string; name: string; role: string } | null
  secondaryOwnerId?: string
  secondaryOwner?: { id: string; name: string; role: string } | null
  salesManagerId?: string
  salesManager?: { id: string; name: string; role: string } | null
  businessHeadId?: string
  businessHead?: { id: string; name: string; role: string } | null
  ownerAssignedAt?: string | null
  // Phase 1 capacity / temperature / solution
  capacityValue?: number
  capacityUnitId?: string
  capacityUnit?: NamedRef | null
  tempRangeMin?: number
  tempRangeMax?: number
  isActive: boolean
  createdAt: string
  /** Echoed back on update so the server can reject a stale write. */
  updatedAt?: string
  owners: LeadOwner[]
  contacts: LeadContact[]
  sources: LeadSourceEntry[]
}

const KEY = 'leads'

export interface PaginatedLeads {
  data: Lead[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// Backend now paginates GET /leads. Existing pages that expect a flat array
// (client-side filter/paginate over the full list) pass a large pageSize to
// preserve current behavior; use useLeadsPaginated() for server-side paging.
export function useLeads(params?: Record<string, string>) {
  return useQuery<Lead[]>({
    queryKey: [KEY, params],
    queryFn: () => api.get('/leads', { params: { pageSize: 1000, ...params } }).then(r => r.data.data),
  })
}

export function useLeadsPaginated(params?: Record<string, string | number>) {
  return useQuery<PaginatedLeads>({
    queryKey: [KEY, 'paginated', params],
    queryFn: () => api.get('/leads', { params }).then(r => r.data),
  })
}

export function useLead(id: string) {
  return useQuery<Lead>({
    queryKey: [KEY, id],
    queryFn: () => api.get(`/leads/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Lead>) => api.post('/leads', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Lead> & { id: string }) => api.patch(`/leads/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

/**
 * Bulk archive. Deletion is approval-gated per lead, so ids still needing
 * approval are returned in `blocked` instead of failing the whole call.
 */
export function useBulkDeleteLeads() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post('/leads/bulk-delete', { ids }).then(r => r.data as BulkDeleteResult),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useChangeLeadStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/leads/${id}/status`, { status }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] })
      qc.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}

export function useChangeLeadPipelineStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage, remarks }: { id: string; stage: string; remarks?: string }) =>
      api.patch(`/leads/${id}/pipeline-stage`, { stage, remarks }).then(r => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [KEY] })
      qc.invalidateQueries({ queryKey: [KEY, vars.id, 'stage-history'] })
      qc.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}

export function useLeadStageHistory(id: string) {
  return useQuery<LeadStageHistoryEntry[]>({
    queryKey: [KEY, id, 'stage-history'],
    queryFn: () => api.get(`/leads/${id}/stage-history`).then(r => r.data),
    enabled: !!id,
  })
}
