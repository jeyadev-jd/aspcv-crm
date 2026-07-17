import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from '@/lib/toast'

// ─── BOM ─────────────────────────────────────────────────────────────────────

export interface BOMItem {
  id?: string
  itemName: string
  description?: string
  quantity: number
  unit?: string
  estimatedCost?: number
  supplier?: string
  remarks?: string
}

export interface BOMAPI {
  id: string
  refNumber: string
  projectId: string
  project: { id: string; title: string }
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'SentToProcurement'
  createdById?: string
  verifiedById?: string
  verifiedAt?: string
  notes?: string
  items: BOMItem[]
  createdAt: string
}

export function useBOMs(projectId?: string) {
  return useQuery<BOMAPI[]>({
    queryKey: ['boms', projectId],
    queryFn: () => api.get('/bom', { params: { pageSize: 1000, ...(projectId ? { projectId } : {}) } }).then(r => r.data.data),
  })
}
export function useBOM(id: string) {
  return useQuery<BOMAPI>({ queryKey: ['boms', id], queryFn: () => api.get(`/bom/${id}`).then(r => r.data), enabled: !!id })
}
export function useCreateBOM() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (data: any) => api.post('/bom', data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['boms'] }) })
}
export function useUpdateBOM() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, ...data }: any) => api.put(`/bom/${id}`, data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['boms'] }) })
}
export function useSubmitBOM() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.post(`/bom/${id}/submit`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['boms'] }) })
}
export function useApproveBOM() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.post(`/bom/${id}/approve`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['boms'] }) })
}
export function useRejectBOM() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.post(`/bom/${id}/reject`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['boms'] }) })
}
export function useSendBOMToProcurement() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.post(`/bom/${id}/send-to-procurement`).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['boms'] }); qc.invalidateQueries({ queryKey: ['projects'] }) } })
}
export function useDeleteBOM() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.delete(`/bom/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['boms'] }) })
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export interface POItem {
  id?: string
  itemName: string
  description?: string
  quantity: number
  unit?: string
  unitPrice: number
  amount: number
  receivedQty?: number
}

export interface PurchaseOrderAPI {
  id: string
  refNumber: string
  bomId?: string
  bom?: { id: string; project: { id: string; title: string } }
  supplierName: string
  supplierEmail?: string
  supplierPhone?: string
  supplierAddress?: string
  status: 'Draft' | 'Sent' | 'Approved' | 'Delivered' | 'Closed'
  expectedDelivery?: string
  deliveredAt?: string
  subtotal: number
  taxPercent: number
  totalAmount: number
  approvedById?: string
  approvedAt?: string
  notes?: string
  items: POItem[]
  goodsReceipts: { id: string; refNumber: string; receivedAt: string }[]
  createdAt: string
}

export function usePurchaseOrders(bomId?: string) {
  return useQuery<PurchaseOrderAPI[]>({
    queryKey: ['purchase-orders', bomId],
    queryFn: () => api.get('/purchase-orders', { params: { pageSize: 1000, ...(bomId ? { bomId } : {}) } }).then(r => r.data.data),
  })
}
export function usePurchaseOrder(id: string) {
  return useQuery<PurchaseOrderAPI>({ queryKey: ['purchase-orders', id], queryFn: () => api.get(`/purchase-orders/${id}`).then(r => r.data), enabled: !!id })
}
export function useCreatePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (data: any) => api.post('/purchase-orders', data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }) })
}
export function useUpdatePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, ...data }: any) => api.put(`/purchase-orders/${id}`, data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }) })
}
export function useApprovePO() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.post(`/purchase-orders/${id}/approve`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }) })
}
export function useSendPO() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.post(`/purchase-orders/${id}/send`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }) })
}
export function useDeletePO() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.delete(`/purchase-orders/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }) })
}

// ─── Goods Receipts ───────────────────────────────────────────────────────────

export interface GoodsReceiptAPI {
  id: string
  refNumber: string
  purchaseOrderId: string
  purchaseOrder: { id: string; refNumber: string; supplierName: string }
  receivedById?: string
  receivedAt: string
  notes?: string
  items: { id: string; itemName: string; quantity: number; unit?: string; unitPrice: number; rawComponentId?: string }[]
  createdAt: string
}

export function useGoodsReceipts(purchaseOrderId?: string) {
  return useQuery<GoodsReceiptAPI[]>({
    queryKey: ['goods-receipts', purchaseOrderId],
    queryFn: () => api.get('/goods-receipts', { params: { pageSize: 1000, ...(purchaseOrderId ? { purchaseOrderId } : {}) } }).then(r => r.data.data),
  })
}
export function useCreateGoodsReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/goods-receipts', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goods-receipts'] }); qc.invalidateQueries({ queryKey: ['purchase-orders'] }); qc.invalidateQueries({ queryKey: ['components'] }) },
  })
}

// ─── Inventory Allocations ────────────────────────────────────────────────────

export interface InventoryAllocationAPI {
  id: string
  rawComponentId: string
  rawComponent: { id: string; name: string; refNumber: string; quantity: number; unit?: string; price?: number }
  projectId: string
  project: { id: string; title: string }
  quantity: number
  allocatedById?: string
  allocatedAt: string
  notes?: string
}

