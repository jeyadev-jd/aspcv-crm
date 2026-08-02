import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { BulkDeleteResult } from './useSupport'

export interface ComponentMovement {
  id: string
  componentId: string
  type: 'received' | 'assigned' | 'returned' | 'disposed'
  toEntityType?: string
  toEntityId?: string
  toEntityName?: string
  performedById?: string
  notes?: string
  createdAt: string
}

export interface RawComponent {
  id: string
  refNumber: string
  name: string
  category?: string
  warrantyMonths?: number
  receivedAt: string
  status: 'in_stock' | 'assigned' | 'used' | 'returned' | 'disposed' | 'semi_finished' | 'finished_goods'
  assignedToType?: string
  assignedToId?: string
  assignedAt?: string
  dealerId?: string | null
  dealerName?: string | null
  price?: number | null
  gstPercent?: number | null
  hsnCode?: string | null
  unit?: string | null
  quantity?: number | null
  customFields?: Record<string, string>
  notes?: string
  movements?: ComponentMovement[]
  createdAt: string
  updatedAt: string
}

export function useComponents(params?: { status?: string; category?: string; search?: string; pageSize?: number; all?: boolean }) {
  return useQuery<RawComponent[]>({
    queryKey: ['components', params],
    // Backend caps pageSize at 100 by default — pass all:true to bypass it
    // (inventory pickers need the complete set, not one page of it).
    queryFn: () => api.get('/components', { params: { oldestFirst: 'true', pageSize: 100, ...params } }).then(r => r.data.data),
  })
}

/**
 * Bulk delete. The server only removes unattached stock — components that are
 * assigned, allocated, consumed or referenced come back in `blocked`.
 */
export function useBulkDeleteComponents() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post('/components/bulk-delete', { ids }).then(r => r.data as BulkDeleteResult),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['components'] }),
  })
}

export function useComponent(id: string) {
  return useQuery<RawComponent>({
    queryKey: ['component', id],
    queryFn: () => api.get(`/components/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<RawComponent>) =>
      api.post('/components', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['components'] }),
  })
}

export function useUpdateComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<RawComponent> & { id: string }) =>
      api.patch(`/components/${id}`, data).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['components'] })
      qc.invalidateQueries({ queryKey: ['component', vars.id] })
    },
  })
}

export function useAssignComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; toEntityType: string; toEntityId: string; toEntityName?: string; notes?: string }) =>
      api.post(`/components/${id}/assign`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['components'] }),
  })
}

export function useReturnComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post(`/components/${id}/return`, { notes }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['components'] }),
  })
}

export interface PushItem {
  scopeItemId: string
  category: 'SemiFinished' | 'FinishedGoods'
  name?: string
  quantity?: number
  notes?: string | null
}

export interface InventoryPush {
  id: string
  projectId: string
  componentId: string
  scopeItemId?: string | null
  category: string
  quantity: number
  pushedAt: string
  notes?: string | null
  component: Pick<RawComponent, 'id' | 'refNumber' | 'name' | 'category' | 'status' | 'quantity'>
}

/** Turns a cancelled/completed project's scope lines into new inventory stock. */
export function usePushToInventory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, items }: { projectId: string; items: PushItem[] }) =>
      api.post(`/projects/${projectId}/push-to-inventory`, { items }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['components'] })
      qc.invalidateQueries({ queryKey: ['scope-items'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['inventory-pushes'] })
    },
  })
}

export function useInventoryPushes(projectId?: string) {
  return useQuery<InventoryPush[]>({
    queryKey: ['inventory-pushes', projectId],
    queryFn: () => api.get(`/projects/${projectId}/inventory-pushes`).then(r => r.data),
    enabled: Boolean(projectId),
  })
}
