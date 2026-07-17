import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Company {
  id: string
  name: string
  industry?: string
  customerType: 'Indian' | 'International'
  country: string
  state?: string
  cityId?: string
  areaId?: string
  city?: { id: string; name: string; state?: string }
  area?: { id: string; name: string }
  website?: string
  phone?: string
  email?: string
  isActive: boolean
  createdAt: string
  _count?: { contacts: number; leads: number }
}

const KEY = 'companies'

export function useCompanies(params?: { q?: string; customerType?: string }) {
  return useQuery<Company[]>({
    queryKey: [KEY, params],
    queryFn: () => api.get('/companies', { params: { pageSize: 1000, ...params } }).then(r => r.data.data),
  })
}

export function useCompany(id: string) {
  return useQuery<Company>({
    queryKey: [KEY, id],
    queryFn: () => api.get(`/companies/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Company>) => api.post('/companies', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useUpdateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Company> & { id: string }) => api.patch(`/companies/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/companies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
