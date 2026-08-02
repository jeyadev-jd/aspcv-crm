import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface QuotationItem {
  id?: string
  description: string
  quantity: number
  unit?: string
  unitPrice: number
  amount: number
}

export interface QuotationAPI {
  id: string
  refNumber: string
  companyId: string
  company: { id: string; name: string }
  dealId?: string | null
  title: string
  status: 'Draft' | 'PendingApproval' | 'Approved' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired'
  contactName?: string
  validUntil?: string
  subtotal: number
  taxPercent: number
  totalAmount: number
  warrantyPeriod?: number
  deliveryDate?: string
  scope?: string
  notes?: string
  approvedById?: string | null
  approvedAt?: string | null
  rejectionReason?: string | null
  items: QuotationItem[]
  createdAt: string
}

// Quotations
export function useQuotations(dealId?: string) {
  return useQuery<QuotationAPI[]>({
    queryKey: ['quotations', dealId],
    queryFn: () => api.get('/quotations', { params: dealId ? { dealId } : {} }).then(r => r.data),
  })
}
export function useQuotation(id: string) {
  return useQuery<QuotationAPI>({ queryKey: ['quotations', 'detail', id], queryFn: () => api.get(`/quotations/${id}`).then(r => r.data), enabled: !!id })
}
export function useCreateQuotation() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (data: any) => api.post('/quotations', data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }) })
}
export function useUpdateQuotation() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, ...data }: any) => api.put(`/quotations/${id}`, data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }) })
}
export function useDeleteQuotation() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.delete(`/quotations/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }) })
}
export function useSubmitQuotationForApproval() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.post(`/quotations/${id}/submit-for-approval`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }) })
}
export function useApproveQuotation() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.post(`/quotations/${id}/approve`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }) })
}
export function useRejectQuotation() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, reason }: { id: string; reason?: string }) => api.post(`/quotations/${id}/reject`, { reason }).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }) })
}
export function useSendQuotation() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.post(`/quotations/${id}/send`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }) })
}
