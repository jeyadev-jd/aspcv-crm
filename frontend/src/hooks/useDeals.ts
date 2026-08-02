import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { BulkDeleteResult } from '@/hooks/useSupport'

export interface DealAPI {
  id: string
  title: string
  companyId: string
  company: { id: string; name: string }
  leadId?: string | null
  lead?: { id: string; title: string } | null
  leadNumber?: string | null
  stage: 'LeadIn' | 'Proposal' | 'Negotiation' | 'OrderWon' | 'OrderLost'
  value?: number | null
  probability?: number | null
  closeDate?: string | null
  productId?: string | null
  notes?: string | null
  departmentId?: string | null
  department?: { id: string; name: string } | null
  // Phase 1: inherited automatically from Lead on Order-Won promotion
  regionId?: string | null
  region?: { id: string; name: string } | null
  commercialModelId?: string | null
  commercialModel?: { id: string; name: string } | null
  // Technical spec carried from the originating Lead
  capacityValue?: number | null
  capacityUnitId?: string | null
  capacityUnit?: { id: string; name: string } | null
  tempRangeMin?: number | null
  tempRangeMax?: number | null
  owners: { user: { id: string; name: string; role: string } }[]
  assignedPM?: { id: string; name: string; role: string } | null
  assignedSE?: { id: string; name: string; role: string } | null
  handoverNotes?: string | null
  handoverAttachmentUrl?: string | null
  handoverSubmittedAt?: string | null
  projects?: { id: string; title: string; status: string }[]
  createdAt: string
  /** Echoed back on update so the server can reject a stale write. */
  updatedAt?: string
}

const STAGE_LABEL: Record<DealAPI['stage'], string> = {
  LeadIn: 'Lead In',
  Proposal: 'Proposal',
  Negotiation: 'Negotiation',
  OrderWon: 'Closed Won',
  OrderLost: 'Closed Lost',
}

export const DEAL_STAGES = Object.entries(STAGE_LABEL) as [DealAPI['stage'], string][]

export function stageToUI(stage: DealAPI['stage']): string {
  return STAGE_LABEL[stage] ?? stage
}

export function useDeals(params?: Record<string, string>) {
  const qs = '?' + new URLSearchParams({ pageSize: '1000', ...params }).toString()
  return useQuery<DealAPI[]>({
    queryKey: ['deals', params],
    queryFn: () => api.get(`/deals${qs}`).then(r => r.data.data),
    staleTime: 30_000,
  })
}

export function useCreateDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/deals', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  })
}

export function useUpdateDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      api.put(`/deals/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  })
}

export function useUpdateDealStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      api.patch(`/deals/${id}/stage`, { stage }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['installations'] })
    },
  })
}

export function useCloseWonDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, handoverNotes, handoverOneDriveUrl, assignedPMId, budget, quotationId }: { id: string; handoverNotes: string; handoverOneDriveUrl: string; assignedPMId: string; budget?: number; quotationId?: string }) =>
      api.post(`/deals/${id}/close-won`, { handoverNotes, handoverOneDriveUrl, assignedPMId, budget, quotationId }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useAssignDealSE() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, assignedSEId }: { id: string; assignedSEId: string | null }) =>
      api.patch(`/deals/${id}/assign-se`, { assignedSEId }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  })
}

export function useAssignDealPM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, assignedPMId }: { id: string; assignedPMId: string | null }) =>
      api.patch(`/deals/${id}/assign-pm`, { assignedPMId }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  })
}

export function useDeleteDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/deals/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  })
}

/**
 * Bulk archive. Deletion is approval-gated per deal, so the response reports
 * which ids were left alone in `blocked` rather than failing the whole call.
 */
export function useBulkDeleteDeals() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post('/deals/bulk-delete', { ids }).then(r => r.data as BulkDeleteResult),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  })
}

/** Undo a Lead -> Deal promotion. Backend refuses (409) once a Project or
 *  Quotation exists on the deal. */
export function useRevertDealToLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/deals/${id}/revert-to-lead`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}
