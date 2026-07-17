import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface BillingPayment {
  id: string; amount: number; method?: string | null; paidAt: string; notes?: string | null
}
export interface BillingInvoice {
  id: string; number: string; date: string; customer: string; status: string
  amount: number; paidAmount: number; dueDate?: string | null; projectId?: string | null
  items: { id: string; item: string; amount: number }[]
  payments: BillingPayment[]
}
export interface ProjectBilling {
  costs: {
    purchaseCost: number; manufacturingCost: number; labourCost: number
    serviceCost: number; installationCost: number; otherExpenses: number; totalCost: number
  }
  revenue: number; totalPaid: number; outstanding: number; uninvoiced: number
  profit: number; margin: number
  invoices: BillingInvoice[]
}

export function useProjectBilling(projectId: string) {
  return useQuery<ProjectBilling>({
    queryKey: ['project-billing', projectId],
    queryFn: () => api.get(`/projects/${projectId}/billing`).then(r => r.data),
    enabled: !!projectId,
    staleTime: 15_000,
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, projectId: string) {
  qc.invalidateQueries({ queryKey: ['project-billing', projectId] })
  qc.invalidateQueries({ queryKey: ['invoices'] })
}

export function useGenerateProjectInvoice(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/generate-invoice`).then(r => r.data),
    onSuccess: () => invalidate(qc, projectId),
  })
}

export function useRecordPayment(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ invoiceId, amount, method, notes }: { invoiceId: string; amount: number; method?: string; notes?: string }) =>
      api.post(`/invoices/${invoiceId}/payments`, { amount, method, notes }).then(r => r.data),
    onSuccess: () => invalidate(qc, projectId),
  })
}

export function useSendInvoice(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invoiceId: string) => api.patch(`/invoices/${invoiceId}/send`).then(r => r.data),
    onSuccess: () => invalidate(qc, projectId),
  })
}

export function useCancelInvoice(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invoiceId: string) => api.patch(`/invoices/${invoiceId}/cancel`).then(r => r.data),
    onSuccess: () => invalidate(qc, projectId),
  })
}
