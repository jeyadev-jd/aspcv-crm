import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

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
  status: 'in_stock' | 'assigned' | 'used' | 'returned' | 'disposed'
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

export function useComponents(params?: { status?: string; category?: string }) {
  return useQuery<RawComponent[]>({
    queryKey: ['components', params],
    queryFn: () => api.get('/components', { params: { ...params, oldestFirst: 'true' } }).then(r => r.data),
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
