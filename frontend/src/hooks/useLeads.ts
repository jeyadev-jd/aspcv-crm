import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

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

export interface Lead {
  id: string
  companyId: string
  company: {
    id: string; name: string; customerType?: string
    region?: string; state?: string; city?: string; area?: string
    nickname?: string; stateCode?: string; areaCode?: string; cityCode?: string
  }
  title: string
  source: string
  region: string
  commercialType: string
  productId?: string
  estimatedValue?: number
  closeDate?: string
  leadDate?: string
  serialNo?: number
  refNumber?: string
  monthlyRemarks?: string
  stage: string
  status: string
  notes?: string
  isActive: boolean
  createdAt: string
  owners: LeadOwner[]
  contacts: LeadContact[]
  sources: LeadSourceEntry[]
}

const KEY = 'leads'

export function useLeads(params?: Record<string, string>) {
  return useQuery<Lead[]>({
    queryKey: [KEY, params],
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
