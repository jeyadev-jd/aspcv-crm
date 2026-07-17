import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ApiContact {
  id: string
  companyId: string
  company?: { id: string; name: string }
  name: string
  designation?: string
  email?: string
  phone?: string
  whatsapp?: string
  notes?: string
  isActive: boolean
  createdAt: string
}

const KEY = 'contacts-api'

export function useApiContacts(params?: { companyId?: string; q?: string }) {
  return useQuery<ApiContact[]>({
    queryKey: [KEY, params],
    queryFn: () => api.get('/contacts', { params: { pageSize: 1000, ...params } }).then(r => r.data.data),
    staleTime: 30_000,
  })
}

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ApiContact>) => api.post('/contacts', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<ApiContact> & { id: string }) => api.patch(`/contacts/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
