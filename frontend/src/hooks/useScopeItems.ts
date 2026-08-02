import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** Minimal view of the component fulfilling a scope line, as returned by GET /scope-items. */
export interface ScopeComponent {
  id: string
  refNumber: string
  name: string
  category?: string | null
  status: string
}

export type FulfillmentStatus = 'unallocated' | 'allocated' | 'semi_finished' | 'completed' | 'returned'

export interface ScopeItemAPI {
  id: string
  entityType: string
  entityId: string
  name: string
  quantity: number
  unit?: string | null
  customFields: { label: string; value: string }[]
  notes?: string | null
  sortOrder: number
  inventoryComponentId?: string | null
  inventoryComponent?: ScopeComponent | null
  fulfillmentStatus: FulfillmentStatus
  allocatedAt?: string | null
}

type EntityType = 'Lead' | 'Deal' | 'Project'

export const scopeItemsKey = (entityType: string, entityId?: string) => ['scope-items', entityType, entityId]

export function useScopeItems(entityType: EntityType, entityId?: string) {
  return useQuery<ScopeItemAPI[]>({
    queryKey: scopeItemsKey(entityType, entityId),
    queryFn: () => api.get('/scope-items', { params: { entityType, entityId } }).then(r => r.data),
    enabled: Boolean(entityId),
  })
}

/**
 * Allocation changes move stock and project cost, so components, allocations and
 * the owning project are all refetched alongside the scope list.
 */
function useAllocationMutation<V extends { scopeItemId: string }>(
  fn: (vars: V) => Promise<unknown>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scope-items'] })
      qc.invalidateQueries({ queryKey: ['components'] })
      qc.invalidateQueries({ queryKey: ['inventory-allocations'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useAllocateComponent() {
  return useAllocationMutation(({ scopeItemId, componentId, notes, quantity }: { scopeItemId: string; componentId: string; notes?: string; quantity?: number }) =>
    api.post(`/scope-items/${scopeItemId}/allocate`, { componentId, notes, quantity }).then(r => r.data))
}

export function useUnallocateComponent() {
  return useAllocationMutation(({ scopeItemId }: { scopeItemId: string }) =>
    api.delete(`/scope-items/${scopeItemId}/allocate`).then(r => r.data))
}

/** Swaps the linked component in one call — the API returns the old one to stock. */
export function useReallocateComponent() {
  return useAllocationMutation(({ scopeItemId, componentId, notes, quantity }: { scopeItemId: string; componentId: string; notes?: string; quantity?: number }) =>
    api.patch(`/scope-items/${scopeItemId}/allocate`, { componentId, notes, quantity }).then(r => r.data))
}
