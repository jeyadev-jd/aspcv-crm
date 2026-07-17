import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ItemAPI {
  id: string
  dealerId: string
  dealer: { id: string; name: string }
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
  createdAt: string
}

export function useItems(params?: { q?: string; dealerId?: string }) {
  return useQuery<ItemAPI[]>({
    queryKey: ['items', params],
    queryFn: () => api.get('/items', { params: { ...params, pageSize: 1000 } }).then(r => r.data.data),
  })
}

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/items', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  })
}

export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      api.put(`/items/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  })
}
