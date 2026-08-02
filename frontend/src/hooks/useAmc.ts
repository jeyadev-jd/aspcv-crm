import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type AMCStatus = 'Active' | 'Expired' | 'Renewed' | 'Cancelled'

export interface AMCVisit {
  id: string
  agreementId: string
  scheduledAt: string
  completedAt?: string | null
  status: string
  technicianId?: string | null
  notes?: string | null
  reportUrl?: string | null
}

export interface AMCAgreement {
  id: string
  refNumber: string
  companyId: string
  projectId?: string | null
  title: string
  description?: string | null
  startDate: string
  endDate: string
  value: number
  visitFrequency: 'Monthly' | 'Quarterly' | 'HalfYearly' | 'Yearly'
  maxVisits: number
  status: AMCStatus
  renewedFromId?: string | null
  notes?: string | null
  company?: { id: string; name: string }
  project?: { id: string; title: string } | null
  visits?: AMCVisit[]
  _count?: { visits: number }
}

export function useAmcAgreements(params?: { status?: string; companyId?: string }) {
  return useQuery<AMCAgreement[]>({
    queryKey: ['amc-agreements', params],
    queryFn: () => api.get('/amc', { params: { pageSize: 100, ...params } }).then(r => r.data.data),
  })
}

export function useAmcAgreement(id?: string) {
  return useQuery<AMCAgreement>({
    queryKey: ['amc-agreement', id],
    queryFn: () => api.get(`/amc/${id}`).then(r => r.data),
    enabled: Boolean(id),
  })
}

function useAmcMutation<V>(fn: (vars: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['amc-agreements'] })
      qc.invalidateQueries({ queryKey: ['amc-agreement'] })
    },
  })
}

export interface AmcPayload {
  companyId: string
  projectId?: string
  title: string
  description?: string
  startDate: string
  endDate: string
  value?: number
  visitFrequency?: 'Monthly' | 'Quarterly' | 'HalfYearly' | 'Yearly'
  maxVisits?: number
  notes?: string
}

export function useCreateAmc() {
  return useAmcMutation((data: AmcPayload) => api.post('/amc', data).then(r => r.data))
}

/** Creates a fresh AMC term linked back to the expiring one via renewedFromId. */
export function useRenewAmc() {
  return useAmcMutation(({ id, ...data }: { id: string } & AmcPayload) =>
    api.post(`/amc/${id}/renew`, data).then(r => r.data))
}

export function useGenerateAmcInvoice() {
  return useAmcMutation(({ id }: { id: string }) => api.post(`/amc/${id}/invoice`).then(r => r.data))
}
