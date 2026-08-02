import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface CompanyProfile {
  id: string
  companyName: string
  legalName: string
  registeredAddr: string
  branchAddr?: string | null
  gstin: string
  pan: string
  cin?: string | null
  udyam?: string | null
  iec?: string | null
  state: string
  stateCode: string
  country: string
  email: string
  phone: string
  website?: string | null
  logoUrl?: string | null
  sealUrl?: string | null
  branchCode?: string | null
  invoicePrefix?: string | null
  declarationText?: string | null
  termsText?: string | null
  isActive: boolean
}

export function useCompanyProfiles() {
  return useQuery<CompanyProfile[]>({
    queryKey: ['company-profiles'],
    queryFn: () => api.get('/company-profile').then(r => r.data),
  })
}

/** The profile whose details appear on invoice letterheads. */
export function useActiveCompanyProfile() {
  return useQuery<CompanyProfile | null>({
    queryKey: ['company-profile', 'active'],
    queryFn: () => api.get('/company-profile/active').then(r => r.data),
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['company-profiles'] })
  qc.invalidateQueries({ queryKey: ['company-profile', 'active'] })
}

export function useCreateCompanyProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<CompanyProfile>) => api.post('/company-profile', data).then(r => r.data),
    onSuccess: () => invalidate(qc),
  })
}

export function useUpdateCompanyProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CompanyProfile> & { id: string }) =>
      api.patch(`/company-profile/${id}`, data).then(r => r.data),
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteCompanyProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/company-profile/${id}`),
    onSuccess: () => invalidate(qc),
  })
}