export function useInventoryAllocations(params?: { projectId?: string; rawComponentId?: string }) {
  return useQuery<InventoryAllocationAPI[]>({
    queryKey: ['inventory-allocations', params],
    queryFn: () => api.get('/inventory-allocations', { params: { pageSize: 1000, ...params } }).then(r => r.data.data),
  })
}
export function useCreateAllocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/inventory-allocations', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory-allocations'] }); qc.invalidateQueries({ queryKey: ['components'] }) },
  })
}
export function useDeleteAllocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/inventory-allocations/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory-allocations'] }); qc.invalidateQueries({ queryKey: ['components'] }) },
  })
}

// ─── Work Orders ──────────────────────────────────────────────────────────────

export interface WorkOrderAPI {
  id: string
  refNumber: string
  projectId: string
  project: { id: string; title: string }
  title: string
  status: 'Waiting' | 'InProduction' | 'Assembly' | 'Testing' | 'Finished' | 'Cancelled'
  labourCost: number
  materialCost: number
  totalCost: number
  startedAt?: string
  finishedAt?: string
  notes?: string
  logs: { id: string; entry: string; actorName?: string; createdAt: string }[]
  materialConsumptions: {
    id: string; rawComponentId: string; rawComponent: { id: string; name: string; unit?: string }
    quantity: number; unitCost?: number; totalCost?: number; consumedAt: string
  }[]
  createdAt: string
}

export function useWorkOrders(projectId?: string) {
  return useQuery<WorkOrderAPI[]>({
    queryKey: ['work-orders', projectId],
    queryFn: () => api.get('/work-orders', { params: { pageSize: 1000, ...(projectId ? { projectId } : {}) } }).then(r => r.data.data),
  })
}
export function useWorkOrder(id: string) {
  return useQuery<WorkOrderAPI>({ queryKey: ['work-orders', id], queryFn: () => api.get(`/work-orders/${id}`).then(r => r.data), enabled: !!id })
}
export function useCreateWorkOrder() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (data: any) => api.post('/work-orders', data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['work-orders'] }) })
}
export function useUpdateWorkOrder() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, ...data }: any) => api.put(`/work-orders/${id}`, data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['work-orders'] }) })
}
export function useAddProductionLog() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, entry }: { id: string; entry: string }) => api.post(`/work-orders/${id}/logs`, { entry }).then(r => r.data), onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ['work-orders', id] }) })
}
export function useConsumeMaterial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api.post(`/work-orders/${id}/consume`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['work-orders'] }); qc.invalidateQueries({ queryKey: ['projects'] }); qc.invalidateQueries({ queryKey: ['components'] }) },
  })
}
export function useDeleteWorkOrder() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.delete(`/work-orders/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['work-orders'] }) })
}

// ─── Service Records ──────────────────────────────────────────────────────────

export interface ServiceRequestAPI {
  id: string
  refNumber: string
  serviceRecordId: string
  type: string
  title: string
  description?: string
  status: 'Open' | 'InProgress' | 'Resolved' | 'Closed'
  priority: string
  engineerId?: string
  engineerName?: string
  spareParts?: string
  cost: number
  resolvedAt?: string
  createdAt: string
}

export interface ServiceRecordAPI {
  id: string
  projectId: string
  project: { id: string; title: string; company: { name: string } }
  companyId?: string
  productDescription?: string
  installationDate?: string
  warrantyStart?: string
  warrantyEnd?: string
  warrantyMonths?: number
  serviceEngineerId?: string
  serviceCost: number
  notes?: string
  serviceRequests: ServiceRequestAPI[]
  createdAt: string
}

export function useServiceRecords() {
  return useQuery<ServiceRecordAPI[]>({ queryKey: ['service-records'], queryFn: () => api.get('/service-records', { params: { pageSize: 1000 } }).then(r => r.data.data) })
}
export function useServiceRecord(id: string) {
  return useQuery<ServiceRecordAPI>({ queryKey: ['service-records', id], queryFn: () => api.get(`/service-records/${id}`).then(r => r.data), enabled: !!id })
}
export function useUpdateServiceRecord() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, ...data }: any) => api.put(`/service-records/${id}`, data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['service-records'] }) })
}
export function useCreateServiceRequest() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, ...data }: any) => api.post(`/service-records/${id}/requests`, data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['service-records'] }) })
}
export function useUpdateServiceRequest() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ requestId, ...data }: any) => api.put(`/service-records/requests/${requestId}`, data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['service-records'] }) })
}
export function useWarrantyExpiring(days = 30) {
  return useQuery<ServiceRecordAPI[]>({
    queryKey: ['warranty-expiring', days],
    queryFn: () => api.get('/service-records/warranty-expiring', { params: { days } }).then(r => r.data),
  })
}

// ─── Project ERP ──────────────────────────────────────────────────────────────

export function useProjectERP(id: string) {
  return useQuery({
    queryKey: ['project-erp', id],
    queryFn: () => api.get(`/projects/${id}/erp`).then(r => r.data),
    enabled: !!id,
  })
}
export function useCompleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/projects/${id}/complete`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); qc.invalidateQueries({ queryKey: ['service-records'] }); toast.success('Project marked complete') },
  })
}
export function useCancelProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => api.post(`/projects/${id}/cancel`, { reason }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Project cancelled') },
  })
}
export function useAssignProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/projects/${id}/assign`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Assignment saved') },
  })
}
