import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type DocumentType = 'Proposal' | 'Contract' | 'DrawingDesign' | 'Invoice' | 'PurchaseOrder' | 'WorkOrder' | 'ServiceReport' | 'Photo' | 'Warranty' | 'Other'
export type RelatedModule = 'Lead' | 'Deal' | 'Project' | 'Procurement' | 'Manufacturing' | 'Installation' | 'Finance' | 'Service' | 'Company' | 'Discussion' | 'Other'

export interface AttachmentAPI {
  id: string
  entityType?: string | null
  entityId?: string | null
  discussionId?: string | null
  fileName: string
  mimeType?: string | null
  sizeBytes?: number | null
  externalUrl?: string | null
  url: string
  documentType?: DocumentType | null
  relatedModule?: RelatedModule | null
  version: number
  rootAttachmentId?: string | null
  uploadedBy?: { id: string; name: string }
  createdAt: string
}

const KEY = 'attachments'

export function useAttachments(entityType: string, entityId: string) {
  return useQuery<AttachmentAPI[]>({
    queryKey: [KEY, entityType, entityId],
    queryFn: () => api.get('/attachments', { params: { entityType, entityId } }).then(r => r.data),
    enabled: !!entityType && !!entityId,
  })
}

export function useDiscussionAttachments(discussionId: string) {
  return useQuery<AttachmentAPI[]>({
    queryKey: [KEY, 'discussion', discussionId],
    queryFn: () => api.get('/attachments', { params: { discussionId } }).then(r => r.data),
    enabled: !!discussionId,
  })
}

export function useCreateLinkAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { entityType?: string; entityId?: string; discussionId?: string; url: string; fileName?: string; documentType?: DocumentType; relatedModule?: RelatedModule }) =>
      api.post('/attachments/link', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// Cross-module document visibility — one Attachment row queried under multiple ancestor
// contexts (e.g. a Project pulling docs uploaded at its parent Deal/Lead stage too).
export function useAttachmentsAcrossRefs(refs: { type: string; id: string }[]) {
  const refsParam = refs.filter(r => r.id).map(r => `${r.type}:${r.id}`).join(',')
  return useQuery<AttachmentAPI[]>({
    queryKey: [KEY, 'refs', refsParam],
    queryFn: () => api.get('/attachments', { params: { refs: refsParam } }).then(r => r.data),
    enabled: !!refsParam,
  })
}

export function useAttachmentVersions(id: string) {
  return useQuery<AttachmentAPI[]>({
    queryKey: [KEY, id, 'versions'],
    queryFn: () => api.get(`/attachments/${id}/versions`).then(r => r.data),
    enabled: !!id,
  })
}

export function useDeleteAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/attachments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
