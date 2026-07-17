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
  title: string
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired'
  contactName?: string
  validUntil?: string
  subtotal: number
  taxPercent: number
  totalAmount: number
  warrantyPeriod?: number
  deliveryDate?: string
  scope?: string
  notes?: string
  items: QuotationItem[]
  createdAt: string
}

export interface SalesOrderAPI {
  id: string
  refNumber: string
  companyId: string
  company: { id: string; name: string }
  quotationId?: string
  quotation?: { id: string; refNumber: string }
  title: string
  status: 'Draft' | 'Confirmed' | 'Won' | 'Lost'
  budget?: number
  warrantyPeriod?: number
  deliveryDate?: string
  scope?: string
  productDetails?: string
  notes?: string
  wonAt?: string
  project?: { id: string; title: string; status: string }
  handoverDoc?: { id: string; status: string }
  createdAt: string
}

export interface HandoverDocAPI {
  id: string
  refNumber: string
  salesOrderId: string
  salesOrder: SalesOrderAPI & { company: any }
  projectName: string
  customerDetails?: string
  budget?: number
  warrantyPeriod?: number
  productDetails?: string
  deliveryDate?: string
  scope?: string
  attachments?: string
  notes?: string
  status: 'pending' | 'accepted' | 'rejected'
  acceptedAt?: string
  createdAt: string
}

// Quotations
export function useQuotations() {
  return useQuery<QuotationAPI[]>({ queryKey: ['quotations'], queryFn: () => api.get('/quotations').then(r => r.data) })
}
export function useQuotation(id: string) {
  return useQuery<QuotationAPI>({ queryKey: ['quotations', id], queryFn: () => api.get(`/quotations/${id}`).then(r => r.data), enabled: !!id })
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

// Sales Orders
export function useSalesOrders() {
  return useQuery<SalesOrderAPI[]>({ queryKey: ['sales-orders'], queryFn: () => api.get('/sales-orders').then(r => r.data) })
}
export function useSalesOrder(id: string) {
  return useQuery<SalesOrderAPI>({ queryKey: ['sales-orders', id], queryFn: () => api.get(`/sales-orders/${id}`).then(r => r.data), enabled: !!id })
}
export function useCreateSalesOrder() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (data: any) => api.post('/sales-orders', data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-orders'] }) })
}
export function useUpdateSalesOrder() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, ...data }: any) => api.put(`/sales-orders/${id}`, data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-orders'] }) })
}
export function useMarkSalesOrderWon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/sales-orders/${id}/won`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales-orders'] }); qc.invalidateQueries({ queryKey: ['handover-docs'] }) },
  })
}
export function useDeleteSalesOrder() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.delete(`/sales-orders/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-orders'] }) })
}

// Handover Documents
export function useHandoverDocs() {
  return useQuery<HandoverDocAPI[]>({ queryKey: ['handover-docs'], queryFn: () => api.get('/handover-documents').then(r => r.data) })
}
export function useHandoverDoc(id: string) {
  return useQuery<HandoverDocAPI>({ queryKey: ['handover-docs', id], queryFn: () => api.get(`/handover-documents/${id}`).then(r => r.data), enabled: !!id })
}
export function useAcceptHandover() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, assignedSEId }: { id: string; assignedSEId?: string }) =>
      api.post(`/handover-documents/${id}/accept`, { assignedSEId }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['handover-docs'] }); qc.invalidateQueries({ queryKey: ['projects'] }) },
  })
}
export function useRejectHandover() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/handover-documents/${id}/reject`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['handover-docs'] }),
  })
}
