import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface DealerContact {
  id?: string
  name: string
  designation?: string
  phone?: string
  email?: string
  whatsapp?: string
  isPrimary?: boolean
}

export interface Dealer {
  id: string
  name: string
  company?: string | null
  gstNumber?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  category?: string | null
  notes?: string | null
  contacts: DealerContact[]
  createdAt: string
}

export function useDealers(q?: string) {
  return useQuery<Dealer[]>({
    queryKey: ['dealers', q],
    queryFn: () => api.get('/dealers', { params: q ? { q } : {} }).then(r => r.data),
  })
}

export function useCreateDealer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/dealers', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dealers'] }),
  })
}

export function useUpdateDealer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      api.put(`/dealers/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dealers'] }),
  })
}

export function useDeleteDealer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/dealers/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dealers'] }),
  })
}
