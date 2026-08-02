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
  // Alternative vendors for this same part.
  dealerPrices?: ItemDealerPrice[]
  createdAt: string
}

export interface ItemDealerPrice {
  id: string
  itemId: string
  dealerId: string
  dealer: { id: string; name: string }
  price: number
  currency: string
  referenceNumber?: string | null
  leadTimeDays?: number | null
  minOrderQty?: number | null
  isPreferred: boolean
  notes?: string | null
}

export function useItems(params?: { q?: string; dealerId?: string }) {
  return useQuery<ItemAPI[]>({
    queryKey: ['items', params],
    queryFn: () => api.get('/items', { params: { ...params, pageSize: 1000 } }).then(r => r.data.data),
  })
}

export function useBulkDeleteItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => api.post('/items/bulk-delete', { ids }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
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

// ─── Multi-dealer pricing ────────────────────────────────────────────────────

/** Upserts a dealer's price for an item — re-adding the same dealer updates it. */
export function useSetItemDealerPrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, ...data }: Record<string, unknown> & { itemId: string }) =>
      api.post(`/items/${itemId}/dealer-prices`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  })
}

export function useDeleteItemDealerPrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, priceId }: { itemId: string; priceId: string }) =>
      api.delete(`/items/${itemId}/dealer-prices/${priceId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  })
}
