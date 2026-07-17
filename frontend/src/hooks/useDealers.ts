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
    queryFn: () => api.get('/dealers', { params: { pageSize: 1000, ...(q ? { q } : {}) } }).then(r => r.data.data),
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

// ── Dealer Items ──────────────────────────────────────────────────────────────
export interface DealerItem {
  id: string
  dealerId: string
  name: string
  description?: string | null
  specification?: string | null
  unit?: string | null
  quantity?: number | null
  price?: number | null
  currency: string
  partNumber?: string | null
  brand?: string | null
  category?: string | null
  inStock: boolean
  notes?: string | null
}

export function useDealerItems(dealerId: string) {
  return useQuery<DealerItem[]>({
    queryKey: ['dealer-items', dealerId],
    queryFn: () => api.get(`/dealers/${dealerId}/items`).then(r => r.data),
    enabled: !!dealerId,
  })
}

export function useCreateDealerItem(dealerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post(`/dealers/${dealerId}/items`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dealer-items', dealerId] }),
  })
}

export function useUpdateDealerItem(dealerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, ...data }: Record<string, unknown> & { itemId: string }) =>
      api.put(`/dealers/${dealerId}/items/${itemId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dealer-items', dealerId] }),
  })
}

export function useDeleteDealerItem(dealerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => api.delete(`/dealers/${dealerId}/items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dealer-items', dealerId] }),
  })
}
