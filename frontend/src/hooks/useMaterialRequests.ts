import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { api } from '../lib/api'

export interface MRItem {
  id: string
  requestId: string
  componentRefNo?: string
  name: string
  description?: string
  quantity: number
  unit?: string
  estimatedPrice?: number
}

export interface MaterialRequest {
  id: string
  refNumber: string
  requestedById: string
  requestedBy?: { id: string; name: string; role: string }
  projectId?: string
  project?: { id: string; title: string }
  items: MRItem[]
  status: string
  managerApprovedById?: string
  managerApprovedAt?: string
  bizHeadApprovedById?: string
  bizHeadApprovedAt?: string
  accountantApprovedById?: string
  accountantApprovedAt?: string
  rejectedById?: string
  rejectedAt?: string
  rejectionReason?: string
  totalEstimated?: number
  notes?: string
  createdAt: string
}

export function useMaterialRequests(params?: { mine?: boolean; status?: string }) {
  return useQuery<MaterialRequest[]>({
    queryKey: ['material-requests', params],
    queryFn: () => api.get('/material-requests', { params: { pageSize: 1000, ...params } }).then(r => r.data.data),
  })
}

export function useCreateMaterialRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { projectId?: string; items: Omit<MRItem, 'id' | 'requestId'>[]; notes?: string; totalEstimated?: number }) =>
      api.post('/material-requests', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['material-requests'] }); toast.success('Material request submitted') },
  })
}

export function useApproveMaterialRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/material-requests/${id}/approve`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['material-requests'] }); toast.success('Approved') },
  })
}

export function useRejectMaterialRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.patch(`/material-requests/${id}/reject`, { reason }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['material-requests'] }); toast.success('Rejected') },
  })
}
